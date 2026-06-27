/**
 * LLM Provider interface for OverCoat multi-LLM support.
 *
 * Defines the contract that all LLM providers must implement,
 * enabling the router to work with Ollama, DeepSeek, Gemini,
 * and other providers through a unified interface.
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCompletionRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMCompletionResponse {
  content: string;
  model: string;
  provider: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

export interface LLMProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
  defaultModel?: string;
  enabled: boolean;
  /** Request timeout in milliseconds. Default: 30 000 ms (30 s). */
  timeoutMs?: number;
}

/**
 * Model capability flags inspired by Claude Code 2.1.49.
 * Allows routers to adapt behavior based on what a model supports.
 */
export interface ModelCapabilities {
  /** Whether the model supports effort/thinking modes */
  supportsEffort?: boolean;
  /** Supported effort levels (e.g., ["low", "medium", "high"]) */
  supportedEffortLevels?: string[];
  /** Whether the model supports adaptive thinking */
  supportsAdaptiveThinking?: boolean;
  /** Maximum context window size in tokens */
  maxContextTokens?: number;
  /** Whether the model supports function calling/tools */
  supportsFunctionCalling?: boolean;
  /** Whether the model supports vision/image inputs */
  supportsVision?: boolean;
}

/**
 * Model information with capability metadata.
 */
export interface ModelInfo {
  /** Model identifier (e.g., "claude-sonnet-4.5", "gpt-4") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider that hosts this model */
  provider: string;
  /** Model capabilities */
  capabilities: ModelCapabilities;
}

export interface LLMProvider {
  readonly name: string;
  readonly config: LLMProviderConfig;

  /** Check if the provider is reachable and ready. */
  healthCheck(): Promise<boolean>;

  /** List available models from this provider. */
  listModels(): Promise<string[]>;

  /**
   * Get detailed information and capabilities for a specific model.
   * Inspired by Claude Code 2.1.49's model capability discovery.
   */
  getModelInfo(modelId: string): Promise<ModelInfo | null>;

  /** Send a completion request and get a full response. */
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;

  /** Send a streaming completion request. */
  streamComplete(
    request: LLMCompletionRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown>;
}
