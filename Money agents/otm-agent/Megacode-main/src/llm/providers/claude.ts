/**
 * Claude API Provider for OverCoat.
 * 
 * Supports Claude Opus 4.6 and Sonnet 4.6 models via Anthropic API.
 */

import {
  LLMProvider,
  LLMProviderConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMStreamChunk,
  LLMMessage,
} from "../provider";

export class ClaudeProvider implements LLMProvider {
  readonly name: string;
  readonly config: LLMProviderConfig;

  constructor(config: LLMProviderConfig) {
    this.config = config;
    this.name = config.name;
  }

  private get timeoutMs(): number {
    return this.config.timeoutMs ?? 60_000; // Claude can be slower
  }

  private get baseUrl(): string {
    return this.config.baseUrl || "https://api.anthropic.com/v1";
  }

  private get authHeader(): Record<string, string> {
    if (this.config.apiKey) {
      return {
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      };
    }
    return {};
  }

  /** Convert OpenAI-style messages to Claude format */
  private convertMessages(messages: LLMMessage[]): Array<{
    role: "user" | "assistant";
    content: string;
  }> {
    const claudeMessages: Array<{
      role: "user" | "assistant";
      content: string;
    }> = [];

    let currentRole: "user" | "assistant" | null = null;
    let currentContent: string[] = [];

    for (const message of messages) {
      // Claude doesn't have system role in messages array, we'll prepend it
      if (message.role === "system") {
        // Prepend system message to first user message
        if (claudeMessages.length === 0) {
          claudeMessages.push({
            role: "user",
            content: `System: ${message.content}\n\n`,
          });
        } else {
          // Add system content to existing user message
          claudeMessages[0].content = `System: ${message.content}\n\n${claudeMessages[0].content}`;
        }
        continue;
      }

      // Convert to Claude roles
      const claudeRole = message.role === "user" ? "user" : "assistant";

      if (currentRole === claudeRole) {
        // Continue same role
        currentContent.push(message.content);
      } else {
        // New role, push previous content
        if (currentRole && currentContent.length > 0) {
          claudeMessages.push({
            role: currentRole,
            content: currentContent.join("\n"),
          });
        }
        currentRole = claudeRole;
        currentContent = [message.content];
      }
    }

    // Push last message
    if (currentRole && currentContent.length > 0) {
      claudeMessages.push({
        role: currentRole,
        content: currentContent.join("\n"),
      });
    }

    return claudeMessages;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: this.authHeader,
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1,
          messages: [{ role: "user", content: "test" }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      // Claude returns 400 for bad requests, 401 for auth errors
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    // Claude has fixed models, return configured ones
    return this.config.models;
  }

  async complete(
    request: LLMCompletionRequest,
  ): Promise<LLMCompletionResponse> {
    if (!this.config.apiKey) {
      throw new Error(`${this.name}: API key not configured`);
    }

    const model =
      request.model ?? this.config.defaultModel ?? "claude-3-5-sonnet-20241022";

    const claudeMessages = this.convertMessages(request.messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: this.authHeader,
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model,
        messages: claudeMessages,
        temperature: request.temperature ?? 1.0,
        max_tokens: request.maxTokens ?? 4096,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${this.name} request failed (${response.status}): ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text: string }>;
      model?: string;
      usage?: {
        input_tokens: number;
        output_tokens: number;
      };
      stop_reason?: string;
    };

    const content = data.content
      ?.filter((item) => item.type === "text")
      .map((item) => item.text)
      .join("") || "";

    return {
      content,
      model: data.model || model,
      provider: this.name,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          }
        : undefined,
      finishReason: data.stop_reason,
    };
  }

  async *streamComplete(
    request: LLMCompletionRequest,
  ): AsyncGenerator<LLMStreamChunk, void, unknown> {
    if (!this.config.apiKey) {
      throw new Error(`${this.name}: API key not configured`);
    }

    const model =
      request.model ?? this.config.defaultModel ?? "claude-3-5-sonnet-20241022";

    const claudeMessages = this.convertMessages(request.messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: this.authHeader,
      signal: AbortSignal.timeout(this.timeoutMs),
      body: JSON.stringify({
        model,
        messages: claudeMessages,
        temperature: request.temperature ?? 1.0,
        max_tokens: request.maxTokens ?? 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `${this.name} stream request failed (${response.status}): ${errorText}`,
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
            type?: string;
            delta?: { type?: string; text?: string };
            message?: { content?: Array<{ type: string; text: string }> };
            usage?: { input_tokens: number; output_tokens: number };
            stop_reason?: string;
          };

          try {
            chunk = JSON.parse(payload) as typeof chunk;
          } catch {
            continue; // skip malformed SSE chunks
          }

          // Handle different chunk types
          if (chunk.type === "content_block_delta" && chunk.delta?.type === "text_delta") {
            yield {
              content: chunk.delta.text || "",
              done: false,
            };
          } else if (chunk.type === "message_stop") {
            yield { content: "", done: true };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}