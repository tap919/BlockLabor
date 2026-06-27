/**
 * NotepadManager — Item #8 (Cursor feature)
 *
 * Persistent, named scratchpads that survive session restarts.
 * Notepads can hold free-form markdown text, code snippets, todo lists,
 * or any content the user wants to keep across conversations.
 *
 * Each notepad is stored as a JSON entry on disk under
 * `.overcoat/notepads/<id>.json`.
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

/** A single notepad entry. */
export interface Notepad {
  /** Stable identifier (slug-safe). */
  id: string;
  /** Human-readable title. */
  title: string;
  /** Markdown content of the notepad. */
  content: string;
  /** Optional list of tags for filtering. */
  tags: string[];
  /** Creation timestamp (ms). */
  createdAt: number;
  /** Last modification timestamp (ms). */
  updatedAt: number;
  /** Whether the notepad is pinned to the top of the list. */
  pinned: boolean;
}

/** Options when creating a new notepad. */
export interface CreateNotepadOptions {
  title: string;
  content?: string;
  tags?: string[];
  pinned?: boolean;
}

/** Filters for listing notepads. */
export interface NotepadFilter {
  query?: string;
  tags?: string[];
  pinnedOnly?: boolean;
}

// ============================================================================
// NotepadManager
// ============================================================================

/**
 * Manages a collection of persistent scratchpads backed by the local filesystem.
 *
 * Usage:
 *   const mgr = new NotepadManager();
 *   const pad = mgr.create({ title: "Ideas" });
 *   mgr.append(pad.id, "\n- Another idea");
 *   const all = mgr.list();
 */
export class NotepadManager {
  private dir: string;
  private cache: Map<string, Notepad> = new Map();
  private loaded = false;

  /**
   * @param baseDir Root directory of the project. Notepads are stored in
   *   `<baseDir>/.overcoat/notepads/`. Defaults to `process.cwd()`.
   */
  constructor(baseDir?: string) {
    this.dir = path.join(baseDir ?? process.cwd(), ".overcoat", "notepads");
  }

  // --------------------------------------------------------------------------
  // CRUD
  // --------------------------------------------------------------------------

  /**
   * Create a new notepad.
   */
  create(options: CreateNotepadOptions): Notepad {
    this._ensureLoaded();
    const now = Date.now();
    const id = this._slugify(options.title) + "-" + now.toString(36);
    const pad: Notepad = {
      id,
      title: options.title,
      content: options.content ?? "",
      tags: options.tags ?? [],
      createdAt: now,
      updatedAt: now,
      pinned: options.pinned ?? false,
    };
    this.cache.set(id, pad);
    this._persist(pad);
    return pad;
  }

  /**
   * Get a notepad by ID.
   */
  get(id: string): Notepad | null {
    this._ensureLoaded();
    return this.cache.get(id) ?? null;
  }

  /**
   * Update an existing notepad's fields (partial update).
   */
  update(id: string, changes: Partial<Omit<Notepad, "id" | "createdAt">>): Notepad | null {
    this._ensureLoaded();
    const pad = this.cache.get(id);
    if (!pad) return null;
    const updated: Notepad = { ...pad, ...changes, id, createdAt: pad.createdAt, updatedAt: Date.now() };
    this.cache.set(id, updated);
    this._persist(updated);
    return updated;
  }

  /**
   * Replace the full content of a notepad.
   */
  setContent(id: string, content: string): Notepad | null {
    return this.update(id, { content });
  }

  /**
   * Append text to the end of a notepad's content.
   */
  append(id: string, text: string): Notepad | null {
    this._ensureLoaded();
    const pad = this.cache.get(id);
    if (!pad) return null;
    return this.setContent(id, pad.content + text);
  }

  /**
   * Prepend text to the beginning of a notepad's content.
   */
  prepend(id: string, text: string): Notepad | null {
    this._ensureLoaded();
    const pad = this.cache.get(id);
    if (!pad) return null;
    return this.setContent(id, text + pad.content);
  }

  /**
   * Delete a notepad.
   */
  delete(id: string): boolean {
    this._ensureLoaded();
    if (!this.cache.has(id)) return false;
    this.cache.delete(id);
    const filePath = this._filePath(id);
    try {
      fs.unlinkSync(filePath);
    } catch {
      // Ignore missing file
    }
    return true;
  }

  /**
   * Pin or unpin a notepad.
   */
  setPin(id: string, pinned: boolean): Notepad | null {
    return this.update(id, { pinned });
  }

  // --------------------------------------------------------------------------
  // Listing & Search
  // --------------------------------------------------------------------------

  /**
   * List all notepads, optionally filtered.
   * Pinned notepads always appear first.
   */
  list(filter: NotepadFilter = {}): Notepad[] {
    this._ensureLoaded();
    let pads = Array.from(this.cache.values());

    if (filter.pinnedOnly) {
      pads = pads.filter((p) => p.pinned);
    }

    if (filter.tags && filter.tags.length > 0) {
      pads = pads.filter((p) =>
        filter.tags!.some((t) => p.tags.includes(t))
      );
    }

    if (filter.query) {
      const q = filter.query.toLowerCase();
      pads = pads.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Pinned first, then by updatedAt desc
    return pads.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
  }

  /**
   * Full-text search across all notepad content.
   */
  search(query: string): Array<{ notepad: Notepad; matchCount: number }> {
    const q = query.toLowerCase();
    const results: Array<{ notepad: Notepad; matchCount: number }> = [];

    for (const pad of this.cache.values()) {
      const text = (pad.title + " " + pad.content + " " + pad.tags.join(" ")).toLowerCase();
      const matches = text.split(q).length - 1;
      if (matches > 0) {
        results.push({ notepad: pad, matchCount: matches });
      }
    }

    return results.sort((a, b) => b.matchCount - a.matchCount);
  }

  /**
   * Get all unique tags across all notepads.
   */
  allTags(): string[] {
    const tags = new Set<string>();
    for (const pad of this.cache.values()) {
      for (const t of pad.tags) tags.add(t);
    }
    return Array.from(tags).sort();
  }

  // --------------------------------------------------------------------------
  // Persistence
  // --------------------------------------------------------------------------

  /** Force reload all notepads from disk. */
  reload(): void {
    this.cache.clear();
    this.loaded = false;
    this._ensureLoaded();
  }

  /** Number of notepads currently in the store. */
  get size(): number {
    this._ensureLoaded();
    return this.cache.size;
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _ensureLoaded(): void {
    if (this.loaded) return;
    this._ensureDir();
    this._loadFromDisk();
    this.loaded = true;
  }

  private _ensureDir(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private _loadFromDisk(): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
      // Prevent path traversal
      if (entry.name.includes("..")) continue;

      const filePath = path.join(this.dir, entry.name);
      try {
        const raw = fs.readFileSync(filePath, "utf8");
        const pad = JSON.parse(raw) as Notepad;
        if (pad.id && pad.title !== undefined) {
          this.cache.set(pad.id, pad);
        }
      } catch {
        // Skip corrupt files
      }
    }
  }

  private _persist(pad: Notepad): void {
    this._ensureDir();
    const filePath = this._filePath(pad.id);
    fs.writeFileSync(filePath, JSON.stringify(pad, null, 2), "utf8");
  }

  private _filePath(id: string): string {
    // Sanitize id to prevent path traversal
    const safe = id.replace(/[^a-zA-Z0-9_\-]/g, "_");
    return path.join(this.dir, `${safe}.json`);
  }

  private _slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "notepad";
  }
}
