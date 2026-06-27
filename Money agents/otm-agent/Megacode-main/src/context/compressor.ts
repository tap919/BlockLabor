/**
 * Context Compressor for OverCoat.
 *
 * Kilo Code and OpenCode both struggle with large contexts: they either
 * truncate blindly or hit context-window errors. This compressor gives
 * OverCoat smart context management:
 *
 *  1. **Deduplication** — exact-duplicate messages are removed
 *  2. **Token estimation** — lightweight character-based estimate
 *     (~4 chars per token, matching GPT tokenisation averages)
 *  3. **Budget trimming** — when the estimated token count exceeds the
 *     budget, the oldest user/assistant pairs are dropped first while
 *     system messages (which contain critical instructions) are always
 *     preserved
 *  4. **Message truncation** — individual messages that are longer than
 *     `maxMessageChars` are truncated with an indicator
 *
 * This keeps the context as rich as possible within the model's limit,
 * which directly improves accuracy (the model never silently loses
 * context) and speed (fewer tokens = faster inference).
 */

import { LLMMessage } from "../llm/provider";

export interface CompressorConfig {
  /**
   * Maximum token budget for the entire context.
   * Default: 8192 tokens (safe for most models).
   */
  maxTokens: number;
  /**
   * Maximum characters per individual message before truncation.
   * Default: 16 000 chars (~4 000 tokens).
   */
  maxMessageChars: number;
  /**
   * Characters per token estimate used when an exact tokeniser is not
   * available. Default: 4 (matches GPT average).
   */
  charsPerToken: number;
}

export interface CompressionResult {
  messages: LLMMessage[];
  /** Estimated token count of the compressed messages. */
  estimatedTokens: number;
  /** How many messages were removed by deduplication. */
  duplicatesRemoved: number;
  /** How many messages were dropped to fit the token budget. */
  messagesDropped: number;
  /** How many messages were truncated in-place. */
  messagesTruncated: number;
  /** Whether any compression was applied. */
  compressed: boolean;
}

const DEFAULT_COMPRESSOR_CONFIG: CompressorConfig = {
  maxTokens: 8192,
  maxMessageChars: 16_000,
  charsPerToken: 4,
};

/**
 * Estimate the number of tokens in a string.
 * Uses the configured characters-per-token ratio.
 */
export function estimateTokens(text: string, charsPerToken = 4): number {
  return Math.ceil(text.length / charsPerToken);
}

/**
 * Estimate the total token count for a list of messages.
 * Adds a small overhead per message for role/formatting tokens.
 */
export function estimateMessagesTokens(
  messages: LLMMessage[],
  charsPerToken = 4,
): number {
  return messages.reduce((sum, m) => {
    return sum + estimateTokens(m.content, charsPerToken) + 4; // role + formatting
  }, 0);
}

/**
 * ContextCompressor applies smart compression to message arrays before
 * they are sent to an LLM, maximizing context quality within a token
 * budget.
 */
export class ContextCompressor {
  private config: CompressorConfig;

  constructor(config: Partial<CompressorConfig> = {}) {
    this.config = { ...DEFAULT_COMPRESSOR_CONFIG, ...config };
  }

  /**
   * Compress a message array to fit within the configured token budget.
   *
   * Steps (applied in order):
   *  1. Truncate messages that exceed `maxMessageChars`
   *  2. Remove consecutive exact duplicates
   *  3. Drop oldest user/assistant pairs until budget is met
   */
  compress(messages: LLMMessage[]): CompressionResult {
    let working = [...messages];
    let duplicatesRemoved = 0;
    let messagesDropped = 0;
    let messagesTruncated = 0;

    // Step 1 — truncate oversized individual messages
    working = working.map((m) => {
      if (m.content.length > this.config.maxMessageChars) {
        messagesTruncated++;
        return {
          ...m,
          content:
            m.content.slice(0, this.config.maxMessageChars) +
            `\n… [truncated: ${m.content.length - this.config.maxMessageChars} chars omitted]`,
        };
      }
      return m;
    });

    // Step 2 — remove exact duplicates (preserve the last occurrence)
    const seen = new Set<string>();
    const deduped: LLMMessage[] = [];
    for (let i = working.length - 1; i >= 0; i--) {
      const key = `${working[i].role}:${working[i].content}`;
      if (seen.has(key)) {
        duplicatesRemoved++;
        continue;
      }
      seen.add(key);
      deduped.unshift(working[i]);
    }
    working = deduped;

    // Step 3 — drop oldest non-system messages to fit the token budget
    while (
      estimateMessagesTokens(working, this.config.charsPerToken) >
      this.config.maxTokens
    ) {
      // Find the oldest non-system message index
      const dropIndex = working.findIndex((m) => m.role !== "system");
      if (dropIndex === -1) {
        // Only system messages remain — cannot drop further
        break;
      }
      working.splice(dropIndex, 1);
      messagesDropped++;
    }

    const estimatedTokens = estimateMessagesTokens(
      working,
      this.config.charsPerToken,
    );

    return {
      messages: working,
      estimatedTokens,
      duplicatesRemoved,
      messagesDropped,
      messagesTruncated,
      compressed:
        duplicatesRemoved > 0 ||
        messagesDropped > 0 ||
        messagesTruncated > 0,
    };
  }

  /** Estimate token count for a message array without compressing. */
  estimate(messages: LLMMessage[]): number {
    return estimateMessagesTokens(messages, this.config.charsPerToken);
  }

  /** Return the current compressor configuration. */
  get compressorConfig(): CompressorConfig {
    return { ...this.config };
  }
}
