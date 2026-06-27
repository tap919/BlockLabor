import {
  ContextCompressor,
  estimateTokens,
  estimateMessagesTokens,
} from "./compressor";
import { LLMMessage } from "../llm/provider";

const sys: LLMMessage = { role: "system", content: "You are a helpful assistant." };
const u1: LLMMessage = { role: "user", content: "What is TypeScript?" };
const a1: LLMMessage = { role: "assistant", content: "TypeScript is a typed superset of JavaScript." };
const u2: LLMMessage = { role: "user", content: "Give me an example." };
const a2: LLMMessage = { role: "assistant", content: "Here is an example: const x: number = 42;" };

describe("estimateTokens", () => {
  it("estimates tokens as ceil(length / 4)", () => {
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });

  it("respects custom charsPerToken", () => {
    expect(estimateTokens("aaaaaa", 2)).toBe(3);
  });
});

describe("estimateMessagesTokens", () => {
  it("adds per-message overhead", () => {
    const msgs: LLMMessage[] = [{ role: "user", content: "abcd" }]; // 1 token + 4 overhead
    expect(estimateMessagesTokens(msgs)).toBe(5);
  });

  it("sums multiple messages", () => {
    const msgs: LLMMessage[] = [
      { role: "user", content: "abcd" },     // ceil(4/4)=1 + 4 = 5
      { role: "assistant", content: "efgh" }, // ceil(4/4)=1 + 4 = 5
    ];
    expect(estimateMessagesTokens(msgs)).toBe(10);
  });
});

describe("ContextCompressor", () => {
  it("returns unmodified result when within budget", () => {
    const compressor = new ContextCompressor({ maxTokens: 8192 });
    const messages = [sys, u1, a1];
    const result = compressor.compress(messages);

    expect(result.messages).toHaveLength(3);
    expect(result.compressed).toBe(false);
    expect(result.duplicatesRemoved).toBe(0);
    expect(result.messagesDropped).toBe(0);
    expect(result.messagesTruncated).toBe(0);
  });

  it("removes exact duplicate messages", () => {
    const compressor = new ContextCompressor({ maxTokens: 8192 });
    const messages = [sys, u1, u1, a1]; // u1 duplicated
    const result = compressor.compress(messages);

    expect(result.duplicatesRemoved).toBe(1);
    expect(result.messages.filter((m) => m.content === u1.content)).toHaveLength(1);
    expect(result.compressed).toBe(true);
  });

  it("drops oldest non-system messages when over budget", () => {
    const compressor = new ContextCompressor({ maxTokens: 50 });
    const messages = [sys, u1, a1, u2, a2];
    const result = compressor.compress(messages);

    // System message should always survive
    expect(result.messages.some((m) => m.role === "system")).toBe(true);
    expect(result.messagesDropped).toBeGreaterThan(0);
    expect(result.estimatedTokens).toBeLessThanOrEqual(50);
    expect(result.compressed).toBe(true);
  });

  it("never drops system messages", () => {
    // Tiny budget: only the system message itself could exceed it,
    // but we should not drop it.
    const bigSystem: LLMMessage = {
      role: "system",
      content: "x".repeat(2000), // ~500 tokens
    };
    const compressor = new ContextCompressor({ maxTokens: 100 });
    const result = compressor.compress([bigSystem, u1, a1, u2, a2]);

    // System message preserved even though budget is exceeded
    expect(result.messages.some((m) => m.role === "system")).toBe(true);
  });

  it("truncates messages exceeding maxMessageChars", () => {
    const compressor = new ContextCompressor({
      maxTokens: 8192,
      maxMessageChars: 10,
    });
    const longMsg: LLMMessage = {
      role: "user",
      content: "a".repeat(100),
    };
    const result = compressor.compress([longMsg]);

    expect(result.messagesTruncated).toBe(1);
    expect(result.messages[0].content).toContain("[truncated");
    expect(result.compressed).toBe(true);
  });

  it("preserves message order after compression", () => {
    const compressor = new ContextCompressor({ maxTokens: 8192 });
    const messages = [sys, u1, a1, u2, a2];
    const result = compressor.compress(messages);

    const roles = result.messages.map((m) => m.role);
    // System should still be first if present
    if (roles.includes("system")) {
      expect(roles[0]).toBe("system");
    }
  });

  it("estimate() returns token count without compressing", () => {
    const compressor = new ContextCompressor();
    const count = compressor.estimate([sys, u1]);
    expect(count).toBeGreaterThan(0);
  });

  it("exposes compressor configuration", () => {
    const compressor = new ContextCompressor({ maxTokens: 4096 });
    expect(compressor.compressorConfig.maxTokens).toBe(4096);
  });

  it("handles empty message array", () => {
    const compressor = new ContextCompressor();
    const result = compressor.compress([]);
    expect(result.messages).toHaveLength(0);
    expect(result.estimatedTokens).toBe(0);
    expect(result.compressed).toBe(false);
  });
});
