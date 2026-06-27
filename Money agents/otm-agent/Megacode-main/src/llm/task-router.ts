/**
 * Task-Based LLM Router for MegaCode CLI
 * 
 * Intelligently routes requests to appropriate LLM providers based on task type:
 * - Daily tasks: DeepSeek
 * - Research: Perplexity
 * - Complex logic/code review: Claude Opus 4.6
 * - Creative/UI: Grok
 * - Templates: Claude Sonnet 4.6
 * - Images: Grok Imagine Image Pro
 * - Video: Grok Imagine Video
 * - Long sessions: Grok 4 Fast Reasoning (2M context)
 * - The Block: DeepSeek
 */

import {
  LLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMProviderConfig,
} from "./provider";
import { LLMRouter, RouterConfig } from "./router";
import { logger } from "../utils/logger";
import { validator } from "../utils/validation";

export type TaskType =
  | "daily"           // Daily go-to tasks
  | "research"        // Research tasks
  | "complex_logic"   // Complex logic and code review
  | "creative"        // Creative, inventive, UI-related
  | "templates"       // Templates for cheetah supreme
  | "image"          // Image generation/analysis
  | "video"          // Video generation/analysis
  | "long_session"   // Long cheetah supreme sessions
  | "the_block"      // The Block tasks
  | "general";       // General fallback

export interface TaskRouterConfig extends RouterConfig {
  /** Default task type when not specified */
  defaultTaskType: TaskType;
  /** Task-to-provider mapping */
  taskMapping: Record<TaskType, string[]>;
  /** Provider configurations */
  providers: Record<string, LLMProviderConfig>;
}

export const DEFAULT_TASK_MAPPING: Record<TaskType, string[]> = {
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
};

const DEFAULT_TASK_ROUTER_CONFIG: TaskRouterConfig = {
  strategy: "model-match",
  enableFailover: true,
  maxRetries: 2,
  defaultTaskType: "daily",
  taskMapping: DEFAULT_TASK_MAPPING,
  providers: {},
};

export class TaskRouter {
  private router: LLMRouter;
  private config: TaskRouterConfig;
  private providers: Map<string, LLMProvider> = new Map();

  constructor(config: Partial<TaskRouterConfig> = {}) {
    this.config = { ...DEFAULT_TASK_ROUTER_CONFIG, ...config };
    this.router = new LLMRouter({
      strategy: this.config.strategy,
      enableFailover: this.config.enableFailover,
      maxRetries: this.config.maxRetries,
    });
    
    // Register providers from config
    this.registerProviders();
  }

  /** Register all providers from configuration */
  private registerProviders(): void {
    for (const [name, providerConfig] of Object.entries(this.config.providers)) {
      if (providerConfig.enabled) {
        this.router.registerProvider(providerConfig);
        this.providers.set(name, this.router.getProvider(name)!);
      }
    }
  }

  /** Detect task type from request content */
  detectTaskType(request: LLMCompletionRequest): TaskType {
    const content = request.messages
      .map(m => m.content.toLowerCase())
      .join(" ");
    
    // Check for research keywords
    const researchKeywords = [
      "research", "study", "investigate", "explore", "analyze",
      "what is", "how does", "explain", "tell me about", "find information",
      "look up", "search for", "background", "context"
    ];
    
    if (researchKeywords.some(keyword => content.includes(keyword))) {
      return "research";
    }

    // Check for complex logic/code review
    const logicKeywords = [
      "review", "refactor", "optimize", "debug", "fix",
      "complex", "algorithm", "logic", "architecture", "design pattern",
      "best practice", "security", "performance", "scalability"
    ];
    
    if (logicKeywords.some(keyword => content.includes(keyword))) {
      return "complex_logic";
    }

    // Check for creative/UI tasks
    const creativeKeywords = [
      "design", "ui", "ux", "creative", "invent", "innovate",
      "visual", "layout", "interface", "user experience", "aesthetic",
      "beautiful", "modern", "responsive", "wireframe", "mockup"
    ];
    
    if (creativeKeywords.some(keyword => content.includes(keyword))) {
      return "creative";
    }

    // Check for template tasks
    const templateKeywords = [
      "template", "boilerplate", "scaffold", "generate", "create from",
      "starter", "example", "pattern", "structure", "framework"
    ];
    
    if (templateKeywords.some(keyword => content.includes(keyword))) {
      return "templates";
    }

    // Check for image tasks
    const imageKeywords = [
      "image", "picture", "photo", "generate image", "create image",
      "visualize", "draw", "illustrate", "diagram", "chart", "graph"
    ];
    
    if (imageKeywords.some(keyword => content.includes(keyword))) {
      return "image";
    }

    // Check for video tasks
    const videoKeywords = [
      "video", "animation", "motion", "create video", "generate video",
      "animate", "movement", "timeline", "sequence", "clip"
    ];
    
    if (videoKeywords.some(keyword => content.includes(keyword))) {
      return "video";
    }

    // Check for long session indicators
    const longSessionKeywords = [
      "long", "extended", "marathon", "session", "project",
      "comprehensive", "detailed", "thorough", "complete", "full"
    ];
    
    if (longSessionKeywords.some(keyword => content.includes(keyword))) {
      return "long_session";
    }

    // Check for The Block tasks
    const blockKeywords = [
      "the block", "blockchain", "crypto", "token", "smart contract",
      "decentralized", "web3", "defi", "nft", "wallet", "transaction"
    ];
    
    if (blockKeywords.some(keyword => content.includes(keyword))) {
      return "the_block";
    }

    // Default to daily tasks
    return this.config.defaultTaskType;
  }

  /** Get providers for a specific task type */
  getProvidersForTask(taskType: TaskType): LLMProvider[] {
    const providerNames = this.config.taskMapping[taskType] || 
                         this.config.taskMapping[this.config.defaultTaskType];
    
    const providers: LLMProvider[] = [];
    for (const name of providerNames) {
      const provider = this.providers.get(name);
      if (provider) {
        providers.push(provider);
      }
    }
    
    // Fallback to general providers if no specific providers found
    if (providers.length === 0) {
      const generalNames = this.config.taskMapping.general || [];
      for (const name of generalNames) {
        const provider = this.providers.get(name);
        if (provider) {
          providers.push(provider);
        }
      }
    }
    
    return providers;
  }

  /** Complete a request with task-based routing */
  async complete(
    request: LLMCompletionRequest,
    taskType?: TaskType
  ): Promise<LLMCompletionResponse> {
    // Validate input request
    try {
      validator.validateCompletionRequest(request);
    } catch (error) {
      logger.error("Request validation failed", { error: validator.sanitizeErrorMessage(error) });
      throw error;
    }

    const detectedTaskType = taskType || this.detectTaskType(request);
    const providers = this.getProvidersForTask(detectedTaskType);
    
    if (providers.length === 0) {
      const error = new Error(`No providers available for task type: ${detectedTaskType}`);
      logger.error(error.message, { taskType: detectedTaskType });
      throw error;
    }

    logger.info(`Using ${detectedTaskType} task type with providers: ${providers.map(p => p.name).join(", ")}`, {
      taskType: detectedTaskType,
      providers: providers.map(p => p.name),
    });

    // Try each provider in order
    let lastError: Error | undefined;
    
    for (const provider of providers) {
      try {
        const response = await provider.complete(request);
        logger.info(`Successfully used ${provider.name} for ${detectedTaskType} task`, {
          provider: provider.name,
          taskType: detectedTaskType,
          model: response.model,
        });
        return {
          ...response,
          provider: `${provider.name} (${detectedTaskType})`,
        };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(`${provider.name} failed: ${lastError.message}`, {
          provider: provider.name,
          error: lastError.message,
          taskType: detectedTaskType,
        });
        
        if (!this.config.enableFailover) {
          throw lastError;
        }
      }
    }
    
    throw lastError ?? new Error("All providers failed");
  }

  /** Stream completion with task-based routing */
  async *streamComplete(
    request: LLMCompletionRequest,
    taskType?: TaskType
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const detectedTaskType = taskType || this.detectTaskType(request);
    const providers = this.getProvidersForTask(detectedTaskType);
    
    if (providers.length === 0) {
      throw new Error(`No providers available for task type: ${detectedTaskType}`);
    }

    logger.info(`Streaming with ${detectedTaskType} task type using providers: ${providers.map(p => p.name).join(", ")}`, {
      taskType: detectedTaskType,
      providers: providers.map(p => p.name),
    });

    let lastError: Error | undefined;

    for (const provider of providers) {
      let emittedContent = false;

      try {
        for await (const chunk of provider.streamComplete(request)) {
          if (chunk.content) {
            emittedContent = true;
          }
          yield chunk;
        }
        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(`${provider.name} stream failed: ${lastError.message}`, {
          provider: provider.name,
          error: lastError.message,
          taskType: detectedTaskType,
          emittedContent,
        });

        if (emittedContent || !this.config.enableFailover) {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error("All streaming providers failed");
  }

  /** Add or update a provider configuration */
  updateProvider(name: string, config: LLMProviderConfig): void {
    this.config.providers[name] = config;
    
    // Re-register providers
    this.providers.clear();
    this.registerProviders();
  }

  /** Remove a provider */
  removeProvider(name: string): void {
    delete this.config.providers[name];
    this.providers.delete(name);
  }

  /** Get provider status */
  getProviderStatus(): Record<string, { enabled: boolean; config: LLMProviderConfig }> {
    const status: Record<string, { enabled: boolean; config: LLMProviderConfig }> = {};
    
    for (const [name, config] of Object.entries(this.config.providers)) {
      status[name] = {
        enabled: config.enabled,
        config,
      };
    }
    
    return status;
  }

  /** Get task mapping */
  getTaskMapping(): Record<TaskType, string[]> {
    return { ...this.config.taskMapping };
  }

  /** Update task mapping */
  updateTaskMapping(mapping: Partial<Record<TaskType, string[]>>): void {
    this.config.taskMapping = { ...this.config.taskMapping, ...mapping };
  }

  /** Health check all providers */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const checks = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          results[name] = await provider.healthCheck();
        } catch {
          results[name] = false;
        }
      }
    );
    await Promise.all(checks);
    return results;
  }
}
