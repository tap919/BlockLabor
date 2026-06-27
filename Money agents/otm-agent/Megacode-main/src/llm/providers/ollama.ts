/**
 * Ollama LLM Provider for OverCoat.
 *
 * Connects to a local Ollama instance for inference
 * with models like Llama, CodeLlama, Mistral, etc.
 */

import {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  ModelInfo,
} from "../provider";

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  private get timeoutMs(): number {
    return this.config.timeoutMs ?? 30_000;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return this.config.models;
      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      return data.models?.map((m) => m.name) ?? this.config.models;
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

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const model = request.model ?? this.config.defaultModel ?? "llama3";

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };

    return {
      content: data.message?.content ?? "",
      model,
      provider: this.name,
      usage: {
        promptTokens: data.prompt_eval_count ?? 0,
        completionTokens: data.eval_count ?? 0,
        totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
      },
      finishReason: "stop",
    };
  }

  async *streamComplete(
    request: LLMCompletionRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    const model = request.model ?? this.config.defaultModel ?? "llama3";

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama stream request failed: ${response.statusText}`);
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
          if (!line.trim()) continue;
          let chunk: { message?: { content: string }; done: boolean };
          try {
            chunk = JSON.parse(line) as { message?: { content: string }; done: boolean };
          } catch {
            continue; // skip malformed chunks
          }
          yield {
            content: chunk.message?.content ?? "",
            done: chunk.done,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
