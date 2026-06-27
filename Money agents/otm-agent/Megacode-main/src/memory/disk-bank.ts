/**
 * Disk-Backed Memory Bank for OverCoat.
 *
 * Partitions a configurable slice of the local hard-drive (default 1 GB)
 * as a persistent memory bank for deep context and recall in long-running,
 * enterprise-grade projects.
 *
 * Design goals:
 * 1. Budget-aware — tracks byte usage and refuses writes that would exceed
 *    the configured capacity (default 1 073 741 824 bytes = 1 GiB).
 * 2. Searchable — entries carry tags and a free-text summary for fast lookup.
 * 3. Eviction policy — when the budget is exceeded the oldest-accessed
 *    entries are evicted automatically (LRU).
 * 4. Persistent — the index is written to a single JSON file; entry payloads
 *    are written as individual files so large blobs don't bloat the index.
 * 5. Resilient — `open()` recreates the storage directory if it disappears.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/** 1 GiB expressed in bytes. */
export const ONE_GIB = 1_073_741_824;

/** An entry stored in the memory bank. */
export interface MemoryEntry {
  /** Stable unique key (e.g. "project:auth-flow:notes"). */
  key: string;
  /** Short human-readable summary for search. */
  summary: string;
  /** Classification tags for filtering (e.g. ["auth", "session"]). */
  tags: string[];
  /** Size of the payload in bytes. */
  sizeBytes: number;
  /** Epoch ms when this entry was first written. */
  createdAt: number;
  /** Epoch ms of the most recent read or write. */
  lastAccessedAt: number;
}

/** Configuration for the DiskMemoryBank. */
export interface DiskMemoryBankConfig {
  /** Directory where bank files are stored. */
  bankDir: string;
  /**
   * Maximum total bytes the bank may use.
   * Defaults to ONE_GIB (1 073 741 824 bytes).
   */
  capacityBytes?: number;
  /**
   * Interval (in ms) for automatic garbage collection of stale entries.
   * Default: 10 minutes. Set to 0 to disable.
   */
  gcIntervalMs?: number;
  /**
   * Age threshold (in ms) for considering an entry stale during GC.
   * Entries not accessed for this duration may be evicted when capacity is tight.
   * Default: 24 hours.
   */
  gcStaleThresholdMs?: number;
}

/** Statistics returned by `getStats()`. */
export interface DiskBankStats {
  /** Configured capacity in bytes. */
  capacityBytes: number;
  /** Bytes currently used across all entries. */
  usedBytes: number;
  /** Remaining bytes before capacity is reached. */
  availableBytes: number;
  /** Number of entries currently stored. */
  entryCount: number;
  /** Percentage of capacity used (0–100). */
  usagePercent: number;
}

/**
 * DiskMemoryBank stores arbitrary string payloads on disk up to a
 * configured capacity (default 1 GiB), indexed by a string key.
 *
 * Usage:
 * ```ts
 * const bank = new DiskMemoryBank({ bankDir: ".overcoat/memory" });
 * bank.open();
 * bank.write("project:plan", "# Phase 1\n...", { tags: ["plan"] });
 * const recall = bank.read("project:plan");
 * ```
 *
 * **Concurrency limitation**: Each `DiskMemoryBank` instance maintains its own
 * in-memory index and flushes it to `index.json` on every write/delete. Two
 * instances opened against the same `bankDir` simultaneously will overwrite
 * each other's index and produce inconsistent state. Ensure only one instance
 * is active per directory at any given time.
 *
 * **Memory Management**: Inspired by Claude Code 2.1.49's memory leak fixes,
 * this implementation includes periodic garbage collection to prevent unbounded
 * memory growth during long-running sessions.
 */
export class DiskMemoryBank {
  private config: Required<DiskMemoryBankConfig>;
  private index: Map<string, MemoryEntry> = new Map();
  private readonly INDEX_FILE = "index.json";
  private gcTimer: NodeJS.Timeout | null = null;

  constructor(config: DiskMemoryBankConfig) {
    this.config = {
      bankDir: config.bankDir,
      capacityBytes: config.capacityBytes ?? ONE_GIB,
      gcIntervalMs: config.gcIntervalMs ?? 10 * 60 * 1000, // 10 minutes
      gcStaleThresholdMs: config.gcStaleThresholdMs ?? 24 * 60 * 60 * 1000, // 24 hours
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Open (or create) the bank directory and load the persisted index.
   * Call this once before reading or writing entries.
   * Starts automatic garbage collection if configured.
   */
  open(): void {
    if (!fs.existsSync(this.config.bankDir)) {
      fs.mkdirSync(this.config.bankDir, { recursive: true });
    }
    this._loadIndex();

    // Start periodic garbage collection if configured
    if (this.config.gcIntervalMs && this.config.gcIntervalMs > 0) {
      this.startGarbageCollection();
    }
  }

  /**
   * Flush the in-memory index to disk.
   * Called automatically by `write()`, `delete()`, and `evictLRU()`.
   */
  flush(): void {
    this._saveIndex();
  }

  // ── Read / Write ──────────────────────────────────────────────────────

  /**
   * Write a payload to the bank.
   *
   * When overwriting an existing entry the old bytes are freed before
   * computing available capacity, so replacing a large entry with a
   * smaller one never triggers unnecessary evictions.
   *
   * If the file write fails after eviction, the old index entry is
   * restored so the bank state remains consistent.
   *
   * @param key     Stable string key.
   * @param payload String data to persist.
   * @param meta    Optional summary and tags for search.
   */
  write(
    key: string,
    payload: string,
    meta: { summary?: string; tags?: string[] } = {}
  ): MemoryEntry {
    const encoded = Buffer.from(payload, "utf8");
    const newSize = encoded.byteLength;

    // Temporarily remove the old entry from the in-memory index so that
    // _ensureCapacity sees accurate available space and never evicts the
    // key being overwritten (its old bytes are freed by this write).
    const oldEntry = this.index.get(key);
    if (oldEntry) this.index.delete(key);

    // Evict LRU entries until there is room for the new payload.
    // If we cannot make room, restore the old entry and throw.
    try {
      this._ensureCapacity(newSize);
    } catch (err) {
      if (oldEntry) this.index.set(key, oldEntry);
      throw err;
    }

    // Write the payload to disk.  If this fails, restore the old entry
    // so the index stays consistent with what is actually on disk.
    const filePath = this._entryFilePath(key);
    try {
      fs.writeFileSync(filePath, encoded);
    } catch (err) {
      if (oldEntry) this.index.set(key, oldEntry);
      try {
        fs.unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors; the original error is more important.
      }
      throw err;
    }

    const now = Date.now();
    const entry: MemoryEntry = {
      key,
      summary: meta.summary ?? "",
      tags: meta.tags ?? [],
      sizeBytes: newSize,
      createdAt: oldEntry?.createdAt ?? now,
      lastAccessedAt: now,
    };
    this.index.set(key, entry);
    this._saveIndex();
    return entry;
  }

  /**
   * Read a payload by key.  Updates `lastAccessedAt` on the index entry.
   * Returns `undefined` if the key is not found.
   */
  read(key: string): string | undefined {
    const entry = this.index.get(key);
    if (!entry) return undefined;

    const filePath = this._entryFilePath(key);
    if (!fs.existsSync(filePath)) return undefined;

    // Update lastAccessedAt in memory only; avoid disk write on every read.
    entry.lastAccessedAt = Date.now();
    return fs.readFileSync(filePath, "utf8");
  }

  /**
   * Delete a single entry from the bank.
   * Returns `true` if deleted, `false` if the key was not found.
   */
  delete(key: string): boolean {
    const entry = this.index.get(key);
    if (!entry) return false;

    const filePath = this._entryFilePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this.index.delete(key);
    this._saveIndex();
    return true;
  }

  // ── Search ────────────────────────────────────────────────────────────

  /**
   * Search index entries whose summary or tags match the query string.
   * Case-insensitive substring match; does not load payloads.
   */
  search(query: string): MemoryEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.index.values()).filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  /**
   * Return all entries that carry a specific tag.
   */
  getByTag(tag: string): MemoryEntry[] {
    const t = tag.toLowerCase();
    return Array.from(this.index.values()).filter((e) =>
      e.tags.map((x) => x.toLowerCase()).includes(t)
    );
  }

  /** Return all index entries (does not load payloads). */
  listEntries(): MemoryEntry[] {
    return Array.from(this.index.values());
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  /** Return current usage statistics. */
  getStats(): DiskBankStats {
    const usedBytes = this._usedBytes();
    const capacityBytes = this.config.capacityBytes;
    return {
      capacityBytes,
      usedBytes,
      availableBytes: Math.max(0, capacityBytes - usedBytes),
      entryCount: this.index.size,
      usagePercent: capacityBytes > 0
        ? Math.min(100, (usedBytes / capacityBytes) * 100)
        : 0,
    };
  }

  // ── Eviction ──────────────────────────────────────────────────────────

  /**
   * Evict the N least-recently-accessed entries.
   * Returns the evicted entry keys.
   */
  evictLRU(count: number): string[] {
    const sorted = Array.from(this.index.values()).sort(
      (a, b) => a.lastAccessedAt - b.lastAccessedAt
    );
    const evicted: string[] = [];
    for (let i = 0; i < count && i < sorted.length; i++) {
      const key = sorted[i].key;
      this.delete(key);
      evicted.push(key);
    }
    return evicted;
  }

  // ── Internals ─────────────────────────────────────────────────────────

  private _entryFilePath(key: string): string {
    // Use a SHA-256 hash of the key as the filename to avoid collisions
    // from keys that differ only in separator characters (e.g. "a:b" vs "a/b").
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    return path.join(this.config.bankDir, `${hash}.mem`);
  }

  private _indexFilePath(): string {
    return path.join(this.config.bankDir, this.INDEX_FILE);
  }

  private _usedBytes(): number {
    let total = 0;
    for (const entry of this.index.values()) {
      total += entry.sizeBytes;
    }
    return total;
  }

  private _ensureCapacity(requiredBytes: number): void {
    const available = this.config.capacityBytes - this._usedBytes();
    if (available >= requiredBytes) return;

    // Evict LRU entries one at a time until we have room
    const sorted = Array.from(this.index.values()).sort(
      (a, b) => a.lastAccessedAt - b.lastAccessedAt
    );
    let freed = available;
    for (const entry of sorted) {
      if (freed >= requiredBytes) break;
      freed += entry.sizeBytes;
      this.delete(entry.key);
    }

    if (this.config.capacityBytes - this._usedBytes() < requiredBytes) {
      throw new Error(
        `DiskMemoryBank: insufficient capacity. Need ${requiredBytes} bytes but only ` +
          `${this.config.capacityBytes - this._usedBytes()} bytes available.`
      );
    }
  }

  private _loadIndex(): void {
    const p = this._indexFilePath();
    if (!fs.existsSync(p)) {
      this.index = new Map();
      return;
    }
    const raw = fs.readFileSync(p, "utf8");
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        throw new Error("DiskMemoryBank index file is not an array");
      }
      const entries = parsed as MemoryEntry[];
      this.index = new Map(entries.map((e) => [e.key, e]));
    } catch (err) {
      // If the index file is corrupted or invalid, back it up (best-effort)
      // and fall back to an empty index so the bank can still open.
      try {
        const backupPath = `${p}.corrupt-${Date.now()}.bak`;
        fs.renameSync(p, backupPath);
        // eslint-disable-next-line no-console
        console.warn(
          `DiskMemoryBank: corrupted index file detected at ${p}. ` +
            `Moved to backup at ${backupPath} and starting with an empty index.`
        );
      } catch (backupErr) {
        // eslint-disable-next-line no-console
        console.error(
          `DiskMemoryBank: failed to parse index file at ${p} and also failed to back it up:`,
          backupErr
        );
      }
      this.index = new Map();
    }
  }

  private _saveIndex(): void {
    const p = this._indexFilePath();
    fs.writeFileSync(p, JSON.stringify(Array.from(this.index.values()), null, 2), "utf8");
  }

  /** The directory where this bank stores its files. */
  get bankDir(): string {
    return this.config.bankDir;
  }

  /** The configured capacity in bytes. */
  get capacityBytes(): number {
    return this.config.capacityBytes;
  }

  // ── Garbage Collection ────────────────────────────────────────────────────

  /**
   * Start automatic garbage collection on a periodic interval.
   * Called automatically by open() if gcIntervalMs is set.
   *
   * GC strategy: When usage exceeds 80% capacity, evict stale entries
   * (not accessed within gcStaleThresholdMs) to free up space.
   */
  private startGarbageCollection(): void {
    if (this.gcTimer) return; // Already running

    this.gcTimer = setInterval(() => {
      const stats = this.getStats();
      const HIGH_WATER_MARK = 0.8; // 80% capacity

      if (stats.usagePercent >= HIGH_WATER_MARK * 100) {
        const evicted = this.evictStaleEntries();
        // Optional: log for observability
        // console.debug(`DiskMemoryBank: evicted ${evicted} stale entries`);
      }
    }, this.config.gcIntervalMs);

    // Prevent the timer from keeping the process alive
    if (this.gcTimer.unref) {
      this.gcTimer.unref();
    }
  }

  /**
   * Stop automatic garbage collection.
   * Call this before destroying the bank instance to prevent memory leaks.
   */
  stopGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }
  }

  /**
   * Evict entries that haven't been accessed within the stale threshold.
   * Returns the number of entries evicted.
   */
  private evictStaleEntries(): number {
    const now = Date.now();
    const threshold = this.config.gcStaleThresholdMs;
    const TARGET_USAGE_PERCENT = 70;
    let evicted = 0;
    const staleKeys: string[] = [];

    for (const [key, entry] of this.index.entries()) {
      if (now - entry.lastAccessedAt > threshold) {
        staleKeys.push(key);
      }
    }

    if (staleKeys.length === 0) {
      return 0;
    }

    const originalFlush = this.flush.bind(this);
    (this as DiskMemoryBank & { flush: () => void }).flush = () => {
      // Suppress repeated synchronous index writes during batched GC eviction.
    };

    try {
      for (const key of staleKeys) {
        this.delete(key);
        evicted++;

        if (this.getStats().usagePercent <= TARGET_USAGE_PERCENT) {
          break;
        }
      }
    } finally {
      (this as DiskMemoryBank & { flush: () => void }).flush = originalFlush;
    }

    if (evicted > 0) {
      this.flush();
    }
    return evicted;
  }

  /**
   * Destroy the bank and release all resources.
   * Stops garbage collection and saves the final index.
   */
  destroy(): void {
    this.stopGarbageCollection();
    this.flush();
  }
}
