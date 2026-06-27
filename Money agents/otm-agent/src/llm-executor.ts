/**
 * OTM Agent — Real LLM Work Executor
 *
 * Provider order:
 *   1. openrouter — https://openrouter.ai/api/v1 (free tier: Qwen, Nemotron, etc.)
 *   2. grok       — https://api.x.ai/v1          (Grok-2, if credits available)
 *   3. qwen-portal — https://dash.qwen.ai/v1     (Qwen Coder, free)
 *
 * NO simulation fallback — all providers must be exhausted and if none succeed,
 * the function throws so callers can handle the failure explicitly.
 */

import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface LlmConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  maxTokens: number;
  temperature: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  usage?: { inputTokens: number; outputTokens: number };
  cached: boolean;
}

// OpenRouter comes first — free tier with capable models, no credits needed.
// Falls back to Grok (if credits available) then Qwen portal.
// Read API key from environment — never hardcode secrets in source.
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ?? "";

const DEFAULT_CONFIGS: LlmConfig[] = [
  {
    // Primary: Nemotron 120B — large, capable, confirmed working
    provider: "openrouter",
    model: "nvidia/nemotron-3-super-120b-a12b:free",
    apiKey: OPENROUTER_API_KEY,
    baseUrl: "https://openrouter.ai/api/v1",
    maxTokens: 8192,
    temperature: 0.7,
  },
  {
    // Fallback 1: Qwen3 80B — good for code + content when not rate-limited
    provider: "openrouter-fallback",
    model: "qwen/qwen3-next-80b-a3b-instruct:free",
    apiKey: OPENROUTER_API_KEY,
    baseUrl: "https://openrouter.ai/api/v1",
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    // Fallback 2: MiniMax M2.5 — reliable free option
    provider: "openrouter-fallback2",
    model: "minimax/minimax-m2.5:free",
    apiKey: OPENROUTER_API_KEY,
    baseUrl: "https://openrouter.ai/api/v1",
    maxTokens: 4096,
    temperature: 0.7,
  },
  {
    provider: "grok",
    model: "grok-2",
    maxTokens: 4096,
    temperature: 0.7,
  },
];

async function loadGatewayAuthProfiles(): Promise<
  Record<string, { provider: string; apiKey?: string }>
> {
  try {
    const path = join(homedir(), ".openclaw", "agents", "main", "agent", "auth-profiles.json");
    const data = await readFile(path, "utf8");
    const parsed = JSON.parse(data);
    const profiles: Record<string, { provider: string; apiKey?: string }> = {};
    for (const [key, val] of Object.entries(parsed.profiles ?? {})) {
      const profile = val as Record<string, unknown>;
      if (profile.apiKey) {
        profiles[key] = { provider: key, apiKey: profile.apiKey as string };
      }
    }
    return profiles;
  } catch {
    return {};
  }
}

async function loadModelsConfig(): Promise<Record<string, { baseUrl?: string; apiKey?: string }>> {
  try {
    const path = join(homedir(), ".openclaw", "agents", "main", "agent", "models.json");
    const data = await readFile(path, "utf8");
    const parsed = JSON.parse(data);
    const result: Record<string, { baseUrl?: string; apiKey?: string }> = {};
    for (const [key, val] of Object.entries(parsed.providers ?? {})) {
      const provider = val as Record<string, unknown>;
      if (provider.apiKey && provider.apiKey !== "qwen-oauth") {
        result[key] = {
          baseUrl: provider.baseUrl as string | undefined,
          apiKey: provider.apiKey as string,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Read the gateway auth token from env or openclaw.json so gateway calls don't 401. */
async function readGatewayToken(): Promise<string | undefined> {
  // Prefer env var (set at gateway startup)
  if (process.env.OPENCLAW_GATEWAY_TOKEN) return process.env.OPENCLAW_GATEWAY_TOKEN;
  try {
    const path = join(homedir(), ".openclaw", "openclaw.json");
    const data = await readFile(path, "utf8");
    const cfg = JSON.parse(data) as Record<string, unknown>;
    const auth = cfg.gateway as Record<string, unknown> | undefined;
    return (auth?.token as string | undefined) ?? (auth?.apiKey as string | undefined);
  } catch {
    return undefined;
  }
}

/**
 * Estimate the USD cost of an LLM call based on provider pricing.
 * Free-tier OpenRouter models are $0; paid providers use published rates.
 */
function estimateTokenCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  // Per-1K-token rates (USD). Free-tier models are $0.
  const FREE_PROVIDERS = new Set([
    "openrouter",
    "openrouter-fallback",
    "openrouter-fallback2",
    "qwen",
    "qwen-portal",
    "gateway",
  ]);
  if (FREE_PROVIDERS.has(provider) && model.includes(":free")) return 0;

  // Known paid-model rates (input/output per 1K tokens)
  const RATES: Record<string, { input: number; output: number }> = {
    "grok-2": { input: 0.002, output: 0.01 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
    "gpt-4o": { input: 0.005, output: 0.015 },
    "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  };

  const rate = RATES[model];
  if (rate) {
    return (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output;
  }

  // Unknown model — conservative estimate
  return (inputTokens / 1000) * 0.001 + (outputTokens / 1000) * 0.002;
}

function resolveProviderConfig(
  provider: string,
  loadedKeys: Record<string, { baseUrl?: string; apiKey?: string }>,
  gatewayToken?: string,
): { baseUrl: string; apiKey?: string } {
  const GATEWAY_BASE = "http://127.0.0.1:18789";
  const PROVIDER_URLS: Record<string, string> = {
    gateway: `${GATEWAY_BASE}/v1`,
    openrouter: "https://openrouter.ai/api/v1",
    "openrouter-fallback": "https://openrouter.ai/api/v1",
    "openrouter-fallback2": "https://openrouter.ai/api/v1",
    grok: "https://api.x.ai/v1",
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    qwen: "https://dash.qwen.ai/v1",
    "qwen-portal": "https://dash.qwen.ai/v1",
  };

  // For the local gateway, inject the token as the api key
  if (provider === "gateway") {
    return { baseUrl: GATEWAY_BASE + "/v1", apiKey: gatewayToken };
  }

  const loaded = loadedKeys[provider];
  const baseUrl = loaded?.baseUrl ?? PROVIDER_URLS[provider] ?? `${GATEWAY_BASE}/v1`;
  const apiKey = loaded?.apiKey;
  return { baseUrl, apiKey };
}

async function callLlm(
  config: LlmConfig,
  prompt: string,
  system?: string,
  loadedKeys?: Record<string, { baseUrl?: string; apiKey?: string }>,
  gatewayToken?: string,
): Promise<LlmResponse> {
  const { baseUrl, apiKey } = resolveProviderConfig(
    config.provider,
    loadedKeys ?? {},
    gatewayToken,
  );
  const key =
    config.apiKey ?? apiKey ?? process.env[`${config.provider.toUpperCase()}_API_KEY`] ?? "";

  const messages: Array<{ role: string; content: string }> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const isOpenRouter =
    config.provider === "openrouter" ||
    config.provider === "openrouter-fallback" ||
    config.provider === "openrouter-fallback2";

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
        // OpenRouter requires these headers to use free models
        ...(isOpenRouter
          ? {
              "HTTP-Referer": "https://tapclaw.com",
              "X-Title": "TapClaw OTM Agent",
            }
          : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      }),
      signal: AbortSignal.timeout(90000), // 90s — free OpenRouter models can be slower
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      model?: string;
    };

    const content = data.choices?.[0]?.message?.content ?? "";
    if (!content) throw new Error("Empty response from model");

    return {
      content,
      model: data.model ?? config.model,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens ?? 0,
            outputTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
      cached: false,
    };
  } catch (err) {
    throw new Error(
      `LLM call failed (${config.provider}/${config.model}): ${(err as Error).message}`,
      { cause: err },
    );
  }
}

const SYSTEM_PROMPTS: Record<string, string> = {
  content_writing: `You are a professional freelance content writer. Generate high-quality, original content that is ready to deliver to a client. Output ONLY the deliverable content — no explanations, no placeholders, no commentary. The content should be publication-ready, well-formatted, and match the exact requirements given.`,
  code_generation: `You are a professional software engineer. Generate clean, working code that solves the client's problem. Output ONLY the code deliverable — no explanations, no comments about what you wrote, no markdown code blocks unless requested. The code should be complete and ready to use.`,
  data_annotation: `You are a meticulous data annotation specialist. Provide accurate, consistent labels and annotations for the given data. Output ONLY the annotation results in the requested format — no explanations.`,
  social_media: `You are a social media expert. Generate engaging social media posts ready to publish. Output ONLY the post content — no explanations, no hashtags explanations. Make it punchy, authentic, and platform-appropriate.`,
  seo: `You are an SEO content strategist. Generate SEO-optimized content that ranks. Output ONLY the deliverable article — no explanations, no keyword lists outside the content. Write naturally while incorporating target keywords.`,
  research: `You are a research analyst. Generate thorough, well-structured research summaries. Output ONLY the research deliverable — no explanations of your process. Cite sources where applicable.`,
  micro_task: `You are a detail-oriented task worker. Complete the micro-task accurately and efficiently. Output ONLY the completed task result — no explanations, no status updates.`,
  design: `You are a professional designer. Generate detailed design specifications or copy that a designer can implement. Output ONLY the design deliverable — no explanations.`,
  translation: `You are a professional translator. Provide accurate, culturally appropriate translations. Output ONLY the translated text — no explanations, no notes.`,
  video: `You are a video content creator. Generate video scripts and descriptions ready for production. Output ONLY the script/deliverable — no explanations.`,
  virtual_assistant: `You are a skilled virtual assistant. Complete the administrative or research task thoroughly and accurately. Output ONLY the completed task result — no explanations of your process.`,
};

export async function executeLlmWork(
  category: string,
  jobTitle: string,
  jobDescription: string,
  requirements: string[],
): Promise<{ deliverable: string; model: string; tokens: number; cost: number }> {
  let lastError = "";

  // Load API keys from disk so providers don't 401
  const [modelsConfig, authProfiles, gatewayToken] = await Promise.all([
    loadModelsConfig(),
    loadGatewayAuthProfiles(),
    readGatewayToken(),
  ]);

  // Merge: modelsConfig has baseUrl+apiKey per provider; authProfiles has apiKey per profile
  const loadedKeys: Record<string, { baseUrl?: string; apiKey?: string }> = {
    ...modelsConfig,
  };
  for (const [key, val] of Object.entries(authProfiles)) {
    if (!loadedKeys[key]) {
      loadedKeys[key] = { apiKey: val.apiKey };
    }
  }

  // Also read provider keys from main openclaw.json (models.providers.*.apiKey)
  try {
    const mainCfgPath = join(homedir(), ".openclaw", "openclaw.json");
    const mainCfgRaw = await readFile(mainCfgPath, "utf8");
    const mainCfg = JSON.parse(mainCfgRaw) as Record<string, unknown>;
    const providers = (mainCfg.models as Record<string, unknown>)?.providers as
      | Record<string, unknown>
      | undefined;
    if (providers) {
      for (const [prov, cfg] of Object.entries(providers)) {
        const pcfg = cfg as Record<string, unknown>;
        if (pcfg.apiKey && typeof pcfg.apiKey === "string") {
          if (!loadedKeys[prov]) loadedKeys[prov] = {};
          loadedKeys[prov].apiKey = loadedKeys[prov].apiKey ?? pcfg.apiKey;
          if (pcfg.baseUrl && typeof pcfg.baseUrl === "string") {
            loadedKeys[prov].baseUrl = loadedKeys[prov].baseUrl ?? pcfg.baseUrl;
          }
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  const system = SYSTEM_PROMPTS[category] ?? SYSTEM_PROMPTS.content_writing;

  // Cap inputs to prevent token overflow on very long job descriptions / requirement lists.
  const MAX_DESCRIPTION_CHARS = 3000;
  const MAX_REQUIREMENTS = 10;
  const truncatedDescription =
    jobDescription.length > MAX_DESCRIPTION_CHARS
      ? jobDescription.slice(0, MAX_DESCRIPTION_CHARS) + "… [truncated]"
      : jobDescription;
  const cappedRequirements = requirements.slice(0, MAX_REQUIREMENTS);

  const prompt = `JOB: ${jobTitle}

DESCRIPTION: ${truncatedDescription}

REQUIREMENTS:
${cappedRequirements.map((r) => `• ${r}`).join("\n")}

DELIVERABLE:`;

  for (const config of DEFAULT_CONFIGS) {
    try {
      const response = await callLlm(config, prompt, system, loadedKeys, gatewayToken);
      const inputTokens = response.usage?.inputTokens ?? Math.ceil(prompt.length / 4);
      const outputTokens = response.usage?.outputTokens ?? Math.ceil(response.content.length / 4);

      // Real cost estimation per provider (USD per 1K tokens)
      const cost = estimateTokenCost(config.provider, config.model, inputTokens, outputTokens);

      return {
        deliverable: response.content,
        model: response.model,
        tokens: outputTokens,
        cost,
      };
    } catch (err) {
      lastError = (err as Error).message;
      console.warn(`[llm-executor] ${config.provider} failed: ${lastError}`);
      continue; // try next model
    }
  }

  // All providers exhausted — fail loudly so callers can handle it
  throw new Error(
    `[llm-executor] All LLM providers failed. No simulation fallback. Last error: ${lastError}`,
  );
}


