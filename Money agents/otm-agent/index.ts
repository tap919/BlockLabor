import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import { decryptConfigValue } from "openclaw/plugin-sdk/config-crypto";
import { definePluginEntry } from "openclaw/plugin-sdk/core";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth";
import { sendMessageSignal } from "openclaw/plugin-sdk/signal";
import {
  getAccountStore,
  PlatformAccount,
  AccountStats,
  AccountType,
  validatePlatformCredentials,
  maskSecret,
} from "./src/account-store.js";
import { deployStoreToCloudflarepages, resolveStoreDir } from "./src/cloudflare-deploy.js";
import { getJobEngine, type JobListing } from "./src/job-engine.js";
import { executeLlmWork } from "./src/llm-executor.js";
import {
  savePayoutConfig,
  loadAllPayoutConfigs,
  loadActivePayoutConfig,
  deletePayoutConfig,
  getWithdrawalHistory,
  getWithdrawalStats,
  processPayout,
  checkAutoWithdrawal,
  initPayoutEngine,
  type PayoutConfig,
} from "./src/payout-engine.js";

const PROVIDER_ID = "otm-agent";

interface OTMConfig {
  apiUrl: string;
  apiKey: string;
  webhookSecret: string;
  scanInterval: number;
  maxOpportunities: number;
  minScoreThreshold: number;
  platforms: string[];
  bankroll: number;
  hoursPerDay: number;
  dataDir: string;
  // Signal notification settings
  signalNotifications: boolean;
  signalRecipients: string[];
  signalMinScore: number;
  signalNotifyTypes: string[];
}

// Path for runtime overrides (bankroll and other values that can change at runtime)
const OTM_RUNTIME_OVERRIDES_PATH = join(homedir(), ".openclaw", "otm", "runtime-overrides.json");

/**
 * Load persisted runtime overrides (bankroll etc.) from disk.
 * Returns an empty object if the file doesn't exist or can't be parsed.
 * This is called synchronously-ish at startup; callers must await.
 */
async function loadRuntimeOverrides(): Promise<Partial<OTMConfig>> {
  try {
    const raw = await readFile(OTM_RUNTIME_OVERRIDES_PATH, "utf8");
    return JSON.parse(raw) as Partial<OTMConfig>;
  } catch {
    return {};
  }
}

/**
 * Persist a set of runtime override values to disk so they survive gateway restarts.
 * Merges with any existing overrides rather than clobbering them.
 */
async function saveRuntimeOverrides(updates: Partial<OTMConfig>): Promise<void> {
  await mkdir(join(homedir(), ".openclaw", "otm"), { recursive: true });
  const existing = await loadRuntimeOverrides();
  const merged = { ...existing, ...updates };
  // 0o600 — this file may contain the bankroll figure; restrict to owner only
  await writeFile(OTM_RUNTIME_OVERRIDES_PATH, JSON.stringify(merged, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
}

function readOTMConfig(raw: Record<string, unknown>): OTMConfig {
  // Parse nested notifications config if present
  const notif = (raw.notifications as Record<string, unknown>) ?? {};

  // Validate and clamp numeric config values to safe ranges (M2/M4/M6/M8)
  const rawScanInterval = (raw.scanInterval as number) ?? 300;
  // scanInterval must be at least 30 seconds to prevent runaway polling loops
  const scanInterval = Math.max(30, rawScanInterval);

  const rawMaxOpportunities = (raw.maxOpportunities as number) ?? 50;
  // Cap at 500 to prevent excessive memory use
  const maxOpportunities = Math.min(500, Math.max(1, rawMaxOpportunities));

  const rawMinScoreThreshold = (raw.minScoreThreshold as number) ?? 70;
  // Clamp 0–100; a threshold > 100 would match nothing, < 0 would match everything
  const minScoreThreshold = Math.min(100, Math.max(0, rawMinScoreThreshold));

  const rawHoursPerDay = (raw.hoursPerDay as number) ?? 2;
  // Clamp 0.5–24; 0 or negative causes division-by-zero in scheduling logic
  const hoursPerDay = Math.min(24, Math.max(0.5, rawHoursPerDay));

  return {
    apiUrl: (raw.apiUrl as string) ?? process.env.OTM_API_URL ?? "http://localhost:3001",
    apiKey: decryptConfigValue(raw.apiKey) ?? process.env.OTM_API_KEY ?? "",
    webhookSecret: decryptConfigValue(raw.webhookSecret) ?? process.env.OTM_WEBHOOK_SECRET ?? "",
    scanInterval,
    maxOpportunities,
    minScoreThreshold,
    platforms: (raw.platforms as string[]) ?? ["upwork", "fiverr", "reddit", "clickworker"],
    bankroll: (raw.bankroll as number) ?? 0,
    hoursPerDay,
    dataDir: (raw.dataDir as string) ?? join(homedir(), ".openclaw", "otm"),
    // Signal notification settings — can be set via `notifications.signal`, `notifications.minScore`, etc.
    signalNotifications: Boolean(
      (notif.signal as boolean) ?? (raw.signalNotifications as boolean) ?? false,
    ),
    signalRecipients: (notif.recipients as string[]) ?? (raw.signalRecipients as string[]) ?? [],
    signalMinScore: (notif.minScore as number) ?? (raw.signalMinScore as number) ?? 80,
    signalNotifyTypes: (notif.types as string[]) ??
      (raw.signalNotifyTypes as string[]) ?? ["opportunity", "quickWin", "achievement"],
  };
}

interface OTMOpportunity {
  id: string;
  source: string;
  description: string;
  amount: string;
  score: number;
  scoreFactors: {
    timeToFirstDollar: number;
    effort: number;
    capital: number;
    skill: number;
    scalability: number;
  };
  riskLevel: "Low" | "Medium" | "High";
  trend: "rising" | "stable" | "declining";
  detectedAt: string;
}

interface OTMStrategy {
  id: string;
  title: string;
  minBankroll: number;
  maxBankroll: number;
  category: string;
  steps: string[];
}

interface OTMMetrics {
  totalOpportunitiesScanned: number;
  highScoreOpportunities: number;
  estimatedEarningsIfExecuted: number;
  quickWinsCount: number;
  conversionRate: number;
  activeStrategies: number;
}

/**
 * Send a Signal notification to all configured recipients.
 * Failures are logged but never thrown — notifications are best-effort.
 */
async function sendSignalNotification(
  recipients: string[],
  message: string,
): Promise<{ sent: number; errors: string[] }> {
  const errors: string[] = [];
  let sent = 0;
  for (const recipient of recipients) {
    try {
      await sendMessageSignal(recipient, message, {});
      sent++;
    } catch (err) {
      errors.push(`${recipient}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { sent, errors };
}

/**
 * Convert a JobListing from the job engine into an OTMOpportunity with local scoring.
 * Score factors:
 *   - timeToFirstDollar: fixed/micro_task = higher (faster payout)
 *   - effort: fewer estimatedHours = higher
 *   - capital: always 90 (no capital required for freelance)
 *   - skill: proportion of requiredSkills that are "common" skills
 *   - scalability: content/code = 60, micro_task = 40, others = 50
 */
function jobListingToOpportunity(job: JobListing, config: OTMConfig): OTMOpportunity {
  // Time to first dollar — lower hours and fixed pay = faster
  const ttfd =
    job.payType === "per_task" || job.payType === "fixed"
      ? job.estimatedHours <= 2
        ? 90
        : job.estimatedHours <= 8
          ? 75
          : 60
      : job.estimatedHours <= 4
        ? 65
        : 50;

  // Effort score — inversely proportional to estimatedHours (1h=95, 40h=20)
  const effort = Math.max(20, Math.round(100 - job.estimatedHours * 2.5));

  // Capital score — freelance needs no upfront capital
  const capital = 90;

  // Skill match — count how many required skills are common/popular
  const commonSkills = new Set([
    "writing",
    "research",
    "english",
    "data entry",
    "typing",
    "transcription",
    "python",
    "javascript",
    "react",
    "node",
    "excel",
    "photoshop",
    "seo",
    "social media",
    "translation",
    "copywriting",
    "proofreading",
  ]);
  const matchCount = job.requiredSkills.filter((s) => commonSkills.has(s.toLowerCase())).length;
  const skill =
    job.requiredSkills.length === 0
      ? 70
      : Math.min(100, Math.round(50 + (matchCount / job.requiredSkills.length) * 50));

  // Scalability by category
  const scalabilityMap: Record<string, number> = {
    content_writing: 65,
    code_generation: 65,
    data_annotation: 55,
    social_media: 60,
    seo: 60,
    research: 55,
    micro_task: 40,
    translation: 50,
    virtual_assistant: 45,
    ecommerce_selling: 70,
    music_licensing: 75,
    other: 50,
  };
  const scalability = scalabilityMap[job.category] ?? 50;

  const rawScore = ttfd * 0.3 + effort * 0.25 + capital * 0.15 + skill * 0.2 + scalability * 0.1;
  const score = Math.min(100, Math.round(rawScore));

  // Risk level from client rating
  const riskLevel: "Low" | "Medium" | "High" =
    job.clientRating >= 4.5 ? "Low" : job.clientRating >= 4.0 ? "Medium" : "High";

  // Trend based on platform recency
  const ageMs = Date.now() - new Date(job.postedAt).getTime();
  const trend: "rising" | "stable" | "declining" =
    ageMs < 3600000 ? "rising" : ageMs < 86400000 ? "stable" : "declining";

  const amountStr = job.payType === "hourly" ? `$${job.payAmount}/hr` : `$${job.payAmount}`;

  return {
    id: job.id,
    source: job.platform,
    description: job.title,
    amount: amountStr,
    score,
    scoreFactors: { timeToFirstDollar: ttfd, effort, capital, skill, scalability },
    riskLevel,
    trend,
    detectedAt: job.postedAt,
  };
}

/** Strategy decision table keyed by bankroll tiers and risk tolerance. */
function buildLocalStrategies(
  bankroll: number,
  hoursPerDay: number,
  riskTolerance: string,
): OTMStrategy[] {
  const strategies: OTMStrategy[] = [];

  // Always available: zero-capital micro-tasks and content writing
  if (hoursPerDay >= 1) {
    strategies.push({
      id: "micro-tasks",
      title: "Micro-Tasks (Clickworker / Appen)",
      minBankroll: 0,
      maxBankroll: 999999,
      category: "micro_task",
      steps: [
        "Sign up for Clickworker and Appen (free, approved within 24h)",
        "Complete onboarding qualification tests",
        "Accept tasks during peak hours (8am–12pm EST)",
        "Target UHRS / Search evaluation tasks ($12–18/hr equivalent)",
        "Withdraw earnings weekly via PayPal or direct deposit",
      ],
    });

    strategies.push({
      id: "content-writing",
      title: "Content Writing (Upwork / WWR)",
      minBankroll: 0,
      maxBankroll: 999999,
      category: "content_writing",
      steps: [
        "Create Upwork profile with writing samples (use AI to draft 3 portfolio pieces)",
        "Bid on entry-level blog posts ($15–35 per article)",
        "Deliver within 24h and request 5-star review",
        "Raise rates after 5 reviews to $50–80/article",
        "Scale to 3–5 articles/day using AI-assisted writing",
      ],
    });
  }

  // Low-bankroll: data annotation and SEO
  if (bankroll >= 0 && riskTolerance !== "high") {
    strategies.push({
      id: "data-annotation",
      title: "AI Data Annotation (Scale AI / Labelbox)",
      minBankroll: 0,
      maxBankroll: 500,
      category: "data_annotation",
      steps: [
        "Apply to Scale AI tasker program (approval 1–3 days)",
        "Focus on NLP and image annotation tasks",
        "Aim for 95%+ quality score to unlock premium tasks",
        "Target 2–4 hours/day at $10–20/hr effective rate",
        "Reinvest first $50 into Upwork connects for writing gigs",
      ],
    });
  }

  // Mid bankroll: freelance code, digital products
  if (bankroll >= 100 || riskTolerance === "medium" || riskTolerance === "high") {
    strategies.push({
      id: "code-freelance",
      title: "Freelance Code & Scripts (Upwork / Freelancer)",
      minBankroll: 0,
      maxBankroll: 999999,
      category: "code_generation",
      steps: [
        "Build 2–3 portfolio scripts (web scraper, automation tool, REST API)",
        "Create Upwork profile highlighting specific tech stack",
        "Bid on fixed-price jobs $50–200 (faster than hourly for new accounts)",
        "Use AI to accelerate delivery — bill for full scope, not AI time",
        "Upsell maintenance retainers after first delivery",
      ],
    });
  }

  // Higher bankroll: digital products and ecommerce
  if (bankroll >= 200 && (riskTolerance === "medium" || riskTolerance === "high")) {
    strategies.push({
      id: "digital-products",
      title: "Digital Products (Gumroad / Etsy)",
      minBankroll: 50,
      maxBankroll: 999999,
      category: "ecommerce_selling",
      steps: [
        "Create 3–5 digital templates (Notion, Canva, spreadsheets) in a weekend",
        "List on Gumroad at $7–27 price point",
        "Drive traffic via Reddit (r/productivity, r/digitalnomad) with value posts",
        "Reinvest first $200 in targeted Pinterest/Reddit ads",
        "Build email list from buyers for future product launches",
      ],
    });
  }

  // High risk / high bankroll: trading and music licensing
  if (bankroll >= 500 && riskTolerance === "high") {
    strategies.push({
      id: "music-licensing",
      title: "Music Licensing (DistroKid / Epidemic Sound)",
      minBankroll: 20,
      maxBankroll: 999999,
      category: "music_licensing",
      steps: [
        "Generate 10 royalty-free tracks using Suno AI or Udio ($20/mo subscription)",
        "Submit to Epidemic Sound, Artlist, and Musicbed for sync licensing",
        "Upload to DistroKid ($22/yr) for streaming royalties",
        "Pitch tracks to YouTube channels in your genre via email outreach",
        "Reinvest sync licensing income into more AI music generation",
      ],
    });
  }

  return strategies;
}

/** Local fallback analysis when LLM is unavailable. Deterministic, no random. */
function buildFallbackAnalysis(
  description: string,
  source: string,
  timeAvailable: number,
  skills: string[],
): {
  feasibilityScore: number;
  riskLevel: "Low" | "Medium" | "High";
  recommendedApproach: string;
  potentialRisks: string[];
  nextSteps: string[];
  timeToFirstDollar: string;
  confidenceScore: number;
  scoreBreakdown: {
    timeToFirstDollar: number;
    effort: number;
    capital: number;
    skill: number;
    scalability: number;
  };
} {
  const desc = description.toLowerCase();

  // Estimate feasibility from keyword heuristics
  const isQuick = /micro.task|annotation|transcri|survey|label|caption|data entry|review/i.test(
    desc,
  );
  const isSkilled = /code|develop|engineer|react|python|typescript|node|api|sql/i.test(desc);
  const isContent = /blog|article|writing|copywriting|content|newsletter/i.test(desc);

  const ttfd = isQuick ? 85 : isContent ? 70 : 60;
  const effort = timeAvailable <= 4 ? 80 : timeAvailable <= 10 ? 65 : 50;
  const capital = 90;
  const skill = skills.length >= 3 ? 80 : skills.length >= 1 ? 65 : 55;
  const scalability = isSkilled ? 65 : isContent ? 60 : 45;

  const feasibilityScore = Math.round(
    ttfd * 0.3 + effort * 0.25 + capital * 0.15 + skill * 0.2 + scalability * 0.1,
  );

  const riskLevel: "Low" | "Medium" | "High" =
    feasibilityScore >= 75 ? "Low" : feasibilityScore >= 55 ? "Medium" : "High";

  const timeToFirstDollar = isQuick
    ? "1–4 hours"
    : isContent
      ? "4–24 hours"
      : `${Math.max(1, Math.round(timeAvailable * 0.5))}–${timeAvailable} hours`;

  return {
    feasibilityScore,
    riskLevel,
    recommendedApproach: isQuick
      ? "Start immediately — low barrier to entry. Complete onboarding/qualification first."
      : isSkilled
        ? "Create a minimal working demo first, then bid. Price by deliverable scope, not hours."
        : "Build one strong portfolio sample, then apply selectively to maximize acceptance rate.",
    potentialRisks: [
      "Platform account review/suspension if quality drops below threshold",
      "Payment delay (7–14 days typical for new accounts)",
      `${riskLevel === "High" ? "High" : "Moderate"} competition — differentiate with fast turnaround`,
    ],
    nextSteps: [
      `Review the ${source} platform terms and payout methods`,
      "Complete any required qualification/onboarding steps",
      skills.length > 0
        ? `Highlight your ${skills.slice(0, 2).join(" and ")} skills in your profile`
        : "Build a 1–2 paragraph profile highlighting your strongest capabilities",
      "Apply to 3–5 entry-level opportunities to build reviews",
      "Track earnings weekly and reinvest into higher-value opportunities",
    ],
    timeToFirstDollar,
    confidenceScore: skills.length >= 2 ? 72 : 58,
    scoreBreakdown: { timeToFirstDollar: ttfd, effort, capital, skill, scalability },
  };
}

/**
 * Call the OTM Agent backend API with retry logic.
 * All endpoints are relative to `config.apiUrl` (defaults to http://localhost:3001).
 * Retries up to 3 times with exponential backoff for transient failures.
 */
async function callOTMApi(
  config: OTMConfig,
  method: "GET" | "POST",
  path: string,
  params?: Record<string, unknown>,
): Promise<unknown> {
  const url = new URL(path, config.apiUrl);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const init: RequestInit = { method, headers, signal: AbortSignal.timeout(30_000) };
  if (method === "GET" && params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
      }
    }
  } else if (method === "POST" && params) {
    init.body = JSON.stringify(params);
  }

  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const resp = await fetch(url.toString(), init);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        // Don't retry client errors (4xx) — only server errors (5xx)
        if (resp.status >= 400 && resp.status < 500) {
          throw new Error(`OTM Agent API ${method} ${path} failed (${resp.status}): ${text}`);
        }
        throw new Error(`OTM Agent API ${method} ${path} server error (${resp.status}): ${text}`);
      }
      return resp.json();
    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1;
      // Don't retry client errors or abort signals
      const isClientError = err instanceof Error && err.message.includes("failed (4");
      if (isLastAttempt || isClientError) {
        throw err;
      }
      // Exponential backoff: 500ms, 1000ms, 2000ms
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
  // Unreachable, but satisfies TypeScript
  throw new Error(`OTM Agent API ${method} ${path} failed after ${maxRetries} retries`);
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "OTM Agent",
  description:
    "Out The Mud bootstrapping system for micro-entrepreneurship and small-scale trading",
  register(api) {
    // ----- Provider auth -----
    api.registerProvider({
      id: PROVIDER_ID,
      label: "OTM Agent",
      docsPath: "/providers/otm-agent",
      envVars: ["OTM_API_KEY", "OTM_API_URL"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "OTM Agent API key",
          hint: "API key for OTM Agent service",
          optionKey: "otmApiKey",
          flagName: "--otm-api-key",
          envVar: "OTM_API_KEY",
          promptMessage: "Enter OTM Agent API key",
          defaultModel: "claude-3-5-sonnet-20241022",
          expectedProviders: ["otm-agent"],
          applyConfig: (cfg) => {
            // Apply OTM Agent configuration
            return cfg;
          },
          wizard: {
            choiceId: "otm-api-key",
            choiceLabel: "OTM Agent API key",
            choiceHint: "API key for OTM Agent bootstrapping system",
            groupId: "finance",
            groupLabel: "Finance",
            groupHint: "Finance and trading management",
          },
        }),
      ],
    });

    // ----- Config -----
    const pluginCfg = (api.pluginConfig ?? {}) as Record<string, unknown>;
    // Kick off async load of runtime overrides (bankroll etc.) — awaited inside each handler
    const runtimeOverridesPromise = loadRuntimeOverrides();
    // Synchronous config snapshot (bankroll from overrides merged in after first handler awaits)
    const config = readOTMConfig(pluginCfg);
    // Apply overrides once loaded — this fires immediately but handlers still await the promise
    void runtimeOverridesPromise.then((overrides) => {
      if (typeof overrides.bankroll === "number") {
        config.bankroll = overrides.bankroll;
      }
    });

    // ----- Agent tools -----

    // ══════════════════════════════════════════════════════════════════════════
    // FIRST TASK: Autonomous Cloudflare Pages deployment of the TapClaw store
    // This is the first thing TapClaw does — push the sales website live.
    // ══════════════════════════════════════════════════════════════════════════
    api.registerTool(
      {
        label: "otm_deploy_store",
        name: "otm_deploy_store",
        description:
          "Deploy the TapClaw sales website (store/) to Cloudflare Pages autonomously. " +
          "Builds the Next.js site, creates the CF Pages project if needed, uploads all " +
          "static assets, pushes secrets, and binds the custom domain. " +
          "This is TapClaw's first autonomous task — run it immediately on startup.",
        parameters: Type.Object({
          accountId: Type.Optional(
            Type.String({
              description: "Cloudflare Account ID. Defaults to CF_ACCOUNT_ID env var.",
            }),
          ),
          apiToken: Type.Optional(
            Type.String({
              description:
                "Cloudflare API token with Pages:Edit permission. Defaults to CF_API_TOKEN env var.",
            }),
          ),
          projectName: Type.Optional(
            Type.String({
              description:
                "Cloudflare Pages project name. Defaults to CF_PAGES_PROJECT env var or 'tapclaw-store'.",
            }),
          ),
          domain: Type.Optional(
            Type.String({
              description:
                "Custom domain to bind (e.g. 'tapclaw.ai'). Defaults to CF_DOMAIN env var.",
            }),
          ),
          storeDir: Type.Optional(
            Type.String({
              description: "Absolute path to the store/ directory. Auto-detected if not set.",
            }),
          ),
          stripeSecretKey: Type.Optional(
            Type.String({
              description: "Stripe secret key to push as a CF Pages secret.",
            }),
          ),
          stripeWebhookSecret: Type.Optional(
            Type.String({
              description: "Stripe webhook secret to push as a CF Pages secret.",
            }),
          ),
          gatewayToken: Type.Optional(
            Type.String({
              description: "TapClaw gateway bearer token to push as a CF Pages secret.",
            }),
          ),
        }),
        execute: async (_callId, input: any) => {
          const accountId = input.accountId || process.env.CF_ACCOUNT_ID || "";
          const apiToken =
            input.apiToken ||
            process.env.CF_API_TOKEN ||
            decryptConfigValue(pluginCfg.cfApiToken) ||
            "";
          const projectName = input.projectName || process.env.CF_PAGES_PROJECT || "tapclaw-store";
          const domain = input.domain || process.env.CF_DOMAIN || undefined;
          const storeDir = resolveStoreDir(input.storeDir);

          if (!accountId) {
            const errResult = {
              success: false,
              error:
                "Cloudflare Account ID is required. Set CF_ACCOUNT_ID env var or pass accountId.",
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(errResult) }],
              details: errResult,
            };
          }
          if (!apiToken) {
            const errResult = {
              success: false,
              error: "Cloudflare API token is required. Set CF_API_TOKEN env var or pass apiToken.",
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(errResult) }],
              details: errResult,
            };
          }

          // Collect secrets to push
          const secrets: Record<string, string> = {};
          const stripeKey = input.stripeSecretKey || process.env.STRIPE_SECRET_KEY || "";
          const stripeWebhook =
            input.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "";
          const gwToken = input.gatewayToken || process.env.TAPCLAW_GATEWAY_TOKEN || "";
          if (stripeKey) secrets["STRIPE_SECRET_KEY"] = stripeKey;
          if (stripeWebhook) secrets["STRIPE_WEBHOOK_SECRET"] = stripeWebhook;
          if (gwToken) secrets["TAPCLAW_GATEWAY_TOKEN"] = gwToken;
          // Always set the public site URL from the domain
          if (domain) secrets["NEXT_PUBLIC_SITE_URL"] = `https://${domain}`;

          const result = await deployStoreToCloudflarepages({
            accountId,
            apiToken,
            projectName,
            domain,
            storeDir,
            secrets,
          });

          return {
            content: [{ type: "text" as const, text: JSON.stringify(result) }],
            details: result,
          };
        },
      },
      { name: "otm_deploy_store" },
    );

    api.registerTool(
      {
        label: "otm_scan_opportunities",
        name: "otm_scan_opportunities",
        description: "Scan for new money-making opportunities using OTM Agent",
        parameters: Type.Object({
          platforms: Type.Optional(
            Type.Array(Type.String(), {
              description: "Platforms to scan (upwork, fiverr, reddit, clickworker, etc.)",
            }),
          ),
          minScore: Type.Optional(
            Type.Number({
              description: "Minimum score threshold (0-100)",
              minimum: 0,
              maximum: 100,
            }),
          ),
          limit: Type.Optional(
            Type.Number({
              description: "Maximum number of opportunities to return",
              minimum: 1,
              maximum: 100,
            }),
          ),
          notifySignal: Type.Optional(
            Type.Boolean({
              description:
                "Send high-score opportunities to configured Signal recipients (overrides config setting)",
            }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const minScore = input.minScore ?? config.minScoreThreshold;
            const limit = input.limit ?? config.maxOpportunities;
            const shouldNotify: boolean =
              typeof input.notifySignal === "boolean"
                ? input.notifySignal
                : config.signalNotifications;

            // Use the local job engine to scan — no external service required
            const overrides = await runtimeOverridesPromise;
            if (typeof overrides.bankroll === "number") config.bankroll = overrides.bankroll;

            const engine = getJobEngine(config.dataDir);
            const listings = await engine.scanOnly();

            // Convert JobListing → OTMOpportunity with local scoring
            const opportunities: OTMOpportunity[] = listings
              .map((job) => jobListingToOpportunity(job, config))
              .filter((opp) => opp.score >= minScore)
              .sort((a, b) => b.score - a.score)
              .slice(0, limit);

            // Send Signal notifications for high-score opportunities
            let signalResult: { sent: number; errors: string[] } | null = null;
            if (shouldNotify && config.signalRecipients.length > 0 && opportunities.length > 0) {
              const notifyThreshold = config.signalMinScore;
              const notifiable = opportunities.filter((o) => o.score >= notifyThreshold);
              if (notifiable.length > 0) {
                const lines = [
                  `OTM Agent found ${notifiable.length} high-score opportunity${notifiable.length === 1 ? "" : "s"}:`,
                  ...notifiable.map(
                    (o) =>
                      `• [${o.source}] ${o.description} — ${o.amount} (score: ${o.score}/100, risk: ${o.riskLevel})`,
                  ),
                  `Scanned at ${new Date().toLocaleString()}`,
                ];
                signalResult = await sendSignalNotification(
                  config.signalRecipients,
                  lines.join("\n"),
                );
              }
            }

            const __res = {
              success: true,
              opportunities,
              scanTime: new Date().toISOString(),
              totalFound: opportunities.length,
              ...(signalResult !== null && { signalNotification: signalResult }),
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_scan_opportunities" },
    );

    api.registerTool(
      {
        label: "otm_get_strategies",
        name: "otm_get_strategies",
        description: "Get recommended strategies based on current bankroll and goals",
        parameters: Type.Object({
          bankroll: Type.Optional(
            Type.Number({ description: "Current available capital", minimum: 0 }),
          ),
          hoursPerDay: Type.Optional(
            Type.Number({
              description: "Hours available per day for execution",
              minimum: 1,
              maximum: 24,
            }),
          ),
          riskTolerance: Type.Optional(
            Type.String({ description: "Risk tolerance level (low, medium, high)" }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const overrides = await runtimeOverridesPromise;
            if (typeof overrides.bankroll === "number") config.bankroll = overrides.bankroll;

            const bankroll = input.bankroll ?? config.bankroll;
            const hoursPerDay = input.hoursPerDay ?? config.hoursPerDay;
            const riskTolerance: string = input.riskTolerance || "medium";

            // Compute strategy recommendations locally from a decision table —
            // no external service required.
            const recommendedStrategies = buildLocalStrategies(
              bankroll,
              hoursPerDay,
              riskTolerance,
            );

            const topTitles = recommendedStrategies
              .slice(0, 2)
              .map((s) => s.title)
              .join(" and ");
            const __res = {
              success: true,
              strategies: recommendedStrategies,
              bankroll,
              hoursPerDay,
              riskTolerance,
              recommendation:
                recommendedStrategies.length > 0
                  ? `Based on your bankroll of $${bankroll} and ${hoursPerDay} hours/day, focus on ${topTitles}.`
                  : `No matching strategies found for bankroll $${bankroll}. Consider starting with micro-tasks to build capital.`,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_get_strategies" },
    );

    /**
     * otm_quick_scan — fast single-platform scan (top 5 results, 8s timeout).
     * Useful for real-time checks without the full multi-platform sweep latency.
     */
    api.registerTool(
      {
        label: "otm_quick_scan",
        name: "otm_quick_scan",
        description:
          "Rapid opportunity scan on one platform — returns up to 5 results with minimal latency. Use when you need a fast pulse check rather than the full multi-platform sweep.",
        parameters: Type.Object({
          platform: Type.Optional(
            Type.String({
              description:
                "Platform to scan (upwork, fiverr, reddit, clickworker, etc.). Defaults to the first configured platform.",
            }),
          ),
          minScore: Type.Optional(
            Type.Number({
              description: "Minimum score threshold (0-100). Defaults to config.",
              minimum: 0,
              maximum: 100,
            }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const platform = input.platform ?? config.platforms[0] ?? "upwork";
            const minScore = input.minScore ?? config.minScoreThreshold;

            // Use local job engine with an 8-second abort to keep latency tight
            const engine = getJobEngine(config.dataDir);
            const scanPromise = engine.scanOnly();
            const timeoutPromise = new Promise<JobListing[]>((_, reject) =>
              setTimeout(() => reject(new Error("Quick scan timed out after 8s")), 8000),
            );
            const allListings = await Promise.race([scanPromise, timeoutPromise]);

            const opportunities = allListings
              .filter((job) => job.platform === platform || job.platform.includes(platform))
              .map((job) => jobListingToOpportunity(job, config))
              .filter((opp) => opp.score >= minScore)
              .sort((a, b) => b.score - a.score)
              .slice(0, 5);

            const __res = {
              success: true,
              platform,
              opportunities,
              count: opportunities.length,
              scanTime: new Date().toISOString(),
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_quick_scan" },
    );

    api.registerTool(
      {
        label: "otm_analyze_opportunity",
        name: "otm_analyze_opportunity",
        description: "Analyze a specific opportunity with AI for feasibility and risk",
        parameters: Type.Object({
          description: Type.String({ description: "Description of the opportunity" }),
          source: Type.String({ description: "Source platform (Upwork, Fiverr, Reddit, etc.)" }),
          amount: Type.Optional(Type.String({ description: "Potential earnings amount" })),
          timeAvailable: Type.Optional(
            Type.Number({
              description: "Hours available to work on this",
              minimum: 0.5,
              maximum: 40,
            }),
          ),
          skills: Type.Optional(
            Type.Array(Type.String(), { description: "Relevant skills you possess" }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const { description, source, amount, timeAvailable = 2, skills = [] } = input;

            // Use local LLM executor to analyze the opportunity — no backend needed
            const prompt = [
              `Analyze this freelance/micro-task opportunity for feasibility and risk.`,
              `Platform: ${source}`,
              `Description: ${description}`,
              amount ? `Potential earnings: ${amount}` : "",
              `Time available: ${timeAvailable} hours`,
              skills.length > 0 ? `Your skills: ${skills.join(", ")}` : "",
              "",
              `Return a JSON object with:`,
              `- feasibilityScore: 0-100 integer`,
              `- riskLevel: "Low"|"Medium"|"High"`,
              `- recommendedApproach: string (1-2 sentences)`,
              `- potentialRisks: string[] (3 items)`,
              `- nextSteps: string[] (3-5 concrete steps)`,
              `- timeToFirstDollar: string (e.g. "2-4 hours", "1-3 days")`,
              `- confidenceScore: 0-100 integer`,
              `- scoreBreakdown: { timeToFirstDollar: number, effort: number, capital: number, skill: number, scalability: number }`,
            ]
              .filter(Boolean)
              .join("\n");

            const llmResult = await executeLlmWork(
              "research",
              `Opportunity Analysis: ${source}`,
              prompt,
              skills,
            ).catch(() => null);

            // Parse LLM JSON if available, otherwise build a deterministic local analysis
            let analysis: {
              feasibilityScore: number;
              riskLevel: "Low" | "Medium" | "High";
              recommendedApproach: string;
              potentialRisks: string[];
              nextSteps: string[];
              timeToFirstDollar: string;
              confidenceScore: number;
              scoreBreakdown: {
                timeToFirstDollar: number;
                effort: number;
                capital: number;
                skill: number;
                scalability: number;
              };
            };

            const jsonMatch = llmResult?.deliverable.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              try {
                analysis = JSON.parse(jsonMatch[0]);
              } catch {
                analysis = buildFallbackAnalysis(description, source, timeAvailable, skills);
              }
            } else {
              analysis = buildFallbackAnalysis(description, source, timeAvailable, skills);
            }

            const recommendation =
              analysis.feasibilityScore >= 70
                ? `High feasibility (${analysis.feasibilityScore}/100). Recommended approach: ${analysis.recommendedApproach}`
                : analysis.feasibilityScore >= 45
                  ? `Moderate feasibility (${analysis.feasibilityScore}/100). Proceed with caution: ${analysis.recommendedApproach}`
                  : `Low feasibility (${analysis.feasibilityScore}/100). Consider skipping: ${analysis.recommendedApproach}`;

            const __res = {
              success: true,
              analysis,
              recommendation,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_analyze_opportunity" },
    );

    api.registerTool(
      {
        label: "otm_get_metrics",
        name: "otm_get_metrics",
        description: "Get OTM Agent performance metrics and dashboard data",
        parameters: Type.Object({
          period: Type.Optional(
            Type.Unsafe<"day" | "week" | "month" | "all">({
              type: "string",
              enum: ["day", "week", "month", "all"],
              description: "Time period for metrics",
            }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const period = input.period || "week";

            // Read directly from the local job engine and payout engine —
            // no external service required.
            const engine = getJobEngine(config.dataDir);
            const state = engine.getState();
            const summary = engine.getEarningsSummary();
            const withdrawalStats = await getWithdrawalStats();

            // Compute period-scoped earnings
            const periodEarnings =
              period === "day"
                ? summary.today
                : period === "week"
                  ? summary.thisWeek
                  : period === "month"
                    ? summary.thisMonth
                    : summary.allTime;

            // Count high-score jobs (net > $20 proxy for "high score")
            const highScoreJobs = state.recentJobs.filter((j) => j.netEarnings >= 20).length;
            const quickWins = state.recentJobs.filter(
              (j) => j.netEarnings > 0 && j.aiCost < 0.5,
            ).length;
            const conversionRate =
              state.totalJobsDiscovered > 0
                ? Math.round((state.totalJobsCompleted / state.totalJobsDiscovered) * 100) / 100
                : 0;

            const metrics: OTMMetrics = {
              totalOpportunitiesScanned: state.totalJobsDiscovered,
              highScoreOpportunities: highScoreJobs,
              estimatedEarningsIfExecuted: periodEarnings,
              quickWinsCount: quickWins,
              conversionRate,
              activeStrategies: state.activeJobs.length,
            };

            const insights: string[] = [
              `Scanned ${metrics.totalOpportunitiesScanned} opportunities total; ${metrics.highScoreOpportunities} scored high.`,
              metrics.conversionRate > 0
                ? `Conversion rate: ${(metrics.conversionRate * 100).toFixed(1)}% (${state.totalJobsCompleted} completed of ${state.totalJobsDiscovered} discovered).`
                : "No jobs completed yet — start the engine to begin earning.",
              withdrawalStats.totalWithdrawn > 0
                ? `Total withdrawn: $${withdrawalStats.totalWithdrawn.toFixed(2)} across ${withdrawalStats.withdrawalCount} payout(s).`
                : "No payouts processed yet.",
              `Net earnings (${period}): $${periodEarnings.toFixed(2)}.`,
            ];

            const __res = {
              success: true,
              metrics,
              period,
              lastUpdated: new Date().toISOString(),
              insights,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_get_metrics" },
    );

    // ----- Account Management Tools -----
    api.registerTool(
      {
        label: "otm_add_account",
        name: "otm_add_account",
        description: "Add a new platform account with encrypted storage",
        parameters: Type.Object({
          platform: Type.String({
            description: "Platform name (upwork, fiverr, reddit, clickworker, etc.)",
          }),
          type: Type.String({
            description:
              "Account type (upwork, fiverr, reddit, clickworker, appen, scaleai, gumroad, etsy, makecom, notion, other)",
          }),
          username: Type.Optional(Type.String({ description: "Platform username" })),
          email: Type.Optional(Type.String({ description: "Account email" })),
          apiKey: Type.Optional(Type.String({ description: "API key (will be encrypted)" })),
          apiSecret: Type.Optional(Type.String({ description: "API secret (will be encrypted)" })),
          accessToken: Type.Optional(
            Type.String({ description: "Access token (will be encrypted)" }),
          ),
          refreshToken: Type.Optional(
            Type.String({ description: "Refresh token (will be encrypted)" }),
          ),
          expiresAt: Type.Optional(
            Type.String({ description: "Token expiration date (ISO format)" }),
          ),
          enabled: Type.Optional(Type.Boolean({ description: "Whether account is enabled" })),
          metadata: Type.Optional(
            Type.Record(Type.String(), Type.Unknown(), {
              description: "Additional account metadata",
            }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const store = await getAccountStore(config.dataDir as string);

            // Validate credentials
            const validation = validatePlatformCredentials(input.platform, input);
            if (!validation.valid) {
              return {
                content: [
                  {
                    type: "text",
                    text:
                      "Error: " + String(`Invalid credentials: ${validation.errors.join(", ")}`),
                  },
                ],
                details: {
                  success: false,
                  error: `Invalid credentials: ${validation.errors.join(", ")}`,
                },
              };
            }

            const account = await store.addAccount({
              type: input.type as AccountType,
              platform: input.platform,
              username: input.username,
              email: input.email,
              apiKey: input.apiKey,
              apiSecret: input.apiSecret,
              accessToken: input.accessToken,
              refreshToken: input.refreshToken,
              expiresAt: input.expiresAt,
              enabled: input.enabled !== false,
              metadata: input.metadata,
            });

            const __res = {
              success: true,
              account: {
                id: account.id,
                platform: account.platform,
                type: account.type,
                username: account.username,
                email: account.email ? maskSecret(account.email) : undefined,
                enabled: account.enabled,
                createdAt: account.createdAt,
              },
              message: `Account added successfully. ID: ${account.id}`,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_add_account" },
    );

    api.registerTool(
      {
        label: "otm_list_accounts",
        name: "otm_list_accounts",
        description: "List all stored platform accounts",
        parameters: Type.Object({
          platform: Type.Optional(Type.String({ description: "Filter by platform" })),
          type: Type.Optional(Type.String({ description: "Filter by account type" })),
          enabled: Type.Optional(Type.Boolean({ description: "Filter by enabled status" })),
        }),
        execute: async (_callId, input: any) => {
          try {
            const store = await getAccountStore(config.dataDir as string);
            let accounts = await store.listAccounts();

            // Apply filters
            if (input.platform) {
              accounts = accounts.filter((acc) =>
                acc.platform.toLowerCase().includes(input.platform.toLowerCase()),
              );
            }
            if (input.type) {
              accounts = accounts.filter((acc) => acc.type === input.type);
            }
            if (input.enabled !== undefined) {
              accounts = accounts.filter((acc) => acc.enabled === input.enabled);
            }

            // Mask sensitive data
            const safeAccounts = accounts.map((acc) => ({
              id: acc.id,
              platform: acc.platform,
              type: acc.type,
              username: acc.username,
              email: acc.email ? maskSecret(acc.email) : undefined,
              enabled: acc.enabled,
              lastUsed: acc.lastUsed,
              createdAt: acc.createdAt,
              updatedAt: acc.updatedAt,
            }));

            const stats = await store.getStats();

            const __res = {
              success: true,
              accounts: safeAccounts,
              stats,
              total: safeAccounts.length,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_list_accounts" },
    );

    api.registerTool(
      {
        label: "otm_get_account",
        name: "otm_get_account",
        description: "Get detailed information about a specific account",
        parameters: Type.Object({
          id: Type.String({ description: "Account ID" }),
        }),
        execute: async (_callId, input: any) => {
          try {
            const store = await getAccountStore(config.dataDir as string);
            const account = await store.getAccount(input.id);

            if (!account) {
              return {
                content: [
                  { type: "text", text: "Error: " + String(`Account not found: ${input.id}`) },
                ],
                details: { success: false, error: `Account not found: ${input.id}` },
              };
            }

            // Validate account status
            const validation = await store.validateAccount(input.id);

            // Return safe account info (mask sensitive data)
            const __res = {
              success: true,
              account: {
                id: account.id,
                platform: account.platform,
                type: account.type,
                username: account.username,
                email: account.email ? maskSecret(account.email) : undefined,
                enabled: account.enabled,
                lastUsed: account.lastUsed,
                createdAt: account.createdAt,
                updatedAt: account.updatedAt,
                metadata: account.metadata,
              },
              validation,
              hasApiKey: !!account.apiKey,
              hasAccessToken: !!account.accessToken,
              isExpired: account.expiresAt ? new Date(account.expiresAt) < new Date() : false,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_get_account" },
    );

    api.registerTool(
      {
        label: "otm_update_account",
        name: "otm_update_account",
        description: "Update an existing platform account",
        parameters: Type.Object({
          id: Type.String({ description: "Account ID" }),
          enabled: Type.Optional(Type.Boolean({ description: "Enable/disable account" })),
          apiKey: Type.Optional(Type.String({ description: "New API key" })),
          accessToken: Type.Optional(Type.String({ description: "New access token" })),
          refreshToken: Type.Optional(Type.String({ description: "New refresh token" })),
          expiresAt: Type.Optional(Type.String({ description: "New expiration date" })),
          metadata: Type.Optional(
            Type.Record(Type.String(), Type.Unknown(), { description: "Updated metadata" }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const store = await getAccountStore(config.dataDir as string);

            const updates: any = {};
            if (input.enabled !== undefined) updates.enabled = input.enabled;
            if (input.apiKey !== undefined) updates.apiKey = input.apiKey;
            if (input.accessToken !== undefined) updates.accessToken = input.accessToken;
            if (input.refreshToken !== undefined) updates.refreshToken = input.refreshToken;
            if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt;
            if (input.metadata !== undefined) updates.metadata = input.metadata;

            const updated = await store.updateAccount(input.id, updates);

            if (!updated) {
              return {
                content: [
                  { type: "text", text: "Error: " + String(`Account not found: ${input.id}`) },
                ],
                details: { success: false, error: `Account not found: ${input.id}` },
              };
            }

            const __res = {
              success: true,
              account: {
                id: updated.id,
                platform: updated.platform,
                type: updated.type,
                enabled: updated.enabled,
                updatedAt: updated.updatedAt,
              },
              message: "Account updated successfully",
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_update_account" },
    );

    api.registerTool(
      {
        label: "otm_delete_account",
        name: "otm_delete_account",
        description: "Delete a platform account",
        parameters: Type.Object({
          id: Type.String({ description: "Account ID" }),
          confirm: Type.Optional(Type.Boolean({ description: "Confirmation flag" })),
        }),
        execute: async (_callId, input: any) => {
          try {
            if (!input.confirm) {
              const __res = {
                success: false,
                error: "Confirmation required. Set confirm: true to delete account.",
                requiresConfirmation: true,
              };
              return {
                content: [{ type: "text" as const, text: JSON.stringify(__res) }],
                details: __res,
              };
            }

            const store = await getAccountStore(config.dataDir as string);
            const deleted = await store.deleteAccount(input.id);

            if (!deleted) {
              return {
                content: [
                  { type: "text", text: "Error: " + String(`Account not found: ${input.id}`) },
                ],
                details: { success: false, error: `Account not found: ${input.id}` },
              };
            }

            const __res = {
              success: true,
              message: `Account ${input.id} deleted successfully`,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_delete_account" },
    );

    api.registerTool(
      {
        label: "otm_validate_accounts",
        name: "otm_validate_accounts",
        description: "Validate all stored accounts and check their status",
        parameters: Type.Object({
          platform: Type.Optional(Type.String({ description: "Filter by platform" })),
        }),
        execute: async (_callId, input: any) => {
          try {
            const store = await getAccountStore(config.dataDir as string);
            let accounts = await store.listAccounts();

            if (input.platform) {
              accounts = accounts.filter((acc) =>
                acc.platform.toLowerCase().includes(input.platform.toLowerCase()),
              );
            }

            const results = [];
            for (const account of accounts) {
              const validation = await store.validateAccount(account.id);
              results.push({
                id: account.id,
                platform: account.platform,
                type: account.type,
                enabled: account.enabled,
                valid: validation.valid,
                reason: validation.reason,
                lastUsed: account.lastUsed,
                expiresAt: account.expiresAt,
                isExpired: account.expiresAt ? new Date(account.expiresAt) < new Date() : false,
              });
            }

            const validCount = results.filter((r) => r.valid).length;
            const expiredCount = results.filter((r) => r.isExpired).length;
            const disabledCount = results.filter((r) => !r.enabled).length;

            const __res = {
              success: true,
              results,
              summary: {
                total: results.length,
                valid: validCount,
                invalid: results.length - validCount,
                expired: expiredCount,
                disabled: disabledCount,
              },
              recommendations: [
                expiredCount > 0 ? `Renew ${expiredCount} expired token(s)` : null,
                disabledCount > 0 ? `Enable ${disabledCount} disabled account(s)` : null,
                validCount === 0 ? "Add at least one valid account to start scanning" : null,
              ].filter(Boolean),
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_validate_accounts" },
    );

    // ----- Signal notification tools -----
    api.registerTool(
      {
        label: "otm_signal_test",
        name: "otm_signal_test",
        description:
          "Test Signal notification delivery by sending a test message to configured recipients",
        parameters: Type.Object({
          recipients: Type.Optional(
            Type.Array(Type.String(), {
              description: "E.164 phone numbers to test (defaults to configured signalRecipients)",
            }),
          ),
          message: Type.Optional(
            Type.String({ description: "Custom test message (uses a default if omitted)" }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const recipients: string[] =
              (input.recipients as string[] | undefined) ?? config.signalRecipients;

            if (recipients.length === 0) {
              const __res = {
                success: false,
                error:
                  "No Signal recipients configured. Set otm-agent.notifications.recipients or pass recipients directly.",
              };
              return {
                content: [{ type: "text" as const, text: JSON.stringify(__res) }],
                details: __res,
              };
            }

            const msg: string =
              (input.message as string | undefined) ??
              `OTM Agent Signal test — connection verified at ${new Date().toLocaleString()}. High-score opportunity alerts are active.`;

            const signalResult = await sendSignalNotification(recipients, msg);

            const __res = {
              success: signalResult.sent > 0,
              sent: signalResult.sent,
              failed: signalResult.errors.length,
              errors: signalResult.errors,
              recipients,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_signal_test" },
    );

    api.registerTool(
      {
        label: "otm_signal_report",
        name: "otm_signal_report",
        description:
          "Send an on-demand OTM summary report (opportunities + metrics) via Signal to configured recipients",
        parameters: Type.Object({
          recipients: Type.Optional(
            Type.Array(Type.String(), {
              description:
                "E.164 phone numbers to send the report to (defaults to configured signalRecipients)",
            }),
          ),
          period: Type.Optional(
            Type.Unsafe<"day" | "week" | "month">({
              type: "string",
              enum: ["day", "week", "month"],
              description: "Report period (default: week)",
            }),
          ),
          minScore: Type.Optional(
            Type.Number({
              description: "Minimum score for opportunities included in the report (0-100)",
              minimum: 0,
              maximum: 100,
            }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const recipients: string[] =
              (input.recipients as string[] | undefined) ?? config.signalRecipients;

            if (recipients.length === 0) {
              const __res = {
                success: false,
                error:
                  "No Signal recipients configured. Set otm-agent.notifications.recipients or pass recipients directly.",
              };
              return {
                content: [{ type: "text" as const, text: JSON.stringify(__res) }],
                details: __res,
              };
            }

            const period: string = (input.period as string | undefined) ?? "week";

            // Pull real financial metrics from the revenue pipeline
            const { getOtmFinancialSummary } = await import("./src/finance-bridge.js");
            const financeSummary = await getOtmFinancialSummary();

            // Map period to the right aggregate field
            const earnedThisPeriod =
              period === "day"
                ? financeSummary.grossToday
                : period === "month"
                  ? financeSummary.grossThisMonth
                  : financeSummary.grossThisWeek;

            const baseMetrics = {
              grossEarnings: earnedThisPeriod,
              totalWithdrawn: financeSummary.totalWithdrawn,
              reinvested: financeSummary.reinvestedTotal,
              netAvailable: Math.max(
                0,
                financeSummary.grossThisMonth - financeSummary.totalWithdrawn,
              ),
              byPlatform: financeSummary.byPlatform,
            };

            // No static mock opportunities — report only live financial data

            const platformLines = Object.entries(baseMetrics.byPlatform).map(
              ([platform, amount]) => `  - ${platform}: $${(amount as number).toFixed(2)}`,
            );

            const lines = [
              `OTM Agent ${period.charAt(0).toUpperCase() + period.slice(1)}ly Report`,
              `Generated: ${new Date().toLocaleString()}`,
              "",
              "EARNINGS",
              `• Gross this ${period}: $${baseMetrics.grossEarnings.toFixed(2)}`,
              `• Total withdrawn: $${baseMetrics.totalWithdrawn.toFixed(2)}`,
              `• Reinvested: $${baseMetrics.reinvested.toFixed(2)}`,
              `• Net available: $${baseMetrics.netAvailable.toFixed(2)}`,
              ...(platformLines.length > 0
                ? ["", "BY PLATFORM", ...platformLines]
                : ["", "(No platform revenue recorded yet)"]),
            ];

            const signalResult = await sendSignalNotification(recipients, lines.join("\n"));

            const __res = {
              success: signalResult.sent > 0,
              sent: signalResult.sent,
              failed: signalResult.errors.length,
              errors: signalResult.errors,
              period,
              metrics: baseMetrics,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_signal_report" },
    );

    // ----- Payout Tools -----

    // Initialize payout engine on plugin load
    void initPayoutEngine();

    api.registerTool(
      {
        label: "otm_payout_setup",
        name: "otm_payout_setup",
        description:
          "Configure the payout destination for OTM earnings. Supports CashApp ($cashtag), SoFi bank (ACH via Mercury), or manual. Call this to set up or update where your earnings go.",
        parameters: Type.Object({
          destination: Type.Unsafe<"cashapp" | "sofi" | "manual">({
            type: "string",
            enum: ["cashapp", "sofi", "manual"],
            description: "Payout destination type",
          }),
          label: Type.Optional(Type.String({ description: "Friendly label for this config" })),
          enabled: Type.Optional(Type.Boolean({ description: "Enable this payout config" })),
          autoWithdraw: Type.Optional(
            Type.Boolean({ description: "Automatically withdraw when balance exceeds minimum" }),
          ),
          minWithdrawal: Type.Optional(
            Type.Number({
              description: "Minimum balance before auto-withdraw (default: $50)",
              minimum: 5,
            }),
          ),
          withdrawalPercent: Type.Optional(
            Type.Number({
              description: "Fraction of balance to withdraw (0-1, default: 0.8)",
              minimum: 0,
              maximum: 1,
            }),
          ),
          maxWithdrawal: Type.Optional(
            Type.Number({ description: "Maximum per withdrawal (default: $500)", minimum: 5 }),
          ),
          cashtag: Type.Optional(
            Type.String({ description: "CashApp $cashtag (e.g. $yourcashtag)" }),
          ),
          cashappApiKey: Type.Optional(
            Type.String({ description: "Square/CashApp Business API key for automated payouts" }),
          ),
          routingNumber: Type.Optional(
            Type.String({ description: "Bank routing number (9 digits)" }),
          ),
          accountNumber: Type.Optional(Type.String({ description: "Bank account number" })),
          accountType: Type.Optional(
            Type.Unsafe<"checking" | "savings">({
              type: "string",
              enum: ["checking", "savings"],
              description: "Bank account type",
            }),
          ),
          mercuryApiKey: Type.Optional(
            Type.String({ description: "Mercury API key for ACH transfers" }),
          ),
          mercuryAccountId: Type.Optional(
            Type.String({ description: "Mercury source account UUID" }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const existing = await loadActivePayoutConfig();
            const newConfig: PayoutConfig = {
              id: existing?.id ?? randomUUID().slice(0, 16),
              destination: input.destination,
              label: input.label ?? `${input.destination} payout`,
              enabled: input.enabled !== false,
              autoWithdraw: input.autoWithdraw ?? false,
              minWithdrawal: input.minWithdrawal ?? 50,
              withdrawalPercent: input.withdrawalPercent ?? 0.8,
              maxWithdrawal: input.maxWithdrawal ?? 500,
            };
            if (input.destination === "cashapp") {
              if (!input.cashtag) {
                const errRes = { success: false, error: "cashtag is required for CashApp payouts" };
                return {
                  content: [{ type: "text" as const, text: JSON.stringify(errRes) }],
                  details: errRes,
                };
              }
              newConfig.cashapp = {
                cashtag: input.cashtag.startsWith("$") ? input.cashtag : `$${input.cashtag}`,
                cashappApiKey: input.cashappApiKey,
              };
            } else if (input.destination === "sofi") {
              if (!input.routingNumber || !input.accountNumber) {
                const errRes = {
                  success: false,
                  error: "routingNumber and accountNumber are required for SoFi payouts",
                };
                return {
                  content: [{ type: "text" as const, text: JSON.stringify(errRes) }],
                  details: errRes,
                };
              }
              newConfig.sofi = {
                routingNumber: input.routingNumber,
                accountNumber: input.accountNumber,
                accountType: input.accountType ?? "checking",
                mercuryApiKey: input.mercuryApiKey,
                mercuryAccountId: input.mercuryAccountId,
              };
            }
            await savePayoutConfig(newConfig);
            const __res = {
              success: true,
              config: {
                id: newConfig.id,
                destination: newConfig.destination,
                label: newConfig.label,
                enabled: newConfig.enabled,
                autoWithdraw: newConfig.autoWithdraw,
                minWithdrawal: newConfig.minWithdrawal,
                maxWithdrawal: newConfig.maxWithdrawal,
                cashtag: newConfig.cashapp?.cashtag,
                hasCashAppApiKey: !!newConfig.cashapp?.cashappApiKey,
                hasMercuryKey: !!newConfig.sofi?.mercuryApiKey,
              },
              message: `Payout config saved. Destination: ${newConfig.destination}${newConfig.cashapp?.cashtag ? ` (${newConfig.cashapp.cashtag})` : ""}`,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_payout_setup" },
    );

    api.registerTool(
      {
        label: "otm_payout_status",
        name: "otm_payout_status",
        description: "Check payout configuration, withdrawal history, and total earnings stats",
        parameters: Type.Object({
          historyLimit: Type.Optional(
            Type.Number({
              description: "Number of recent withdrawals to return (default: 20)",
              minimum: 1,
              maximum: 100,
            }),
          ),
        }),
        execute: async (_callId, _input: any) => {
          try {
            const [configs, history, stats] = await Promise.all([
              loadAllPayoutConfigs(),
              getWithdrawalHistory(_input.historyLimit ?? 20),
              getWithdrawalStats(),
            ]);
            const safeConfigs = configs.map((c) => ({
              id: c.id,
              destination: c.destination,
              label: c.label,
              enabled: c.enabled,
              autoWithdraw: c.autoWithdraw,
              minWithdrawal: c.minWithdrawal,
              maxWithdrawal: c.maxWithdrawal,
              withdrawalPercent: c.withdrawalPercent,
              cashtag: c.cashapp?.cashtag,
              hasCashAppApiKey: !!c.cashapp?.cashappApiKey,
              bankRouting: c.sofi?.routingNumber
                ? `***${c.sofi.routingNumber.slice(-4)}`
                : undefined,
              hasMercuryKey: !!c.sofi?.mercuryApiKey,
            }));
            const __res = {
              success: true,
              configs: safeConfigs,
              stats,
              recentWithdrawals: history.map((w) => ({
                id: w.id,
                destination: w.destination,
                amount: w.amount,
                netAmount: w.netAmount,
                status: w.status,
                method: w.method,
                platformSource: w.platformSource,
                initiatedAt: w.initiatedAt,
                completedAt: w.completedAt,
                referenceId: w.referenceId,
                error: w.error,
              })),
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_payout_status" },
    );

    api.registerTool(
      {
        label: "otm_withdraw_now",
        name: "otm_withdraw_now",
        description:
          "Trigger an immediate withdrawal of OTM earnings to the configured payout destination (CashApp or SoFi). " +
          "Without a CashApp/Square API key, generates a CashApp payment request link for manual completion.",
        parameters: Type.Object({
          amount: Type.Optional(
            Type.Number({
              description: "Amount to withdraw in USD. Defaults to 80% of available balance.",
              minimum: 1,
            }),
          ),
          platformSource: Type.Optional(
            Type.String({
              description: "Label for the source of funds (default: 'manual_withdrawal')",
            }),
          ),
          configId: Type.Optional(
            Type.String({
              description: "Specific payout config ID to use. Defaults to active config.",
            }),
          ),
        }),
        execute: async (_callId, input: any) => {
          try {
            const configs = await loadAllPayoutConfigs();
            let payoutCfg = configs.find((c) => c.enabled) ?? configs[0] ?? null;
            if (input.configId) {
              payoutCfg = configs.find((c) => c.id === input.configId && c.enabled) ?? payoutCfg;
            }
            if (!payoutCfg) {
              const errRes = {
                success: false,
                error: "No payout config found. Run otm_payout_setup first.",
              };
              return {
                content: [{ type: "text" as const, text: JSON.stringify(errRes) }],
                details: errRes,
              };
            }

            let withdrawAmount = input.amount as number | undefined;
            if (!withdrawAmount) {
              const stats = await getWithdrawalStats();
              // Read total net earnings from finance pipeline, then fall back to engine-state.json
              let totalNet = 0;
              try {
                const { getOtmFinancialSummary } = await import("./src/finance-bridge.js");
                const summary = await getOtmFinancialSummary();
                totalNet = summary.grossThisMonth;
              } catch {
                /* finance-bridge unavailable */
              }
              if (totalNet === 0) {
                // secondary fallback: engine-state.json written by job-engine
                try {
                  const { readFile } = await import("node:fs/promises");
                  const stateFile = join(homedir(), ".openclaw", "otm", "engine-state.json");
                  const raw = await readFile(stateFile, "utf8").catch(() => "{}");
                  const state = JSON.parse(raw) as { totalNetEarnings?: number };
                  if (typeof state.totalNetEarnings === "number") totalNet = state.totalNetEarnings;
                } catch {
                  /* use zero */
                }
              }
              const available = Math.max(0, totalNet - stats.totalWithdrawn);
              const pct = Math.max(0, Math.min(1, payoutCfg.withdrawalPercent ?? 0.8));
              withdrawAmount = Math.min(available * pct, payoutCfg.maxWithdrawal ?? 500);
              if (withdrawAmount < 1) {
                const errRes = {
                  success: false,
                  error: `Available balance too low (available: $${available.toFixed(2)})`,
                  available,
                };
                return {
                  content: [{ type: "text" as const, text: JSON.stringify(errRes) }],
                  details: errRes,
                };
              }
            } else {
              // Explicit amount provided — validate against available balance
              if (withdrawAmount < 1) {
                const errRes = { success: false, error: "Minimum withdrawal is $1" };
                return {
                  content: [{ type: "text" as const, text: JSON.stringify(errRes) }],
                  details: errRes,
                };
              }
              const stats = await getWithdrawalStats();
              let totalNet = 0;
              try {
                const { getOtmFinancialSummary } = await import("./src/finance-bridge.js");
                const summary = await getOtmFinancialSummary();
                totalNet = summary.grossThisMonth;
              } catch {
                /* finance-bridge unavailable */
              }
              if (totalNet === 0) {
                try {
                  const { readFile } = await import("node:fs/promises");
                  const stateFile = join(homedir(), ".openclaw", "otm", "engine-state.json");
                  const raw = await readFile(stateFile, "utf8").catch(() => "{}");
                  const state = JSON.parse(raw) as { totalNetEarnings?: number };
                  if (typeof state.totalNetEarnings === "number") totalNet = state.totalNetEarnings;
                } catch {
                  /* use zero */
                }
              }
              const available = Math.max(0, totalNet - stats.totalWithdrawn);
              if (withdrawAmount > available) {
                const errRes = {
                  success: false,
                  error: `Requested $${withdrawAmount.toFixed(2)} exceeds available balance of $${available.toFixed(2)}`,
                  available,
                  requested: withdrawAmount,
                };
                return {
                  content: [{ type: "text" as const, text: JSON.stringify(errRes) }],
                  details: errRes,
                };
              }
              const maxAllowed = payoutCfg.maxWithdrawal ?? 500;
              if (withdrawAmount > maxAllowed) {
                const errRes = {
                  success: false,
                  error: `Requested $${withdrawAmount.toFixed(2)} exceeds max withdrawal of $${maxAllowed.toFixed(2)}`,
                };
                return {
                  content: [{ type: "text" as const, text: JSON.stringify(errRes) }],
                  details: errRes,
                };
              }
            }

            const platformSource =
              (input.platformSource as string | undefined) ?? "manual_withdrawal";
            const withdrawal = await processPayout(withdrawAmount, platformSource, [], payoutCfg);

            // Generate CashApp payment link when no API key (manual flow)
            const cashappLink =
              payoutCfg.destination === "cashapp" &&
              payoutCfg.cashapp &&
              !payoutCfg.cashapp.cashappApiKey
                ? `https://cash.app/${payoutCfg.cashapp.cashtag.replace("$", "")}/${withdrawAmount.toFixed(2)}`
                : undefined;

            const __res = {
              success: withdrawal.status === "completed" || withdrawal.status === "processing",
              withdrawal: {
                id: withdrawal.id,
                destination: withdrawal.destination,
                amount: withdrawal.amount,
                netAmount: withdrawal.netAmount,
                status: withdrawal.status,
                method: withdrawal.method,
                referenceId: withdrawal.referenceId,
                initiatedAt: withdrawal.initiatedAt,
                notes: withdrawal.notes,
                error: withdrawal.error,
              },
              cashappLink,
              message:
                withdrawal.status === "completed"
                  ? `Withdrawal of $${withdrawal.netAmount.toFixed(2)} completed via ${withdrawal.destination}`
                  : cashappLink
                    ? `To complete: open ${cashappLink} and send $${withdrawAmount.toFixed(2)} to yourself on CashApp`
                    : `Withdrawal of $${withdrawal.netAmount.toFixed(2)} queued (${withdrawal.status})`,
            };
            return {
              content: [{ type: "text" as const, text: JSON.stringify(__res) }],
              details: __res,
            };
          } catch (error) {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: " + String(error instanceof Error ? error.message : String(error)),
                },
              ],
              details: {
                success: false,
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      },
      { name: "otm_withdraw_now" },
    );

    // ----- Gateway methods -----

    // Revenue logging endpoint — accepts revenue events from Store webhook,
    // Sports Steve, Block 2.0, Draymond, or any external source and writes
    // to the shared ~/.openclaw/finance/revenue.jsonl unified pipeline.
    api.registerGatewayMethod("otm-agent.log-revenue", async ({ params, respond }) => {
      try {
        const { logOtmRevenue } = await import("./src/finance-bridge.js");
        const source = (params?.source as string) ?? "unknown";
        const category = (params?.category as string) ?? "freelance_income";
        const VALID_CATEGORIES = new Set([
          "freelance_income",
          "platform_fee",
          "ai_cost",
          "payout",
          "reinvested",
          "bonus",
        ]);
        if (!VALID_CATEGORIES.has(category)) {
          respond(false, {
            error: `Invalid category: ${category}. Must be one of: ${[...VALID_CATEGORIES].join(", ")}`,
          });
          return;
        }
        const amount = typeof params?.amount === "number" ? params.amount : 0;
        const period = (params?.period as string) ?? new Date().toISOString().split("T")[0];
        const notes = (params?.notes as string) ?? "";
        const platform = (params?.platform as string) ?? source;
        const jobId = (params?.jobId as string) ?? undefined;

        if (amount === 0) {
          respond(false, { error: "amount is required and must be non-zero" });
          return;
        }

        await logOtmRevenue({
          source,
          category: category as
            | "freelance_income"
            | "platform_fee"
            | "ai_cost"
            | "payout"
            | "reinvested"
            | "bonus",
          amount,
          period,
          ts: Date.now(),
          jobId,
          platform,
          notes,
        });

        respond(true, {
          success: true,
          message: `Revenue logged: $${amount} from ${source}`,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    // Aggregate revenue summary endpoint — returns financial health across all agents
    api.registerGatewayMethod("otm-agent.revenue-summary", async ({ respond }) => {
      try {
        const { getOtmFinancialSummary } = await import("./src/finance-bridge.js");
        const summary = await getOtmFinancialSummary();
        respond(true, summary);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    // Unified payout check — reads aggregate revenue from ALL agents in revenue.jsonl
    // and triggers auto-withdrawal to CashApp if balance exceeds threshold.
    // Can be called manually or runs on a scheduled interval (see below).
    api.registerGatewayMethod("otm-agent.check-payout", async ({ respond }) => {
      try {
        const { getOtmFinancialSummary } = await import("./src/finance-bridge.js");
        const summary = await getOtmFinancialSummary();

        // Use grossToday or grossThisMonth as the aggregate balance indicator
        // The payout engine computes available = totalNet - completedWithdrawn internally
        const totalNet = summary.grossThisMonth; // all income this month across all agents

        if (totalNet <= 0) {
          respond(true, {
            message: "No revenue to withdraw",
            totalNet,
            withdrawn: summary.totalWithdrawn,
          });
          return;
        }

        const result = await checkAutoWithdrawal(totalNet, "aggregate", []);
        if (result) {
          respond(true, {
            message: `Payout initiated: $${result.amount.toFixed(2)} to ${result.destination}`,
            withdrawal: result,
            totalNet,
          });
        } else {
          respond(true, {
            message: "Payout check passed — balance below threshold or auto-withdraw disabled",
            totalNet,
            withdrawn: summary.totalWithdrawn,
          });
        }
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    // ── Scheduled Payout Checker ──────────────────────────────────────────────
    // Every 6 hours, check if aggregate revenue warrants an auto-withdrawal.
    const PAYOUT_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
    let payoutInterval: ReturnType<typeof setInterval> | null = null;

    async function runScheduledPayoutCheck() {
      try {
        const { getOtmFinancialSummary } = await import("./src/finance-bridge.js");
        const summary = await getOtmFinancialSummary();
        const totalNet = summary.grossThisMonth;

        if (totalNet <= 0) return;

        const result = await checkAutoWithdrawal(totalNet, "aggregate", []);
        if (result) {
          console.info(
            `[payout-scheduler] Auto-withdrawal triggered: $${result.amount.toFixed(2)} to ${result.destination} (ref: ${result.referenceId ?? result.id})`,
          );
        }
      } catch (err) {
        console.warn(
          `[payout-scheduler] Check failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Start the scheduler after a short delay to let the gateway settle
    const startupTimer = setTimeout(() => {
      payoutInterval = setInterval(runScheduledPayoutCheck, PAYOUT_CHECK_INTERVAL_MS);
      // Also run once on startup
      runScheduledPayoutCheck();
    }, 30_000);

    // Clean up on gateway stop
    api.on("gateway_stop", async () => {
      clearTimeout(startupTimer);
      if (payoutInterval) clearInterval(payoutInterval);
    });

    api.registerGatewayMethod("otm-agent.status", async ({ respond }) => {
      try {
        const status = {
          connected: config.apiKey.length > 0,
          apiUrl: config.apiUrl,
          bankroll: config.bankroll,
          scanInterval: config.scanInterval,
          platforms: config.platforms,
          lastScan: new Date().toISOString(),
          nextScan: new Date(Date.now() + config.scanInterval * 1000).toISOString(),
        };
        respond(true, status);
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    api.registerGatewayMethod("otm-agent.update-bankroll", async ({ params, respond }) => {
      try {
        // M1: Validate bankroll — must be a finite, non-negative number
        const raw = params?.bankroll;
        if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) {
          respond(false, {
            error: `Invalid bankroll value: ${JSON.stringify(raw)}. Must be a non-negative finite number.`,
          });
          return;
        }
        const newBankroll = raw;
        config.bankroll = newBankroll;

        // C4: Persist the updated bankroll so it survives gateway restarts
        await saveRuntimeOverrides({ bankroll: newBankroll });

        respond(true, {
          success: true,
          bankroll: config.bankroll,
          message: `Bankroll updated to $${config.bankroll}. Strategies will be recalibrated.`,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        respond(false, { error: err instanceof Error ? err.message : String(err) });
      }
    });

    // ----- System guidance -----
    api.on("before_prompt_build", async () => {
      const lines: string[] = [];

      lines.push(
        "You have access to OTM Agent (Out The Mud) tools for micro-entrepreneurship and bootstrapping.",
        "OTM Agent helps find and analyze money-making opportunities with little to no starting capital.",
        "",
        "Available tools:",
        "- otm_scan_opportunities: Scan platforms for money-making opportunities (pass notifySignal:true to alert via Signal)",
        "- otm_get_strategies: Get recommended strategies based on bankroll and goals",
        "- otm_analyze_opportunity: Analyze specific opportunity with AI",
        "- otm_get_metrics: Get performance metrics and dashboard data",
        "- otm_add_account: Add platform accounts with encrypted storage",
        "- otm_list_accounts: List all stored platform accounts",
        "- otm_get_account: Get detailed account information",
        "- otm_update_account: Update existing accounts",
        "- otm_delete_account: Delete accounts (requires confirmation)",
        "- otm_validate_accounts: Validate all stored accounts",
        "- otm_signal_test: Test Signal notification delivery to configured recipients",
        "- otm_signal_report: Send an on-demand OTM summary report via Signal",
        "",
        "Signal notifications:",
        "- Enable automatic alerts: set otm-agent.notifications.signal=true in config",
        "- Set recipients: otm-agent.notifications.recipients=['+1234567890']",
        "- Set score threshold: otm-agent.notifications.minScore=80",
        "- Notifications fire during otm_scan_opportunities when scores exceed the threshold",
        "- Use otm_signal_test to verify Signal connectivity before enabling auto-alerts",
        "- Use otm_signal_report to send manual daily/weekly summaries",
        "",
        "Key concepts:",
        "- Bankroll: Available capital ($0 to start is fine)",
        "- Time-to-first-dollar: How quickly an opportunity can generate income",
        "- Score: 0-100 rating of opportunity quality",
        "- Risk levels: Low, Medium, High",
        "- Strategies: Micro-task, Content, Gig services, Templates, Agent resale, Automation",
        "- Account security: All credentials are encrypted at rest",
        "",
        "When suggesting opportunities:",
        "1. Consider the user's current bankroll and available time",
        "2. Prioritize opportunities with high scores (80+)",
        "3. Focus on low-risk options for beginners",
        "4. Suggest quick wins for immediate momentum",
        "5. Recommend reinvestment strategies for growth",
        "",
        "Account management best practices:",
        "1. Always validate accounts before scanning",
        "2. Keep tokens refreshed and up-to-date",
        "3. Use account validation to check status",
        "4. Store only necessary credentials",
        "5. Regularly review and clean up unused accounts",
        "",
        "Remember: The goal is to start small, earn consistently, and reinvest for scale.",
      );

      return { prependSystemContext: lines.join("\n") };
    });

    // ----- HTTP route: agent activation (called by Stripe webhook on purchase) -----
    // POST /api/agents/activate
    // Body: { event: "agent:activate", agentType, customerEmail, activatedAt, source }
    // Auth: Bearer token via TAPCLAW_GATEWAY_TOKEN env var (validated by auth:"gateway")
    api.registerHttpRoute({
      path: "/api/agents/activate",
      auth: "gateway",
      match: "exact",
      handler: async (req, res) => {
        if (req.method !== "POST") {
          res.writeHead(405, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Method Not Allowed" }));
          return true;
        }

        try {
          // Read request body
          const body = await new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on("data", (chunk: Buffer) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
            req.on("error", reject);
          });

          const payload = JSON.parse(body) as {
            event?: string;
            agentType?: string;
            customerEmail?: string | null;
            activatedAt?: string;
            source?: string;
          };

          const { event, agentType, customerEmail, activatedAt, source } = payload;

          if (event !== "agent:activate" || !agentType) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid payload: event and agentType are required" }));
            return true;
          }

          // Log the activation event as a revenue/activation record
          const { logOtmRevenue } = await import("./src/finance-bridge.js");
          await logOtmRevenue({
            source: source ?? "tapclaw-store",
            category: "bonus",
            amount: 0, // activation — no monetary amount; revenue logged separately by webhook
            period: new Date().toISOString().split("T")[0],
            ts: Date.now(),
            notes: `Agent activated: ${agentType} for ${customerEmail ?? "unknown"} at ${activatedAt ?? new Date().toISOString()}`,
          });

          console.info(
            `[otm-agent] Agent activation received: ${agentType} (${customerEmail ?? "no email"}) from ${source ?? "unknown"}`,
          );

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ok: true,
              agentType,
              activatedAt: activatedAt ?? new Date().toISOString(),
            }),
          );
          return true;
        } catch (err) {
          console.error("[otm-agent] /api/agents/activate error:", err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal server error" }));
          return true;
        }
      },
    });
  },
});
