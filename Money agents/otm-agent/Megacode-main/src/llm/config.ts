/**
 * OverCoat configuration loader.
 *
 * Reads the Overcoat specification file and provides typed access
 * to project configuration including LLM providers, architecture
 * settings, and feature flags.
 */

import * as fs from "fs";
import * as path from "path";
import { LLMProviderConfig } from "./provider";

export interface OvercoatProject {
  name: string;
  tagline: string;
  version: string;
  description: string;
  license: string;
}

export interface OvercoatStack {
  core: { language: string; framework: string; runtime: string };
  llm: { providers: string[]; integration: string };
  ui: { desktop: string; ide_plugin: string };
}

export interface OvercoatConfig {
  project: OvercoatProject;
  stack: OvercoatStack;
  features: Record<string, string[]>;
  architecture: {
    channels: string[];
    components: Record<string, string>;
    data_flow: string;
  };
}

/** Default LLM provider configurations derived from the Overcoat spec. */
const DEFAULT_PROVIDER_CONFIGS: Record<string, LLMProviderConfig> = {
  ollama: {
    name: "ollama",
    baseUrl: "http://localhost:11434",
    models: ["llama3", "codellama", "mistral", "deepseek-coder"],
    defaultModel: "llama3",
    enabled: true,
  },
  deepseek: {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-coder"],
    defaultModel: "deepseek-coder",
    enabled: true,
  },
  gemini: {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    models: ["gemini-pro", "gemini-pro-vision"],
    defaultModel: "gemini-pro",
    enabled: true,
  },
  openai: {
    name: "openai",
    baseUrl: "https://api.openai.com",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
    ],
    defaultModel: "gpt-4o-mini",
    enabled: true,
  },
};

/**
 * Load the Overcoat specification file from the project root.
 * The file is named "Overcoat " (with trailing space as in the repo).
 */
export function loadOvercoatSpec(
  projectRoot: string,
): OvercoatConfig | undefined {
  const specPaths = [
    path.join(projectRoot, "Overcoat "),
    path.join(projectRoot, "Overcoat"),
    path.join(projectRoot, "overcoat.json"),
  ];

  for (const specPath of specPaths) {
    if (fs.existsSync(specPath)) {
      const raw = fs.readFileSync(specPath, "utf-8");
      try {
        return JSON.parse(raw) as OvercoatConfig;
      } catch (error) {
        // If the Overcoat spec file contains invalid JSON, treat it as unavailable.
        continue;
      }
    }
  }

  return undefined;
}

/** Environment variable names for provider API keys. */
const API_KEY_ENV_VARS: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
};

/**
 * Build LLM provider configurations from the Overcoat spec
 * and optional user overrides. API keys are loaded from environment
 * variables (DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY) when not
 * explicitly set, or from the optional `apiKeys` map.
 *
 * Priority order for API keys (highest → lowest):
 * 1. Explicit key in `providerOverrides[name].apiKey`
 * 2. Explicit key in `apiKeys[name]`
 * 3. Environment variable (DEEPSEEK_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY)
 */
export function buildProviderConfigs(
  spec?: OvercoatConfig,
  overrides?: Record<string, Partial<LLMProviderConfig>>,
  apiKeys?: Record<string, string>,
): LLMProviderConfig[] {
  const configs = { ...DEFAULT_PROVIDER_CONFIGS };

  // Apply user overrides
  if (overrides) {
    for (const [name, override] of Object.entries(overrides)) {
      if (configs[name]) {
        configs[name] = { ...configs[name], ...override };
      } else {
        configs[name] = {
          name,
          baseUrl: "",
          models: [],
          enabled: true,
          ...override,
        } as LLMProviderConfig;
      }
    }
  }

  // Apply explicit API keys from the apiKeys map (lower priority than
  // providerOverrides but higher than environment variables)
  if (apiKeys) {
    for (const [name, key] of Object.entries(apiKeys)) {
      if (key && configs[name] && configs[name].apiKey === undefined) {
        configs[name] = { ...configs[name], apiKey: key };
      }
    }
  }

  // Inject API keys from environment variables (only if not already set
  // by providerOverrides or apiKeys, to avoid overriding explicit config)
  for (const [name, envVar] of Object.entries(API_KEY_ENV_VARS)) {
    const envValue = process.env[envVar];
    if (envValue && configs[name] && configs[name].apiKey === undefined) {
      configs[name] = { ...configs[name], apiKey: envValue };
    }
  }

  // Filter to only providers listed in the spec if available
  if (spec?.stack?.llm?.providers) {
    const specProviders = spec.stack.llm.providers.map((p) =>
      p.toLowerCase().split(" ")[0],
    );
    return Object.values(configs).filter(
      (c) => specProviders.includes(c.name) && c.enabled,
    );
  }

  return Object.values(configs);
}
