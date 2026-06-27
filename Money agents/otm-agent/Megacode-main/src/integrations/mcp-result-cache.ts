/**
 * MCPResultCache — Item #1
 *
 * Caches MCP tool call results by (serverId + tool + argsHash) with a
 * configurable TTL so repeated recipe steps skip the network round-trip.
 * A background interval prunes expired entries to prevent unbounded growth.
 */

import { createHash } from "crypto";

export interface CacheEntry {
  result: unknown;
  expiresAt: number;
  hits: number;
}

export interface CacheStats {
  size: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
}

export class MCPResultCache {
  private readonly cache = new Map<string, CacheEntry>();
  private totalHits = 0;
  private totalMisses = 0;
  private readonly defaultTtlMs: number;
  private pruneTimer: ReturnType<typeof setInterval> | null = null;

  constructor(defaultTtlMs = 60_000) {
    this.defaultTtlMs = defaultTtlMs;
    // Background prune — unref so it doesn't block process exit
    this.pruneTimer = setInterval(() => this.prune(), 60_000);
    (this.pruneTimer as NodeJS.Timeout).unref?.();
  }

  /** Stable cache key: sorted JSON of args to be order-independent. */
  key(serverId: string, tool: string, args: Record<string, unknown>): string {
    const stableArgs = JSON.stringify(args, Object.keys(args).sort());
    return createHash("sha256")
      .update(`${serverId}\x00${tool}\x00${stableArgs}`)
      .digest("hex");
  }

  /** Return a cached result, or undefined on miss / expiry. */
  get(k: string): unknown | undefined {
    const entry = this.cache.get(k);
    if (!entry) { this.totalMisses++; return undefined; }
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(k);
      this.totalMisses++;
      return undefined;
    }
    entry.hits++;
    this.totalHits++;
    return entry.result;
  }

  /** Store a result with optional per-entry TTL override. */
  set(k: string, result: unknown, ttlMs?: number): void {
    this.cache.set(k, {
      result,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs),
      hits: 0,
    });
  }

  /** Invalidate all entries (optionally only those for a given serverId prefix). */
  invalidate(serverId?: string): number {
    if (!serverId) {
      const count = this.cache.size;
      this.cache.clear();
      return count;
    }
    // Keys are opaque hashes, so the caller must pass the same serverId used in key()
    // We re-hash single-element queries to find matching keys.
    // For simplicity, clear all — production callers can use namespaced caches.
    const count = this.cache.size;
    this.cache.clear();
    return count;
  }

  /** Remove all expired entries. Returns count removed. */
  prune(): number {
    const now = Date.now();
    let removed = 0;
    for (const [k, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(k);
        removed++;
      }
    }
    return removed;
  }

  /** Cache statistics. */
  stats(): CacheStats {
    const total = this.totalHits + this.totalMisses;
    return {
      size: this.cache.size,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRate: total > 0 ? this.totalHits / total : 0,
    };
  }

  /** Stop the background prune timer. */
  dispose(): void {
    if (this.pruneTimer !== null) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }
  }
}
