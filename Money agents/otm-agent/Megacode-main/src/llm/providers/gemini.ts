/**
 * Google Gemini LLM Provider for OverCoat.
 *
 * Connects to the Google Generative AI API for inference
 * using Gemini Pro and other Gemini models.
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

/** Map from standard role names to Gemini role names. */
function toGeminiRole(role: string): string {
  switch (role) {
    case "assistant":
      return "model";
    case "system":
    case "user":
    default:
      return "user";
  }
}

export class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
  }

  private get apiBase(): string {
    return `${this.config.baseUrl}/v1beta`;
  }

  private get timeoutMs(): number {
    return this.config.timeoutMs ?? 30_000;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.apiBase}/models`, {
        headers: { "x-goog-api-key": this.config.apiKey },
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
      const response = await fetch(`${this.apiBase}/models`, {
        headers: { "x-goog-api-key": this.config.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return this.config.models;
      const data = (await response.json()) as {
        models?: Array<{ name: string }>;
      };
      return (
        data.models?.map((m) => m.name.replace("models/", "")) ??
        this.config.models
      );
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
      supportsVision: normalized.includes("vision"),
    };
  }

  async complete(
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    if (!this.config.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const model = request.model ?? this.config.defaultModel ?? "gemini-pro";

    // Separate system instruction from conversation messages
    const systemMessages = request.messages.filter(
      (m) => m.role === "system",
    );
    const conversationMessages = request.messages.filter(
      (m) => m.role !== "system",
    );

    const body: Record<string, unknown> = {
      contents: conversationMessages.map((m) => ({
        role: toGeminiRole(m.role),
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    };

    if (systemMessages.length > 0) {
      body.systemInstruction = {
        parts: [{ text: systemMessages.map((m) => m.content).join("\n") }],
      };
    }

    const response = await fetch(
      `${this.apiBase}/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini request failed: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text: string }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount: number;
        candidatesTokenCount: number;
        totalTokenCount: number;
      };
    };

    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .join("") ?? "";

    return {
      content: text,
      model,
      provider: this.name,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount,
            completionTokens: data.usageMetadata.candidatesTokenCount,
            totalTokens: data.usageMetadata.totalTokenCount,
          }
        : undefined,
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }

  async *streamComplete(
    request: LLMCompletionRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    if (!this.config.apiKey) {
      throw new Error("Gemini API key not configured");
    }

    const model = request.model ?? this.config.defaultModel ?? "gemini-pro";

    const systemMessages = request.messages.filter(
      (m) => m.role === "system",
    );
    const conversationMessages = request.messages.filter(
      (m) => m.role !== "system",
    );

    const body: Record<string, unknown> = {
      contents: conversationMessages.map((m) => ({
        role: toGeminiRole(m.role),
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    };

    if (systemMessages.length > 0) {
      body.systemInstruction = {
        parts: [{ text: systemMessages.map((m) => m.content).join("\n") }],
      };
    }

    const response = await fetch(
      `${this.apiBase}/models/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.apiKey,
        },
        signal: AbortSignal.timeout(this.timeoutMs),
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Gemini stream request failed: ${response.statusText}`,
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
        if (done) {
          yield { content: "", done: true };
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const payload = trimmed.slice(6);
          let chunk: {
            candidates?: Array<{
              content?: { parts?: Array<{ text: string }> };
              finishReason?: string;
            }>;
          };
          try {
            chunk = JSON.parse(payload) as typeof chunk;
          } catch {
            continue; // skip malformed SSE chunks
          }
          const text =
            chunk.candidates?.[0]?.content?.parts
              ?.map((p) => p.text)
              .join("") ?? "";
          yield {
            content: text,
            done: chunk.candidates?.[0]?.finishReason === "STOP",
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
