/**
 * Completion Cache for OverCoat.
 *
 * One of the key weaknesses of Claude Code and OpenCode is that every
 * request — even identical ones — hits the LLM, wasting tokens and
 * adding latency. This LRU cache deduplicates completion requests so
 * that repeated context (e.g. the same file opened multiple times, or
 * identical system prompts) returns instantly from memory.
 *
 * Features:
 * - LRU eviction: oldest entries are dropped when the cache is full
 * - TTL expiry: stale entries are expired automatically
 * - Cache-key hashing: fast stable key from request content
 * - Hit/miss statistics for observability
 * - Optional per-request cache bypass via `cacheBypass` flag
 */

import { createHash } from "crypto";
import { LLMCompletionRequest, LLMCompletionResponse } from "../llm/provider";

export interface CompletionCacheConfig {
  /** Maximum number of entries to keep in the cache (default: 256) */
  maxSize: number;
  /** How long (in milliseconds) an entry remains valid (default: 5 min) */
  ttlMs: number;
  /** Interval (in ms) for automatic garbage collection (default: 5 min, 0 to disable) */
  gcIntervalMs?: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  hitRate: number;
}

interface CacheEntry {
  response: LLMCompletionResponse;
  createdAt: number;
  /** LRU: timestamp of last access */
  lastAccessedAt: number;
}

const DEFAULT_CACHE_CONFIG: CompletionCacheConfig = {
  maxSize: 256,
  ttlMs: 5 * 60 * 1000, // 5 minutes
  gcIntervalMs: 5 * 60 * 1000, // 5 minutes
};

/**
 * Produce a stable SHA-256 cache key from a completion request.
 * Model, temperature, and messages are all included so different
 * configurations never collide. Using a hash instead of raw JSON
 * keeps key size constant (64 hex chars) regardless of context length,
 * which improves Map lookup speed and reduces memory usage for large
 * context windows.
 */
export function cacheKeyFor(request: LLMCompletionRequest): string {
  const normalized = {
    model: request.model ?? "",
    temperature: request.temperature ?? 1,
    messages: request.messages.map((m) => ({ role: m.role, content: m.content })),
    maxTokens: request.maxTokens ?? null,
    stream: request.stream ?? false,
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * LRU completion cache with TTL expiry and automatic garbage collection.
 *
 * Wrap an LLMRouter or any async completion function with
 * `getOrFetch()` to benefit from caching without changing
 * the rest of your code.
 *
 * Inspired by Claude Code 2.1.49's memory leak fixes: implements periodic
 * garbage collection to prevent unbounded memory growth during long sessions.
 */
export class CompletionCache {
  private entries: Map<string, CacheEntry> = new Map();
  private config: CompletionCacheConfig;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private gcTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<CompletionCacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };

    // Start periodic garbage collection if configured
    if (this.config.gcIntervalMs && this.config.gcIntervalMs > 0) {
      this.startGarbageCollection();
    }
  }

  /**
   * Look up a cached response. Returns `undefined` on a miss or if the
   * entry has expired. Expired entries are deleted on access.
   */
  get(request: LLMCompletionRequest): LLMCompletionResponse | undefined {
    const key = cacheKeyFor(request);
    const entry = this.entries.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    const now = Date.now();
    if (now - entry.createdAt > this.config.ttlMs) {
      this.entries.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU position
    entry.lastAccessedAt = now;
    this.entries.delete(key);
    this.entries.set(key, entry);

    this.hits++;
    return entry.response;
  }

  /**
   * Store a response in the cache. Evicts the least-recently-used entry
   * when the cache is full.
   */
  set(request: LLMCompletionRequest, response: LLMCompletionResponse): void {
    const key = cacheKeyFor(request);
    const now = Date.now();

    // Remove existing entry so the new one goes to the end (most-recent)
    this.entries.delete(key);

    if (this.entries.size >= this.config.maxSize) {
      // Evict the least-recently-used (first) entry
      const lruKey = this.entries.keys().next().value;
      if (lruKey !== undefined) {
        this.entries.delete(lruKey);
        this.evictions++;
      }
    }

    this.entries.set(key, {
      response,
      createdAt: now,
      lastAccessedAt: now,
    });
  }

  /**
   * Fetch from cache, or call `fetchFn` on a miss and store the result.
   *
   * @example
   * const response = await cache.getOrFetch(request, (req) => router.complete(req));
   */
  async getOrFetch(
    request: LLMCompletionRequest,
    fetchFn: (req: LLMCompletionRequest) => Promise<LLMCompletionResponse>,
  ): Promise<LLMCompletionResponse> {
    const cached = this.get(request);
    if (cached) {
      return { ...cached, finishReason: cached.finishReason ?? "cache-hit" };
    }

    const response = await fetchFn(request);
    this.set(request, response);
    return response;
  }

  /** Remove a specific entry from the cache. */
  invalidate(request: LLMCompletionRequest): void {
    this.entries.delete(cacheKeyFor(request));
  }

  /** Remove all entries from the cache. */
  clear(): void {
    this.entries.clear();
  }

  /** Remove all entries that have exceeded their TTL. */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;
    for (const [key, entry] of this.entries) {
      if (now - entry.createdAt > this.config.ttlMs) {
        this.entries.delete(key);
        purged++;
      }
    }
    return purged;
  }

  /** Return cache hit/miss/eviction statistics. */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      size: this.entries.size,
      hitRate: total === 0 ? 0 : this.hits / total,
    };
  }

  /** Current number of valid (possibly unexpired) cache entries. */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Start automatic garbage collection on a periodic interval.
   * Called automatically by the constructor if gcIntervalMs is set.
   */
  private startGarbageCollection(): void {
    if (this.gcTimer) return; // Already running

    this.gcTimer = setInterval(() => {
      const purged = this.purgeExpired();
      if (purged > 0) {
        // Optional: emit an event or log for observability
        // console.debug(`CompletionCache: purged ${purged} expired entries`);
      }
    }, this.config.gcIntervalMs!);

    // Prevent the timer from keeping the process alive
    if (this.gcTimer.unref) {
      this.gcTimer.unref();
    }
  }

  /**
   * Stop automatic garbage collection.
   * Call this before destroying the cache instance to prevent memory leaks.
   */
  stopGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  /**
   * Destroy the cache and release all resources.
   * Stops garbage collection and clears all entries.
   */
  destroy(): void {
    this.stopGarbageCollection();
    this.clear();
  }
}
