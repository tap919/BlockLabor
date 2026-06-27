/**
 * DeepSeek LLM Provider for OverCoat.
 *
 * Connects to the DeepSeek API for code-focused inference
 * using models like DeepSeek-Coder and DeepSeek-Chat.
 */

import {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  ModelInfo,
} from "../provider";

export class DeepSeekProvider implements LLMProvider {
  readonly name = "deepseek";
  readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  private get timeoutMs(): number {
    return this.config.timeoutMs ?? 30_000;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
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
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
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
      capabilities: {},
    };
  }

  async complete(
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    if (!this.config.apiKey) {
      throw new Error("DeepSeek API key not configured");
    }

    const model =
      request.model ?? this.config.defaultModel ?? "deepseek-coder";

    const response = await fetch(
      `${this.config.baseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
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
      throw new Error(`DeepSeek request failed: ${response.statusText}`);
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
      throw new Error("DeepSeek API key not configured");
    }

    const model =
      request.model ?? this.config.defaultModel ?? "deepseek-coder";

    const response = await fetch(
      `${this.config.baseUrl}/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
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
        `DeepSeek stream request failed: ${response.statusText}`,
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
          yield {
            content: chunk.choices?.[0]?.delta?.content ?? "",
            done: chunk.choices?.[0]?.finish_reason === "stop",
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
