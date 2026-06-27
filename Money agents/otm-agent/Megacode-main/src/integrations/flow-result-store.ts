/**
 * Flow Result Store and Unified Error Log for Megacode (OverCoat).
 *
 * FlowResultStore (#43) — Persists every FlowResult produced during a session
 * so they can be queried, compared, and exported without re-running flows.
 *
 * UnifiedErrorLog (#49) — A single append-only log that collects errors from
 * all subsystems (MCP servers, flows, LLM calls, plugins) and exposes query
 * and export capabilities.
 */

import type { FlowResult } from "./mcp-flow-coordinator";

// ============================================================================
// FlowResultStore (#43)
// ============================================================================

export interface StoredFlowResult {
  /** Unique storage key (flow name + timestamp). */
  key: string;
  /** When the result was stored (ms since epoch). */
  storedAt: number;
  /** The actual flow result. */
  result: FlowResult;
}

export interface FlowResultQuery {
  /** Filter by flow name substring (case-insensitive). */
  flowName?: string;
  /** Include only successful results. */
  successOnly?: boolean;
  /** Maximum number of results to return (most recent first). */
  limit?: number;
  /** Minimum `storedAt` timestamp. */
  since?: number;
}

/**
 * In-memory store for flow execution results.
 *
 * Supports append, query, and export. Results are kept in insertion order
 * and indexed by key for O(1) lookup.
 */
export class FlowResultStore {
  private entries: StoredFlowResult[] = [];
  private index = new Map<string, StoredFlowResult>();

  /** Append a new FlowResult. Returns the storage key. */
  store(result: FlowResult): string {
    let key = `${result.flowName}-${result.context.startedAt}`;
    // Avoid key collisions when the same flow runs multiple times in the same ms
    let suffix = 0;
    while (this.index.has(key)) {
      suffix++;
      key = `${result.flowName}-${result.context.startedAt}-${suffix}`;
    }
    const entry: StoredFlowResult = {
      key,
      storedAt: Date.now(),
      result,
    };
    this.entries.push(entry);
    this.index.set(key, entry);
    return key;
  }

  /** Get a single result by its storage key. */
  get(key: string): StoredFlowResult | undefined {
    return this.index.get(key);
  }

  /** Query stored results. Returns most-recent first. */
  query(q: FlowResultQuery = {}): StoredFlowResult[] {
    let results = [...this.entries].reverse(); // newest first

    if (q.flowName) {
      const needle = q.flowName.toLowerCase();
      results = results.filter(e => e.result.flowName.toLowerCase().includes(needle));
    }

    if (q.successOnly) {
      results = results.filter(e => e.result.success);
    }

    if (q.since !== undefined) {
      results = results.filter(e => e.storedAt >= q.since!);
    }

    if (q.limit !== undefined && q.limit > 0) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  /** How many results are stored. */
  size(): number {
    return this.entries.length;
  }

  /** Remove all stored results. */
  clear(): void {
    this.entries = [];
    this.index.clear();
  }

  /** Export all stored results as a JSON string. */
  exportJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }

  /** Import previously-exported results (merges, skips duplicates). */
  importJSON(json: string): number {
    let imported = 0;
    try {
      const parsed = JSON.parse(json) as StoredFlowResult[];
      for (const entry of parsed) {
        if (!this.index.has(entry.key)) {
          this.entries.push(entry);
          this.index.set(entry.key, entry);
          imported++;
        }
      }
    } catch {
      // Invalid JSON — ignore
    }
    return imported;
  }

  /** Delete a single entry by key. Returns true if found and deleted. */
  delete(key: string): boolean {
    if (!this.index.has(key)) return false;
    this.entries = this.entries.filter(e => e.key !== key);
    this.index.delete(key);
    return true;
  }
}

// ============================================================================
// UnifiedErrorLog (#49)
// ============================================================================

export type ErrorSource =
  | "mcp"
  | "flow"
  | "llm"
  | "plugin"
  | "session"
  | "cli"
  | "unknown";

export interface ErrorLogEntry {
  id: string;
  source: ErrorSource;
  subsystem: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: number;
  /** Whether this error has been acknowledged/resolved. */
  resolved: boolean;
}

export interface ErrorLogQuery {
  source?: ErrorSource;
  subsystem?: string;
  unresolvedOnly?: boolean;
  since?: number;
  limit?: number;
}

/**
 * Append-only unified error log that aggregates errors from all Megacode
 * subsystems into a single queryable store.
 *
 * Typical usage:
 * ```ts
 * const log = UnifiedErrorLog.instance();
 * log.append("mcp", "filesystem-server", new Error("ENOENT /foo"));
 * ```
 */
export class UnifiedErrorLog {
  private static _instance: UnifiedErrorLog | null = null;

  private entries: ErrorLogEntry[] = [];
  private counter = 0;

  /** Return the global singleton instance. */
  static instance(): UnifiedErrorLog {
    if (!UnifiedErrorLog._instance) {
      UnifiedErrorLog._instance = new UnifiedErrorLog();
    }
    return UnifiedErrorLog._instance;
  }

  /** Replace (or clear) the global singleton — useful in tests. */
  static reset(instance?: UnifiedErrorLog): void {
    UnifiedErrorLog._instance = instance ?? null;
  }

  /**
   * Append an error to the log.
   *
   * @param source   High-level subsystem category.
   * @param subsystem Specific component (e.g. server ID, plugin name).
   * @param error    The error or plain message.
   * @param context  Optional structured metadata.
   */
  append(
    source: ErrorSource,
    subsystem: string,
    error: Error | string,
    context?: Record<string, unknown>
  ): ErrorLogEntry {
    const id = `err-${++this.counter}-${Date.now()}`;
    const entry: ErrorLogEntry = {
      id,
      source,
      subsystem,
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      context,
      timestamp: Date.now(),
      resolved: false,
    };
    this.entries.push(entry);
    return entry;
  }

  /** Get a single entry by ID. */
  get(id: string): ErrorLogEntry | undefined {
    return this.entries.find(e => e.id === id);
  }

  /** Query the log. Returns newest-first by default. */
  query(q: ErrorLogQuery = {}): ErrorLogEntry[] {
    let results = [...this.entries].reverse();

    if (q.source) {
      results = results.filter(e => e.source === q.source);
    }

    if (q.subsystem) {
      const needle = q.subsystem.toLowerCase();
      results = results.filter(e => e.subsystem.toLowerCase().includes(needle));
    }

    if (q.unresolvedOnly) {
      results = results.filter(e => !e.resolved);
    }

    if (q.since !== undefined) {
      results = results.filter(e => e.timestamp >= q.since!);
    }

    if (q.limit !== undefined && q.limit > 0) {
      results = results.slice(0, q.limit);
    }

    return results;
  }

  /** Mark an entry as resolved. Returns false if not found. */
  resolve(id: string): boolean {
    const entry = this.entries.find(e => e.id === id);
    if (!entry) return false;
    entry.resolved = true;
    return true;
  }

  /** Total number of entries in the log. */
  size(): number {
    return this.entries.length;
  }

  /** Number of unresolved (active) errors. */
  unresolvedCount(): number {
    return this.entries.filter(e => !e.resolved).length;
  }

  /** Clear all log entries. */
  clear(): void {
    this.entries = [];
    this.counter = 0;
  }

  /** Export as JSON. */
  exportJSON(): string {
    return JSON.stringify(this.entries, null, 2);
  }
}
