/**
 * ShadowWorkspace + UnifiedDiffPreview — Items #9 & #14 (Cursor / Windsurf features)
 *
 * ShadowWorkspace: Maintains an in-memory mirror of the real workspace so AI
 * edits can be previewed, diffed, and selectively accepted/rejected before
 * touching the actual filesystem — the same pattern used by Cursor's shadow
 * workspace and Windsurf's inline diff previewer.
 *
 * UnifiedDiffPreview: Generates unified-diff and side-by-side diff text from
 * any two string buffers, ready to be rendered in a terminal or sent to a UI.
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

/** A single file in the shadow workspace. */
export interface ShadowFile {
  /** Absolute path (mirrors the real workspace path). */
  absPath: string;
  /** Current shadow content (may differ from disk). */
  content: string;
  /** Original content when the file was first opened into the shadow. */
  originalContent: string;
  /** Whether the file is new (does not exist on disk yet). */
  isNew: boolean;
  /** Whether the file has been marked for deletion. */
  markedForDeletion: boolean;
  /** Last-modified timestamp within the shadow (ms). */
  shadowModifiedAt: number;
}

/** Summary of changes in the shadow workspace. */
export interface ShadowDiff {
  /** Files with content changes. */
  modified: string[];
  /** Files that are new (don't exist on disk). */
  added: string[];
  /** Files marked for deletion. */
  deleted: string[];
  /** Total count of changed files. */
  totalChanges: number;
}

/** A unified diff hunk (one contiguous region of changes). */
export interface DiffHunk {
  /** Start line in the original (1-indexed). */
  originalStart: number;
  /** Number of lines from the original in this hunk. */
  originalCount: number;
  /** Start line in the modified (1-indexed). */
  modifiedStart: number;
  /** Number of lines from the modified in this hunk. */
  modifiedCount: number;
  /** Lines in this hunk: "+" added, "-" removed, " " context. */
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "remove" | "context";
  content: string;
}

/** Complete unified diff result. */
export interface UnifiedDiff {
  /** Path label for the diff header. */
  filePath: string;
  /** All hunks in this diff. */
  hunks: DiffHunk[];
  /** Summary stats. */
  stats: {
    additions: number;
    deletions: number;
    hunks: number;
  };
  /** Rendered unified diff text (--- / +++ / @@ format). */
  text: string;
}

// ============================================================================
// UnifiedDiffPreview (Item #14)
// ============================================================================

/**
 * Generates unified diffs between any two string buffers.
 *
 * Usage:
 *   const diff = UnifiedDiffPreview.diff(original, modified, "src/foo.ts");
 *   console.log(diff.text);
 */
export class UnifiedDiffPreview {
  private static readonly CONTEXT_LINES = 3;

  /**
   * Generate a unified diff between two string buffers.
   *
   * @param original  The original text.
   * @param modified  The modified text.
   * @param filePath  Label used in the diff header.
   */
  static diff(original: string, modified: string, filePath = "file"): UnifiedDiff {
    const origLines = original.split("\n");
    const modLines = modified.split("\n");

    const lcs = this._lcs(origLines, modLines);
    const hunks = this._buildHunks(origLines, modLines, lcs);
    const text = this._renderText(hunks, filePath);

    const additions = hunks.reduce((s, h) => s + h.lines.filter((l) => l.type === "add").length, 0);
    const deletions = hunks.reduce((s, h) => s + h.lines.filter((l) => l.type === "remove").length, 0);

    return { filePath, hunks, stats: { additions, deletions, hunks: hunks.length }, text };
  }

  /**
   * Generate a side-by-side diff as two parallel string arrays (for terminal display).
   */
  static sideBySide(
    original: string,
    modified: string,
    width = 80
  ): Array<{ left: string; right: string; type: "context" | "change" }> {
    const half = Math.floor(width / 2) - 1;
    const origLines = original.split("\n");
    const modLines = modified.split("\n");

    const result: Array<{ left: string; right: string; type: "context" | "change" }> = [];
    const maxLen = Math.max(origLines.length, modLines.length);

    for (let i = 0; i < maxLen; i++) {
      const left = (origLines[i] ?? "").slice(0, half).padEnd(half);
      const right = (modLines[i] ?? "").slice(0, half).padEnd(half);
      const type = left.trimEnd() === right.trimEnd() ? "context" : "change";
      result.push({ left, right, type });
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // Myers diff (simplified LCS-based)
  // --------------------------------------------------------------------------

  private static _lcs(a: string[], b: string[]): boolean[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    // Back-track to find which lines are in LCS
    const inLcs: boolean[][] = [
      new Array(m).fill(false),
      new Array(n).fill(false),
    ];

    let i = m;
    let j = n;
    while (i > 0 && j > 0) {
      if (a[i - 1] === b[j - 1]) {
        inLcs[0][i - 1] = true;
        inLcs[1][j - 1] = true;
        i--;
        j--;
      } else if (dp[i - 1][j] >= dp[i][j - 1]) {
        i--;
      } else {
        j--;
      }
    }

    return inLcs;
  }

  private static _buildHunks(a: string[], b: string[], lcs: boolean[][]): DiffHunk[] {
    // Build flat edit list first
    const edits: DiffLine[] = [];
    const aIdxMap: number[] = [];
    const bIdxMap: number[] = [];

    let ai = 0;
    let bi = 0;
    while (ai < a.length || bi < b.length) {
      if (ai < a.length && !lcs[0][ai]) {
        edits.push({ type: "remove", content: a[ai] });
        aIdxMap.push(ai);
        bIdxMap.push(-1);
        ai++;
      } else if (bi < b.length && !lcs[1][bi]) {
        edits.push({ type: "add", content: b[bi] });
        aIdxMap.push(-1);
        bIdxMap.push(bi);
        bi++;
      } else {
        edits.push({ type: "context", content: a[ai] });
        aIdxMap.push(ai);
        bIdxMap.push(bi);
        ai++;
        bi++;
      }
    }

    // Group edits into hunks with CONTEXT_LINES surrounding context
    const hunks: DiffHunk[] = [];
    const CTX = this.CONTEXT_LINES;
    let hunkStart = -1;
    let hunkEnd = -1;

    const flushHunk = (from: number, to: number) => {
      const lines = edits.slice(from, to + 1);
      const origStart = Math.max(0, aIdxMap.findIndex((v, idx) => idx >= from && v >= 0)) + 1;
      const modStart = Math.max(0, bIdxMap.findIndex((v, idx) => idx >= from && v >= 0)) + 1;
      const origCount = lines.filter((l) => l.type !== "add").length;
      const modCount = lines.filter((l) => l.type !== "remove").length;
      hunks.push({ originalStart: origStart, originalCount: origCount, modifiedStart: modStart, modifiedCount: modCount, lines });
    };

    for (let idx = 0; idx < edits.length; idx++) {
      if (edits[idx].type !== "context") {
        const start = Math.max(0, idx - CTX);
        const end = Math.min(edits.length - 1, idx + CTX);

        if (hunkStart === -1) {
          hunkStart = start;
          hunkEnd = end;
        } else if (start <= hunkEnd + CTX) {
          hunkEnd = Math.max(hunkEnd, end);
        } else {
          flushHunk(hunkStart, hunkEnd);
          hunkStart = start;
          hunkEnd = end;
        }
      }
    }

    if (hunkStart !== -1) {
      flushHunk(hunkStart, hunkEnd);
    }

    return hunks;
  }

  private static _renderText(hunks: DiffHunk[], filePath: string): string {
    if (hunks.length === 0) return "";

    const lines: string[] = [
      `--- a/${filePath}`,
      `+++ b/${filePath}`,
    ];

    for (const hunk of hunks) {
      lines.push(
        `@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.modifiedStart},${hunk.modifiedCount} @@`
      );
      for (const line of hunk.lines) {
        const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
        lines.push(`${prefix}${line.content}`);
      }
    }

    return lines.join("\n");
  }
}

// ============================================================================
// ShadowWorkspace (Item #9)
// ============================================================================

/**
 * In-memory mirror of the real workspace.
 *
 * AI agents write edits to the shadow; changes can be previewed as diffs
 * before the user accepts and flushes them to the real filesystem.
 *
 * Usage:
 *   const shadow = new ShadowWorkspace("/path/to/project");
 *   shadow.open("src/foo.ts");
 *   shadow.write("src/foo.ts", newContent);
 *   const diff = shadow.preview("src/foo.ts");
 *   console.log(diff.text);
 *   shadow.accept("src/foo.ts");   // writes to disk
 */
export class ShadowWorkspace {
  private rootDir: string;
  private files: Map<string, ShadowFile> = new Map();

  /** @param rootDir Absolute path to the workspace root. */
  constructor(rootDir: string) {
    this.rootDir = path.resolve(rootDir);
  }

  // --------------------------------------------------------------------------
  // File management
  // --------------------------------------------------------------------------

  /**
   * Open an existing file into the shadow workspace.
   * If the file does not exist on disk, it is treated as a new empty file.
   */
  open(filePath: string): ShadowFile {
    const abs = this._resolve(filePath);
    if (this.files.has(abs)) return this.files.get(abs)!;

    let content = "";
    let isNew = true;
    if (fs.existsSync(abs)) {
      content = fs.readFileSync(abs, "utf8");
      isNew = false;
    }

    const sf: ShadowFile = {
      absPath: abs,
      content,
      originalContent: content,
      isNew,
      markedForDeletion: false,
      shadowModifiedAt: Date.now(),
    };

    this.files.set(abs, sf);
    return sf;
  }

  /**
   * Create a new file in the shadow (does not touch disk).
   */
  create(filePath: string, content = ""): ShadowFile {
    const abs = this._resolve(filePath);
    const sf: ShadowFile = {
      absPath: abs,
      content,
      originalContent: "",
      isNew: true,
      markedForDeletion: false,
      shadowModifiedAt: Date.now(),
    };
    this.files.set(abs, sf);
    return sf;
  }

  /**
   * Write new content to a file in the shadow (does not touch disk).
   * Opens the file first if it wasn't already open.
   */
  write(filePath: string, content: string): ShadowFile {
    const abs = this._resolve(filePath);
    if (!this.files.has(abs)) {
      this.open(filePath);
    }
    const sf = this.files.get(abs)!;
    sf.content = content;
    sf.shadowModifiedAt = Date.now();
    sf.markedForDeletion = false;
    return sf;
  }

  /**
   * Mark a file for deletion in the shadow (does not touch disk).
   */
  markForDeletion(filePath: string): boolean {
    const abs = this._resolve(filePath);
    if (!this.files.has(abs)) this.open(filePath);
    const sf = this.files.get(abs);
    if (!sf) return false;
    sf.markedForDeletion = true;
    sf.shadowModifiedAt = Date.now();
    return true;
  }

  /**
   * Discard shadow changes for a specific file (revert to disk state).
   */
  discard(filePath: string): void {
    const abs = this._resolve(filePath);
    this.files.delete(abs);
  }

  /**
   * Discard all shadow changes.
   */
  discardAll(): void {
    this.files.clear();
  }

  // --------------------------------------------------------------------------
  // Diff / Preview
  // --------------------------------------------------------------------------

  /**
   * Preview the diff for a single file.
   * Returns null if the file hasn't changed.
   */
  preview(filePath: string): UnifiedDiff | null {
    const abs = this._resolve(filePath);
    const sf = this.files.get(abs);
    if (!sf) return null;
    if (sf.content === sf.originalContent && !sf.markedForDeletion) return null;

    const relPath = path.relative(this.rootDir, abs);
    if (sf.markedForDeletion) {
      return UnifiedDiffPreview.diff(sf.originalContent, "", relPath);
    }
    return UnifiedDiffPreview.diff(sf.originalContent, sf.content, relPath);
  }

  /**
   * Preview all changed files.
   */
  previewAll(): Map<string, UnifiedDiff> {
    const result = new Map<string, UnifiedDiff>();
    for (const [abs, sf] of this.files) {
      const relPath = path.relative(this.rootDir, abs);
      if (sf.markedForDeletion) {
        result.set(relPath, UnifiedDiffPreview.diff(sf.originalContent, "", relPath));
      } else if (sf.content !== sf.originalContent) {
        result.set(relPath, UnifiedDiffPreview.diff(sf.originalContent, sf.content, relPath));
      }
    }
    return result;
  }

  /**
   * Get a summary of all shadow changes.
   */
  getDiff(): ShadowDiff {
    const modified: string[] = [];
    const added: string[] = [];
    const deleted: string[] = [];

    for (const [abs, sf] of this.files) {
      const rel = path.relative(this.rootDir, abs);
      if (sf.markedForDeletion) {
        deleted.push(rel);
      } else if (sf.isNew) {
        added.push(rel);
      } else if (sf.content !== sf.originalContent) {
        modified.push(rel);
      }
    }

    return {
      modified,
      added,
      deleted,
      totalChanges: modified.length + added.length + deleted.length,
    };
  }

  // --------------------------------------------------------------------------
  // Accept / Flush to disk
  // --------------------------------------------------------------------------

  /**
   * Accept shadow changes for a single file — writes to the real filesystem.
   */
  accept(filePath: string): void {
    const abs = this._resolve(filePath);
    const sf = this.files.get(abs);
    if (!sf) return;

    if (sf.markedForDeletion) {
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
      this.files.delete(abs);
    } else {
      const dir = path.dirname(abs);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(abs, sf.content, "utf8");
      // Update shadow to reflect new disk state
      sf.originalContent = sf.content;
      sf.isNew = false;
    }
  }

  /**
   * Accept all shadow changes — writes all changed files to disk.
   */
  acceptAll(): void {
    for (const abs of this.files.keys()) {
      this.accept(path.relative(this.rootDir, abs));
    }
  }

  /**
   * Accept only specific files.
   */
  acceptFiles(filePaths: string[]): void {
    for (const fp of filePaths) {
      this.accept(fp);
    }
  }

  // --------------------------------------------------------------------------
  // Read
  // --------------------------------------------------------------------------

  /**
   * Read the shadow content of a file (opens from disk if needed).
   */
  read(filePath: string): string {
    const sf = this.open(filePath);
    return sf.content;
  }

  /**
   * Get all open shadow files.
   */
  openFiles(): ShadowFile[] {
    return Array.from(this.files.values());
  }

  /**
   * Get the shadow file object for a path (undefined if not open).
   */
  getFile(filePath: string): ShadowFile | undefined {
    return this.files.get(this._resolve(filePath));
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _resolve(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return path.normalize(filePath);
    }
    return path.join(this.rootDir, filePath);
  }
}
