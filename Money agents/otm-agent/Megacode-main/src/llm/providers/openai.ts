/**
 * OpenAI-Compatible LLM Provider for OverCoat.
 *
 * Connects to any OpenAI-compatible API endpoint, including:
 *  - OpenAI (api.openai.com)
 *  - Anthropic (via openai-compat proxy)
 *  - Mistral AI (api.mistral.ai)
 *  - Together AI
 *  - Groq
 *  - Any local server that implements the OpenAI chat completions API
 */

import {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  ModelCapabilities,
  ModelInfo,
} from "../provider";

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.name = config.name;
  }

  private get timeoutMs(): number {
    return this.config.timeoutMs ?? 30_000;
  }

  private get authHeader(): Record<string, string> {
    if (this.config.apiKey) {
      return { Authorization: `Bearer ${this.config.apiKey}` };
    }
    return {};
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: this.authHeader,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.config.apiKey) return this.config.models;
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: this.authHeader,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return this.config.models;
      const data = (await response.json()) as {
        data?: Array<{ id: string }>;
      };
      return data.data?.map((m) => m.id) ?? this.config.models;
    } catch {
      return this.config.models;
    }
  }

  async getModelInfo(modelId: string): Promise<ModelInfo | null> {
    const configuredModels = this.config.models;
    if (configuredModels.length > 0) {
      if (!configuredModels.includes(modelId)) {
        return null;
      }
    } else {
      const available = await this.listModels();
      if (!available.includes(modelId)) {
        return null;
      }
    }
    return {
      id: modelId,
      name: modelId,
      provider: this.name,
      capabilities: this.inferCapabilities(modelId),
    };
  }

  private inferCapabilities(modelId: string): ModelCapabilities {
    const normalized = modelId.toLowerCase();
    return {
      supportsFunctionCalling: true,
      supportsVision:
        normalized.includes("vision") || normalized.includes("4o"),
    };
  }

  async complete(
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    if (!this.config.apiKey) {
      throw new Error(`${this.name}: API key not configured`);
    }

    const model =
      request.model ?? this.config.defaultModel ?? "gpt-3.5-turbo";

    const response = await fetch(
      `${this.config.baseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeader,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: false,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`${this.name} request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content: string };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
    };

    return {
      content: data.choices?.[0]?.message?.content ?? "",
      model,
      provider: this.name,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: data.choices?.[0]?.finish_reason,
    };
  }

  async *streamComplete(
    request: LLMCompletionRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    if (!this.config.apiKey) {
      throw new Error(`${this.name}: API key not configured`);
    }

    const model =
      request.model ?? this.config.defaultModel ?? "gpt-3.5-turbo";

    const response = await fetch(
      `${this.config.baseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.authHeader,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `${this.name} stream request failed: ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error("No response body for streaming");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          if (payload === "[DONE]") {
            yield { content: "", done: true };
            return;
          }
          let chunk: {
            choices?: Array<{
              delta?: { content?: string };
              finish_reason?: string | null;
            }>;
          };
          try {
            chunk = JSON.parse(payload) as typeof chunk;
          } catch {
            continue; // skip malformed SSE chunks
          }
          const isDone = chunk.choices?.[0]?.finish_reason === "stop";
          yield {
            content: chunk.choices?.[0]?.delta?.content ?? "",
            done: isDone,
          };
          if (isDone) {
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
