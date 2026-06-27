/**
 * Configuration Factory for MegaCode CLI
 * 
 * Creates TaskRouter with all providers configured from API keys.
 */

import { TaskRouter, TaskRouterConfig, DEFAULT_TASK_MAPPING } from "./task-router";
import { LLMProviderConfig } from "./provider";
import { APIKeyLoader, APIKeys } from "./api-key-loader";

export interface MegaCodeConfig {
  /** Enable debug logging */
  debug?: boolean;
  /** Custom APIs folder path */
  apisFolder?: string;
  /** Custom task mapping */
  taskMapping?: Partial<typeof DEFAULT_TASK_MAPPING>;
  /** Runtime API key overrides */
  apiKeys?: Partial<APIKeys>;
  /** Provider-specific configurations */
  providers?: {
    deepseek?: Partial<LLMProviderConfig>;
    claude?: Partial<LLMProviderConfig>;
    grok?: Partial<LLMProviderConfig>;
    perplexity?: Partial<LLMProviderConfig>;
    openai?: Partial<LLMProviderConfig>;
    mistral?: Partial<LLMProviderConfig>;
    ollama?: Partial<LLMProviderConfig>;
    gemini?: Partial<LLMProviderConfig>;
  };
}

export class ConfigFactory {
  private keyLoader: APIKeyLoader;
  private config: MegaCodeConfig;

  constructor(config: MegaCodeConfig = {}) {
    this.config = config;
    this.keyLoader = new APIKeyLoader({
      apisFolder: config.apisFolder,
      debug: config.debug,
    });
  }

  /** Create a fully configured TaskRouter */
  createTaskRouter(): TaskRouter {
    const providerConfigs = this.createProviderConfigs();
    const taskMapping = this.createTaskMapping();
    
    const routerConfig: TaskRouterConfig = {
      strategy: "model-match",
      enableFailover: true,
      maxRetries: 2,
      defaultTaskType: "daily",
      taskMapping,
      providers: providerConfigs,
    };
    
    return new TaskRouter(routerConfig);
  }

  /** Create provider configurations from API keys */
  private createProviderConfigs(): Record<string, LLMProviderConfig> {
    const providers: Record<string, LLMProviderConfig> = {};
    const keys = {
      ...this.keyLoader.getAllKeys(),
      ...(this.config.apiKeys || {}),
    };
    
    // DeepSeek Provider
    if (keys.deepseek) {
      providers.deepseek = {
        name: "deepseek",
        // NOTE: providers append `/v1/...` themselves
        baseUrl: "https://api.deepseek.com",
        apiKey: keys.deepseek,
        models: ["deepseek-chat", "deepseek-coder"],
        defaultModel: "deepseek-chat",
        enabled: true,
        timeoutMs: 60000,
        ...this.config.providers?.deepseek,
      };
    }
    
    // Claude Provider (Opus 4.6 and Sonnet 4.6)
    if (keys.claude) {
      providers["claude-opus"] = {
        name: "claude-opus",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: keys.claude,
        models: ["claude-3-opus-20240229", "claude-3-5-sonnet-20241022"],
        defaultModel: "claude-3-opus-20240229",
        enabled: true,
        timeoutMs: 120000,
        ...this.config.providers?.claude,
      };
      
      providers["claude-sonnet"] = {
        name: "claude-sonnet",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: keys.claude,
        models: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"],
        defaultModel: "claude-3-5-sonnet-20241022",
        enabled: true,
        timeoutMs: 60000,
        ...this.config.providers?.claude,
      };
    }
    
    // Grok Provider
    if (keys.grok) {
      providers.grok = {
        name: "grok",
        baseUrl: "https://api.x.ai/v1",
        apiKey: keys.grok,
        models: ["grok-beta", "grok-2-1212", "grok-vision-1212"],
        defaultModel: "grok-beta",
        enabled: true,
        timeoutMs: 60000,
        ...this.config.providers?.grok,
      };
      
      providers["grok-imagine-image"] = {
        name: "grok-imagine-image",
        baseUrl: "https://api.x.ai/v1",
        apiKey: keys.grok,
        models: ["grok-imagine-image-pro", "grok-imagine-image"],
        defaultModel: "grok-imagine-image-pro",
        enabled: true,
        timeoutMs: 120000,
        ...this.config.providers?.grok,
      };
      
      providers["grok-imagine-video"] = {
        name: "grok-imagine-video",
        baseUrl: "https://api.x.ai/v1",
        apiKey: keys.grok,
        models: ["grok-imagine-video"],
        defaultModel: "grok-imagine-video",
        enabled: true,
        timeoutMs: 300000, // 5 minutes for video
        ...this.config.providers?.grok,
      };
      
      providers["grok-fast-reasoning"] = {
        name: "grok-fast-reasoning",
        baseUrl: "https://api.x.ai/v1",
        apiKey: keys.grok,
        models: ["grok-2-1212-2m", "grok-2-fast"],
        defaultModel: "grok-2-1212-2m",
        enabled: true,
        timeoutMs: 180000, // 3 minutes for long context
        ...this.config.providers?.grok,
      };
    }
    
    // Perplexity Provider
    if (keys.perplexity) {
      providers.perplexity = {
        name: "perplexity",
        baseUrl: "https://api.perplexity.ai",
        apiKey: keys.perplexity,
        models: ["sonar", "sonar-pro", "sonar-reasoning", "llama-3.1-sonar-small-128k"],
        defaultModel: "sonar",
        enabled: true,
        timeoutMs: 60000,
        ...this.config.providers?.perplexity,
      };
    }
    
    // OpenAI Provider
    if (keys.openai) {
      providers.openai = {
        name: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: keys.openai,
        models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],
        defaultModel: "gpt-4",
        enabled: true,
        timeoutMs: 60000,
        ...this.config.providers?.openai,
      };
    }
    
    // Mistral Provider
    if (keys.mistral) {
      providers.mistral = {
        name: "mistral",
        baseUrl: "https://api.mistral.ai/v1",
        apiKey: keys.mistral,
        models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
        defaultModel: "mistral-large-latest",
        enabled: true,
        timeoutMs: 60000,
        ...this.config.providers?.mistral,
      };
    }
    
    // Ollama Provider (local)
    if (keys.ollama) {
      providers.ollama = {
        name: "ollama",
        baseUrl: "http://localhost:11434/v1",
        apiKey: keys.ollama,
        models: ["llama3.1", "mistral", "codellama"],
        defaultModel: "llama3.1",
        enabled: true,
        timeoutMs: 30000,
        ...this.config.providers?.ollama,
      };
    }
    
    // Gemini Provider
    if (keys.gemini) {
      providers.gemini = {
        name: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        apiKey: keys.gemini,
        models: ["gemini-pro", "gemini-pro-vision"],
        defaultModel: "gemini-pro",
        enabled: true,
        timeoutMs: 60000,
        ...this.config.providers?.gemini,
      };
    }
    
    return providers;
  }

  /** Create task mapping with custom overrides */
  private createTaskMapping(): typeof DEFAULT_TASK_MAPPING {
    const baseMapping = { ...DEFAULT_TASK_MAPPING };
    
    // Apply custom task mapping overrides
    if (this.config.taskMapping) {
      Object.assign(baseMapping, this.config.taskMapping);
    }
    
    // Filter out providers that aren't available
    const keys = this.keyLoader.getAllKeys();
    
    for (const [taskType, providerNames] of Object.entries(baseMapping)) {
      const availableProviders = providerNames.filter(providerName => {
        // Check if provider has API key
        const keyName = this.getKeyNameForProvider(providerName);
        return keyName ? !!keys[keyName] : true;
      });
      
      // If no providers available for this task, fall back to general
      if (availableProviders.length === 0) {
        baseMapping[taskType as keyof typeof DEFAULT_TASK_MAPPING] = 
          baseMapping.general || ["deepseek", "openai"];
      } else {
        baseMapping[taskType as keyof typeof DEFAULT_TASK_MAPPING] = availableProviders;
      }
    }
    
    return baseMapping;
  }

  /** Map provider name to API key name */
  private getKeyNameForProvider(providerName: string): keyof ReturnType<APIKeyLoader["getAllKeys"]> | null {
    const mapping: Record<string, keyof ReturnType<APIKeyLoader["getAllKeys"]>> = {
      "deepseek": "deepseek",
      "claude-opus": "claude",
      "claude-sonnet": "claude",
      "grok": "grok",
      "grok-imagine-image": "grok",
      "grok-imagine-video": "grok",
      "grok-fast-reasoning": "grok",
      "perplexity": "perplexity",
      "openai": "openai",
      "mistral": "mistral",
      "ollama": "ollama",
      "gemini": "gemini",
    };
    
    return mapping[providerName] || null;
  }

  /** Get API key status */
  getAPIKeyStatus(): ReturnType<APIKeyLoader["getKeyStatus"]> {
    const status = this.keyLoader.getKeyStatus();
    for (const [provider, key] of Object.entries(this.config.apiKeys || {})) {
      status[provider] = {
        available: !!key,
        keyPreview: key ? `${key.substring(0, 8)}...` : "",
      };
    }
    return status;
  }

  /** Get available providers */
  getAvailableProviders(): string[] {
    const providers = this.createProviderConfigs();
    return Object.keys(providers).filter(name => providers[name].enabled);
  }

  /** Get task router configuration */
  getTaskRouterConfig(): TaskRouterConfig {
    return {
      strategy: "model-match",
      enableFailover: true,
      maxRetries: 2,
      defaultTaskType: "daily",
      taskMapping: this.createTaskMapping(),
      providers: this.createProviderConfigs(),
    };
  }

  /** Create a simple test configuration */
  static createTestConfig(): MegaCodeConfig {
    return {
      debug: true,
      taskMapping: {
        daily: ["deepseek"],
        research: ["perplexity"],
        complex_logic: ["claude-opus"],
        creative: ["grok"],
        templates: ["claude-sonnet"],
        image: ["grok-imagine-image"],
        video: ["grok-imagine-video"],
        long_session: ["grok-fast-reasoning"],
        the_block: ["deepseek"],
        general: ["deepseek", "claude-sonnet", "grok"],
      },
    };
  }
}
