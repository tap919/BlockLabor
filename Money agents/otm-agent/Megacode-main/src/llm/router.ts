/**
 * Multi-LLM Router for OverCoat.
 *
 * Routes requests to the appropriate LLM provider based on
 * model selection, availability, and routing strategy.
 * Supports failover, load balancing, and provider fusion.
 */

import {
  LLMProvider,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMProviderConfig,
} from "./provider";
import { OllamaProvider } from "./providers/ollama";
import { DeepSeekProvider } from "./providers/deepseek";
import { GeminiProvider } from "./providers/gemini";
import { OpenAICompatibleProvider } from "./providers/openai";
import { createHash } from "crypto";

export type RoutingStrategy = "priority" | "round-robin" | "model-match";

export interface RouterConfig {
  strategy: RoutingStrategy;
  enableFailover: boolean;
  maxRetries: number;
}

const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  strategy: "model-match",
  enableFailover: true,
  maxRetries: 2,
};

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private providerOrder: string[] = [];
  private roundRobinIndex = 0;
  private config: RouterConfig;
  private inFlight: Map<string, Promise<LLMCompletionResponse>> = new Map();

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  /** Register a provider from its configuration. */
  registerProvider(providerConfig: LLMProviderConfig): void {
    const provider = this.createProvider(providerConfig);
    if (provider) {
      this.providers.set(providerConfig.name, provider);
      this.providerOrder.push(providerConfig.name);
    }
  }

  /** Register a custom provider instance directly. */
  registerCustomProvider(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
    this.providerOrder.push(provider.name);
  }

  /** Get a registered provider by name. */
  getProvider(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /** List all registered provider names. */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /** Route a completion request to the best available provider. */
  async complete(
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    const candidates = this.selectProviders(request);

    if (candidates.length === 0) {
      throw new Error(
        `No providers available for model: ${request.model ?? "default"}`,
      );
    }

    // Deduplicate concurrent identical requests: if an identical request is
    // already in-flight, share its promise rather than firing a duplicate call.
    const key = this.requestKey(request);
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing;
    }

    const promise = this.doComplete(candidates, request);
    this.inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(key);
    }
  }

  /** Internal: attempt completion across candidates with failover. */
  private async doComplete(
    candidates: LLMProvider[],
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    let lastError: Error | undefined;

    for (
      let attempt = 0;
      attempt <= (this.config.enableFailover ? this.config.maxRetries : 0);
      attempt++
    ) {
      const provider = candidates[attempt % candidates.length];
      try {
        return await provider.complete(request);
      } catch (err) {
        lastError =
          err instanceof Error ? err : new Error(String(err));
        if (!this.config.enableFailover) {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error("All providers failed");
  }

  /** Route a streaming completion request. */
  async *streamComplete(
    request: LLMCompletionRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const candidates = this.selectProviders(request);

    if (candidates.length === 0) {
      throw new Error(
        `No providers available for model: ${request.model ?? "default"}`,
      );
    }

    // For streaming, try the first matching provider
    yield* candidates[0].streamComplete(request);
  }

  /** Run health checks on all providers and return status. */
  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const checks = Array.from(this.providers.entries()).map(
      async ([name, provider]) => {
        try {
          results[name] = await provider.healthCheck();
        } catch {
          results[name] = false;
        }
      },
    );
    await Promise.all(checks);
    return results;
  }

  /** Select providers based on routing strategy. */
  private selectProviders(request: LLMCompletionRequest): LLMProvider[] {
    const allProviders = this.providerOrder
      .map((name) => this.providers.get(name))
      .filter((p): p is LLMProvider => p !== undefined);

    switch (this.config.strategy) {
      case "model-match":
        return this.selectByModelMatch(request, allProviders);
      case "round-robin":
        return this.selectByRoundRobin(allProviders);
      case "priority":
      default:
        return allProviders;
    }
  }

  private selectByModelMatch(
    request: LLMCompletionRequest,
    providers: LLMProvider[],
  ): LLMProvider[] {
    if (!request.model) {
      return providers;
    }

    // Find providers that support the requested model
    const matching = providers.filter((p) =>
      p.config.models.includes(request.model!),
    );

    // Fall back to all providers if no match found
    return matching.length > 0 ? matching : providers;
  }

  private selectByRoundRobin(providers: LLMProvider[]): LLMProvider[] {
    if (providers.length === 0) return [];
    const index = this.roundRobinIndex % providers.length;
    this.roundRobinIndex++;
    // Put the selected provider first, rest as fallbacks
    return [
      providers[index],
      ...providers.slice(0, index),
      ...providers.slice(index + 1),
    ];
  }

  /** Create a provider instance from configuration. */
  private createProvider(config: LLMProviderConfig): LLMProvider | undefined {
    switch (config.name.toLowerCase()) {
      case "ollama":
        return new OllamaProvider(config);
      case "deepseek":
        return new DeepSeekProvider(config);
      case "gemini":
        return new GeminiProvider(config);
      case "openai":
        return new OpenAICompatibleProvider(config);
      default:
        // For any unrecognised provider name, use the OpenAI-compatible
        // provider as a fallback — most modern LLM APIs speak the OpenAI
        // chat completions protocol.
        //
        // However, custom providers must specify a valid baseUrl (and at least
        // one model) or they will inevitably fail at request time (invalid
        // fetch URL or unroutable model). In that case, skip registration
        // by returning undefined instead of creating a broken provider.
        if (!config.baseUrl || config.baseUrl.trim().length === 0) {
          return undefined;
        }
        if (!Array.isArray(config.models) || config.models.length === 0) {
          return undefined;
        }
        return new OpenAICompatibleProvider(config);
    }
  }

  /**
   * Produce a stable SHA-256 key for in-flight deduplication.
   * Using a hash keeps key size constant (64 hex chars) regardless of
   * context window size, matching the approach used in CompletionCache.
   */
  private requestKey(request: LLMCompletionRequest): string {
    const normalized = JSON.stringify({
      model: request.model ?? "",
      temperature: request.temperature ?? 1,
      maxTokens: request.maxTokens ?? null,
      stream: request.stream ?? false,
      messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    });
    return createHash("sha256").update(normalized).digest("hex");
  }
}
