/**
 * UI/UX Innovations for OverCoat.
 *
 * Implementation plan for UI/UX features:
 *
 * 1. Hybrid Terminal/UI
 *    - Beautiful TUI that can expand to full GUI when needed
 *    - Dual mode: inline terminal widgets + expandable panels
 *    - Implementation: TUI framework integration (blessed/ink),
 *      widget system for inline renders, WebSocket bridge to
 *      GUI overlay, mode switching (compact/expanded)
 *
 * 2. Semantic Color Coding
 *    - Colors based on command intent, not just syntax
 *    - Categories: read (blue), write (yellow), delete (red), create (green)
 *    - Implementation: Command classifier by intent, ANSI color mapping,
 *      configurable color themes, accessibility contrast modes
 *
 * 3. Progress Visualization
 *    - Animated progress for long operations
 *    - Progress bars, spinners, ETA estimates
 *    - Implementation: Progress tracker with percentage/steps,
 *      multiple styles (bar, spinner, dots), ETA calculation
 *      from elapsed time, nested progress for sub-tasks
 *
 * 4. Smart Output Formatting
 *    - JSON/XML/YAML automatically formatted and collapsible
 *    - Auto-detection and pretty-printing of structured output
 *    - Implementation: Format detection engine, syntax-highlighted
 *      rendering, collapsible sections for nested data,
 *      line-wrapping for wide output
 *
 * 5. Command Timeline
 *    - Visual history with search and tags
 *    - Searchable, tagged command history with time annotations
 *    - Implementation: Indexed command store, full-text search,
 *      tag system (manual + auto), timeline visualization,
 *      bookmark/favorite functionality
 */

/** ANSI color codes for terminal output. */
export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
};

/** Command intent categories for semantic coloring. */
export type CommandIntent =
  | "read"
  | "write"
  | "delete"
  | "create"
  | "execute"
  | "navigate"
  | "query"
  | "unknown";

/** Intent-to-color mapping. */
export interface SemanticTheme {
  read: string;
  write: string;
  delete: string;
  create: string;
  execute: string;
  navigate: string;
  query: string;
  unknown: string;
}

/** Progress update for long operations. */
export interface ProgressState {
  /** Operation label. */
  label: string;
  /** Current progress (0 to total). */
  current: number;
  /** Total steps/units. */
  total: number;
  /** Percentage (0-100). */
  percent: number;
  /** Elapsed time in milliseconds. */
  elapsedMs: number;
  /** Estimated time remaining in milliseconds. */
  etaMs: number | null;
  /** Whether the operation is complete. */
  complete: boolean;
}

/** Style options for progress rendering. */
export type ProgressStyle = "bar" | "spinner" | "dots" | "percentage";

/** A tagged entry in the command timeline. */
export interface TimelineEntry {
  /** Unique entry ID. */
  id: string;
  /** The command. */
  command: string;
  /** Command output summary. */
  output?: string;
  /** Exit code. */
  exitCode?: number;
  /** Execution timestamp. */
  timestamp: number;
  /** User-assigned tags. */
  tags: string[];
  /** Whether this entry is bookmarked. */
  bookmarked: boolean;
}

/** Command-to-intent classification patterns. */
const INTENT_PATTERNS: Array<{ intent: CommandIntent; patterns: RegExp[] }> = [
  {
    intent: "read",
    patterns: [/^cat\b/, /^less\b/, /^head\b/, /^tail\b/, /^grep\b/, /^find\b/, /^ls\b/, /^git\s+log\b/, /^git\s+status\b/, /^git\s+diff\b/],
  },
  {
    intent: "write",
    patterns: [/^echo\b.*>>/, /^sed\b/, /^tee\b/, /^git\s+commit\b/, /^git\s+push\b/],
  },
  {
    intent: "delete",
    patterns: [/^rm\b/, /^rmdir\b/, /^git\s+clean\b/, /^git\s+reset\b/],
  },
  {
    intent: "create",
    patterns: [/^mkdir\b/, /^touch\b/, /^cp\b/, /^git\s+init\b/, /^git\s+branch\b/, /^npm\s+init\b/],
  },
  {
    intent: "execute",
    patterns: [/^npm\s+run\b/, /^node\b/, /^python\b/, /^cargo\s+run\b/, /^go\s+run\b/, /^make\b/],
  },
  {
    intent: "navigate",
    patterns: [/^cd\b/, /^pushd\b/, /^popd\b/, /^git\s+checkout\b/, /^git\s+switch\b/],
  },
  {
    intent: "query",
    patterns: [/^curl\b/, /^wget\b/, /^ssh\b/, /^ping\b/, /^dig\b/, /^nslookup\b/],
  },
];

const DEFAULT_THEME: SemanticTheme = {
  read: ANSI.blue,
  write: ANSI.yellow,
  delete: ANSI.red,
  create: ANSI.green,
  execute: ANSI.magenta,
  navigate: ANSI.cyan,
  query: ANSI.white,
  unknown: ANSI.gray,
};

/**
 * SemanticColorizer assigns colors based on command intent.
 */
export class SemanticColorizer {
  private theme: SemanticTheme;

  constructor(theme: Partial<SemanticTheme> = {}) {
    this.theme = { ...DEFAULT_THEME, ...theme };
  }

  /** Classify a command's intent. */
  classifyIntent(command: string): CommandIntent {
    const trimmed = command.trim();
    for (const { intent, patterns } of INTENT_PATTERNS) {
      if (patterns.some((p) => p.test(trimmed))) {
        return intent;
      }
    }
    return "unknown";
  }

  /** Get the ANSI color code for a command based on its intent. */
  colorFor(command: string): string {
    const intent = this.classifyIntent(command);
    return this.theme[intent];
  }

  /** Apply semantic coloring to a command string. */
  colorize(command: string): string {
    const color = this.colorFor(command);
    return `${color}${command}${ANSI.reset}`;
  }
}

/** Spinner frame sequences. */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * ProgressRenderer provides animated progress visualization.
 */
export class ProgressRenderer {
  private startTime: number = 0;
  private spinnerFrame: number = 0;

  /** Create a new progress state. */
  start(label: string, total: number): ProgressState {
    this.startTime = Date.now();
    return {
      label,
      current: 0,
      total,
      percent: 0,
      elapsedMs: 0,
      etaMs: null,
      complete: false,
    };
  }

  /** Update progress. */
  update(state: ProgressState, current: number): ProgressState {
    const elapsedMs = Date.now() - this.startTime;
    const percent =
      state.total > 0 ? Math.round((current / state.total) * 100) : 0;
    const rate = current / (elapsedMs || 1);
    const remaining = state.total - current;
    const etaMs = rate > 0 ? remaining / rate : null;

    return {
      ...state,
      current,
      percent,
      elapsedMs,
      etaMs,
      complete: current >= state.total,
    };
  }

  /** Render a progress bar string. */
  renderBar(state: ProgressState, width: number = 30): string {
    const filled = Math.round((state.percent / 100) * width);
    const empty = width - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    const eta =
      state.etaMs != null ? ` ETA: ${Math.round(state.etaMs / 1000)}s` : "";
    return `${state.label} [${bar}] ${state.percent}%${eta}`;
  }

  /** Render a spinner frame. */
  renderSpinner(label: string): string {
    const frame = SPINNER_FRAMES[this.spinnerFrame % SPINNER_FRAMES.length];
    this.spinnerFrame++;
    return `${frame} ${label}`;
  }
}

/**
 * OutputFormatter auto-detects and pretty-prints structured output.
 */
export class OutputFormatter {
  /** Detect if output is structured data and format it. */
  format(output: string): string {
    const trimmed = output.trim();

    // Try JSON formatting
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // Not valid JSON, return as-is
      }
    }

    // Try XML indentation
    if (trimmed.startsWith("<") && !trimmed.startsWith("<<")) {
      const indented = this.indentXml(trimmed);
      if (indented !== trimmed) return indented;
    }

    return output;
  }

  /** Check if output appears to be structured data. */
  isStructured(output: string): boolean {
    const trimmed = output.trim();
    return (
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith("<?xml") ||
      trimmed.startsWith("<")
    );
  }

  /**
   * Indent XML content for readability.
   * Handles basic XML with nested tags; does not process namespaces or DTDs.
   */
  indentXml(xml: string): string {
    const INDENT = "  ";
    let depth = 0;
    const lines: string[] = [];

    // Tokenize by XML tags
    const tokens = xml
      .replace(/>\s*</g, ">\n<")
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    for (const token of tokens) {
      const isClosing = token.startsWith("</");
      const isSelfClosing = token.endsWith("/>") || token.startsWith("<?");
      const isOpening = token.startsWith("<") && !isClosing && !isSelfClosing;

      if (isClosing) {
        depth = Math.max(0, depth - 1);
      }

      lines.push(`${INDENT.repeat(depth)}${token}`);

      if (isOpening) {
        depth++;
      }
    }

    return lines.join("\n");
  }
}

/**
 * HistoryTimeline provides searchable, tagged command history.
 */
export class HistoryTimeline {
  private entries: Map<string, TimelineEntry> = new Map();
  private counter: number = 0;

  /** Add a command to the timeline. */
  add(
    command: string,
    output?: string,
    exitCode?: number,
    tags: string[] = []
  ): TimelineEntry {
    const id = `tl-${++this.counter}`;
    const entry: TimelineEntry = {
      id,
      command,
      output,
      exitCode,
      timestamp: Date.now(),
      tags,
      bookmarked: false,
    };
    this.entries.set(id, entry);
    return entry;
  }

  /** Search the timeline by text or tag. */
  search(query: string): TimelineEntry[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.entries.values()).filter(
      (e) =>
        e.command.toLowerCase().includes(lowerQuery) ||
        e.tags.some((t) => t.toLowerCase().includes(lowerQuery)) ||
        (e.output && e.output.toLowerCase().includes(lowerQuery))
    );
  }

  /** Toggle bookmark on an entry. */
  toggleBookmark(id: string): boolean {
    const entry = this.entries.get(id);
    if (entry) {
      entry.bookmarked = !entry.bookmarked;
      return entry.bookmarked;
    }
    return false;
  }

  /** Add a tag to an entry. */
  addTag(id: string, tag: string): void {
    const entry = this.entries.get(id);
    if (entry && !entry.tags.includes(tag)) {
      entry.tags.push(tag);
    }
  }

  /** Get all entries. */
  getAll(): TimelineEntry[] {
    return Array.from(this.entries.values());
  }

  /** Get bookmarked entries. */
  getBookmarked(): TimelineEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.bookmarked);
  }

  /** Get entries by tag. */
  getByTag(tag: string): TimelineEntry[] {
    return Array.from(this.entries.values()).filter((e) =>
      e.tags.includes(tag)
    );
  }

  /** Remove a specific tag from an entry. */
  removeTag(id: string, tag: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.tags = entry.tags.filter((t) => t !== tag);
    }
  }

  /** Clear all entries from the timeline. */
  clear(): void {
    this.entries.clear();
    this.counter = 0;
  }
}
