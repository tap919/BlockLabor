/**
 * CompactSummarizer + TokenBudgetGuard — Items #22 & #30 (Claude Code skills)
 *
 * CompactSummarizer (#22): When a conversation grows too long, automatically
 *   summarise the earliest turns into a dense system-level summary that fits
 *   within the remaining token budget — the same technique used by Claude Code's
 *   /compact command.
 *
 * TokenBudgetGuard (#30): Tracks token usage against a configurable budget and
 *   raises warnings (or auto-triggers CompactSummarizer) when usage approaches
 *   the limit.
 */

// ============================================================================
// Types
// ============================================================================

/** A conversation message (subset of LLMMessage). */
export interface SummarizerMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Result of a compaction operation. */
export interface CompactResult {
  /** Messages after compaction (summary + remaining recent turns). */
  messages: SummarizerMessage[];
  /** Number of tokens saved vs the original message list. */
  tokensSaved: number;
  /** Number of messages that were summarised away. */
  messagesSummarised: number;
  /** The summary text that replaced the early turns. */
  summaryText: string;
}

/** Configuration for CompactSummarizer. */
export interface CompactSummarizerConfig {
  /**
   * Target token budget after compaction.
   * Messages beyond this budget (counting from the end) will be summarised.
   * Default: 4000 tokens.
   */
  targetBudget?: number;
  /**
   * Number of recent turns to always keep verbatim (never summarised).
   * Default: 6.
   */
  keepRecentTurns?: number;
  /**
   * Custom function that calls an LLM to generate the summary.
   * If omitted, a simple extractive summariser is used.
   */
  summariseWith?: (transcript: string) => Promise<string>;
  /**
   * Token estimation function. Defaults to rough word-count heuristic.
   */
  estimateTokens?: (text: string) => number;
}

// ============================================================================
// Token estimation
// ============================================================================

/**
 * Rough token estimator: ~0.75 tokens per word on average (works for English).
 */
export function roughTokenEstimate(text: string): number {
  return Math.ceil(text.split(/\s+/).filter(Boolean).length * 1.33);
}

// ============================================================================
// CompactSummarizer (Item #22)
// ============================================================================

/**
 * CompactSummarizer: Trims long conversation histories into a token budget by
 * summarising the oldest turns.
 *
 * Usage:
 *   const cs = new CompactSummarizer({ targetBudget: 4000, keepRecentTurns: 6 });
 *   const { messages } = await cs.compact(conversation);
 */
export class CompactSummarizer {
  private config: Required<Omit<CompactSummarizerConfig, "summariseWith">> & {
    summariseWith?: CompactSummarizerConfig["summariseWith"];
  };

  constructor(config: CompactSummarizerConfig = {}) {
    this.config = {
      targetBudget: config.targetBudget ?? 4000,
      keepRecentTurns: config.keepRecentTurns ?? 6,
      summariseWith: config.summariseWith,
      estimateTokens: config.estimateTokens ?? roughTokenEstimate,
    };
  }

  /**
   * Compact the message list to fit within `targetBudget` tokens.
   *
   * Strategy:
   * 1. Always keep system messages at the top.
   * 2. Always keep the `keepRecentTurns` most recent turns verbatim.
   * 3. Summarise everything in between.
   */
  async compact(messages: SummarizerMessage[]): Promise<CompactResult> {
    const { targetBudget, keepRecentTurns, estimateTokens } = this.config;

    const totalTokens = messages.reduce(
      (s, m) => s + estimateTokens(m.content),
      0
    );

    // Already within budget — nothing to do
    if (totalTokens <= targetBudget) {
      return {
        messages: [...messages],
        tokensSaved: 0,
        messagesSummarised: 0,
        summaryText: "",
      };
    }

    // Partition: system preamble, compactable middle, recent tail
    const systemMsgs = messages.filter((m) => m.role === "system");
    const nonSystem = messages.filter((m) => m.role !== "system");

    const keepCount = Math.min(keepRecentTurns, nonSystem.length);
    const toSummarise = nonSystem.slice(0, nonSystem.length - keepCount);
    const tail = nonSystem.slice(nonSystem.length - keepCount);

    if (toSummarise.length === 0) {
      return {
        messages: [...messages],
        tokensSaved: 0,
        messagesSummarised: 0,
        summaryText: "",
      };
    }

    // Build transcript for summarisation
    const transcript = toSummarise
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    // Summarise
    const summaryText = this.config.summariseWith
      ? await this.config.summariseWith(transcript)
      : this._extractiveSummary(transcript);

    // Build compacted message list
    const summaryMessage: SummarizerMessage = {
      role: "system",
      content: `[Conversation summary — earlier turns compacted]\n${summaryText}`,
    };

    const compacted: SummarizerMessage[] = [...systemMsgs, summaryMessage, ...tail];

    const tokensBefore = toSummarise.reduce(
      (s, m) => s + estimateTokens(m.content),
      0
    );
    const tokensAfter = estimateTokens(summaryMessage.content);

    return {
      messages: compacted,
      tokensSaved: Math.max(0, tokensBefore - tokensAfter),
      messagesSummarised: toSummarise.length,
      summaryText,
    };
  }

  /**
   * Returns the estimated token count of the message list.
   */
  estimateTokens(messages: SummarizerMessage[]): number {
    return messages.reduce(
      (s, m) => s + this.config.estimateTokens(m.content),
      0
    );
  }

  // --------------------------------------------------------------------------
  // Extractive summariser (no LLM required)
  // --------------------------------------------------------------------------

  private _extractiveSummary(transcript: string): string {
    const lines = transcript.split("\n").filter((l) => l.trim().length > 20);
    // Keep first line of each speaker turn (key decision / statement)
    const kept = new Set<string>();
    const result: string[] = [];
    for (const line of lines) {
      const key = line.slice(0, 60);
      if (!kept.has(key)) {
        kept.add(key);
        result.push(line.trim());
        if (result.length >= 20) break;
      }
    }
    return result.join("\n");
  }
}

// ============================================================================
// TokenBudgetGuard (Item #30)
// ============================================================================

/** Budget status returned by TokenBudgetGuard. */
export interface BudgetStatus {
  /** Current token count. */
  used: number;
  /** Maximum allowed tokens. */
  budget: number;
  /** Remaining tokens. */
  remaining: number;
  /** Usage percentage (0-100). */
  usagePercent: number;
  /** Current alert level. */
  level: "ok" | "warn" | "critical" | "exceeded";
}

/** Configuration for TokenBudgetGuard. */
export interface TokenBudgetGuardConfig {
  /** Hard maximum token budget. Default: 8000. */
  maxTokens?: number;
  /** Percentage at which "warn" fires. Default: 75. */
  warnThresholdPercent?: number;
  /** Percentage at which "critical" fires. Default: 90. */
  criticalThresholdPercent?: number;
  /** Token estimator. Defaults to roughTokenEstimate. */
  estimateTokens?: (text: string) => number;
  /** Callback when warn threshold is crossed. */
  onWarn?: (status: BudgetStatus) => void;
  /** Callback when critical threshold is crossed. */
  onCritical?: (status: BudgetStatus) => void;
  /** Callback when budget is exceeded. */
  onExceeded?: (status: BudgetStatus) => void;
}

/**
 * TokenBudgetGuard: Tracks cumulative token usage and fires callbacks when
 * configurable thresholds are crossed.
 *
 * Usage:
 *   const guard = new TokenBudgetGuard({ maxTokens: 8000, onWarn: (s) => console.warn(s) });
 *   guard.add("user", "Hello world");
 *   const status = guard.status();
 */
export class TokenBudgetGuard {
  private cfg: Required<TokenBudgetGuardConfig>;
  private usedTokens = 0;
  private lastLevel: BudgetStatus["level"] = "ok";

  constructor(config: TokenBudgetGuardConfig = {}) {
    this.cfg = {
      maxTokens: config.maxTokens ?? 8000,
      warnThresholdPercent: config.warnThresholdPercent ?? 75,
      criticalThresholdPercent: config.criticalThresholdPercent ?? 90,
      estimateTokens: config.estimateTokens ?? roughTokenEstimate,
      onWarn: config.onWarn ?? (() => undefined),
      onCritical: config.onCritical ?? (() => undefined),
      onExceeded: config.onExceeded ?? (() => undefined),
    };
  }

  /**
   * Add a piece of text (message content) to the tracked usage.
   * Fires callbacks if thresholds are crossed.
   */
  add(role: string, content: string): BudgetStatus {
    const tokens = this.cfg.estimateTokens(`${role}: ${content}`);
    this.usedTokens += tokens;
    return this._checkThresholds();
  }

  /**
   * Add a raw token count directly (e.g. from provider usage stats).
   */
  addTokens(count: number): BudgetStatus {
    this.usedTokens += count;
    return this._checkThresholds();
  }

  /** Get the current budget status without adding anything. */
  status(): BudgetStatus {
    const usagePercent = Math.min(100, (this.usedTokens / this.cfg.maxTokens) * 100);
    const level: BudgetStatus["level"] =
      this.usedTokens >= this.cfg.maxTokens
        ? "exceeded"
        : usagePercent >= this.cfg.criticalThresholdPercent
        ? "critical"
        : usagePercent >= this.cfg.warnThresholdPercent
        ? "warn"
        : "ok";

    return {
      used: this.usedTokens,
      budget: this.cfg.maxTokens,
      remaining: Math.max(0, this.cfg.maxTokens - this.usedTokens),
      usagePercent,
      level,
    };
  }

  /** Reset token counter to zero. */
  reset(): void {
    this.usedTokens = 0;
    this.lastLevel = "ok";
  }

  /** Whether the budget has been exceeded. */
  get isExceeded(): boolean {
    return this.usedTokens >= this.cfg.maxTokens;
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _checkThresholds(): BudgetStatus {
    const s = this.status();

    if (s.level !== this.lastLevel) {
      if (s.level === "warn" && this.lastLevel === "ok") this.cfg.onWarn(s);
      if (s.level === "critical") this.cfg.onCritical(s);
      if (s.level === "exceeded") this.cfg.onExceeded(s);
      this.lastLevel = s.level;
    }

    return s;
  }
}
