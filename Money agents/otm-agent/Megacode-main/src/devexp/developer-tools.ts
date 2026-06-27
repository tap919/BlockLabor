/**
 * Developer Experience for OverCoat.
 *
 * Implementation plan for developer experience features:
 *
 * 1. Interactive Debugger
 *    - Step through bash scripts with a visual interface
 *    - Set breakpoints, inspect variables, step in/over/out
 *    - Implementation: Parse shell scripts into AST, execute line-by-line,
 *      capture variable state at each step, TUI with source display and
 *      variable panel, WebSocket API for IDE integration
 *
 * 2. Visual Data Explorer
 *    - Displays query results as beautiful formatted tables
 *    - Auto-detects data format (JSON, CSV, SQL results)
 *    - Implementation: Format detection heuristics, table renderer
 *      with column alignment and truncation, syntax highlighting,
 *      collapsible nested structures for JSON/YAML/XML
 *
 * 3. Live Collaboration
 *    - Share terminal sessions with comments and annotations
 *    - Real-time session streaming with viewer management
 *    - Implementation: WebSocket session relay server, terminal
 *      input/output recording, cursor position sync, comment overlay,
 *      role-based access (driver/navigator/viewer)
 *
 * 4. Time-Travel Debugging
 *    - Replay command sequences and their effects
 *    - Capture full system state at each command for replay
 *    - Implementation: Command+output recording with timestamps,
 *      state snapshot at each step, bidirectional navigation,
 *      diff visualization between steps
 *
 * 5. Smart Tab Completion
 *    - Completes based on project context, not just binaries
 *    - Considers recent files, git branches, environment variables
 *    - Implementation: Completion provider interface, project-aware
 *      file/path completions, git branch/tag completions,
 *      LLM-assisted natural language completions
 */

/** A debug breakpoint in a script. */
export interface Breakpoint {
  /** File path of the script. */
  filePath: string;
  /** Line number (1-based). */
  line: number;
  /** Optional condition expression. */
  condition?: string;
  /** Whether the breakpoint is enabled. */
  enabled: boolean;
}

/** Variable state captured during debugging. */
export interface DebugVariable {
  name: string;
  value: string;
  /** Scope (e.g., "local", "global", "environment"). */
  scope: string;
}

/** State of a debug session at a given step. */
export interface DebugState {
  /** Current file being debugged. */
  filePath: string;
  /** Current line number. */
  currentLine: number;
  /** Variables in scope at this point. */
  variables: DebugVariable[];
  /** Output produced at this step. */
  output: string;
  /** Step number (0-based). */
  stepIndex: number;
  /** Whether the debugger is paused. */
  paused: boolean;
}

/** Supported data formats for the visual explorer. */
export type DataFormat = "json" | "csv" | "table" | "yaml" | "xml" | "text";

/** Formatted output for the data explorer. */
export interface FormattedData {
  /** Detected input format. */
  format: DataFormat;
  /** Headers/column names, if applicable. */
  headers?: string[];
  /** Data rows, each row is an array of cell values. */
  rows?: string[][];
  /** Formatted text output for display. */
  rendered: string;
  /** Total row count. */
  rowCount: number;
}

/** A collaboration session participant. */
export interface Participant {
  id: string;
  name: string;
  role: "driver" | "navigator" | "viewer";
  joinedAt: number;
}

/** A comment/annotation on a collaboration session. */
export interface SessionAnnotation {
  id: string;
  authorId: string;
  /** Timestamp in the session timeline this annotation refers to. */
  sessionTimestamp: number;
  message: string;
  createdAt: number;
}

/** A recorded step for time-travel debugging. */
export interface TimelineStep {
  /** Step index (0-based). */
  index: number;
  /** The command executed. */
  command: string;
  /** Command output (stdout + stderr). */
  output: string;
  /** Exit code. */
  exitCode: number;
  /** Working directory at execution time. */
  cwd: string;
  /** Timestamp of execution. */
  timestamp: number;
  /** Duration in milliseconds. */
  durationMs: number;
}

/** A tab completion suggestion. */
export interface CompletionItem {
  /** The completion text to insert. */
  text: string;
  /** Display label. */
  label: string;
  /** Type of completion (e.g., "file", "command", "branch", "env-var"). */
  type: string;
  /** Optional description. */
  description?: string;
  /** Relevance score 0-1. */
  score: number;
}

/**
 * DataExplorer auto-formats data output for visual display.
 */
export class DataExplorer {
  /**
   * Detect the format of raw data input.
   */
  detectFormat(input: string): DataFormat {
    const trimmed = input.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "json";
    if (trimmed.startsWith("<?xml") || trimmed.startsWith("<")) return "xml";
    if (trimmed.includes("\t") && trimmed.includes("\n")) return "table";
    if (
      trimmed.includes(",") &&
      trimmed.includes("\n") &&
      trimmed.split("\n")[0].includes(",")
    )
      return "csv";
    if (trimmed.includes(":") && trimmed.includes("\n")) return "yaml";
    return "text";
  }

  /**
   * Format data for visual display.
   */
  format(input: string): FormattedData {
    const dataFormat = this.detectFormat(input);

    switch (dataFormat) {
      case "json":
        return this.formatJSON(input);
      case "csv":
        return this.formatCSV(input);
      default:
        return {
          format: dataFormat,
          rendered: input,
          rowCount: input.split("\n").length,
        };
    }
  }

  private formatJSON(input: string): FormattedData {
    try {
      const data = JSON.parse(input);
      const rendered = JSON.stringify(data, null, 2);
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === "object") {
        const headers = Object.keys(data[0]);
        const rows = data.map((item: Record<string, unknown>) =>
          headers.map((h) => String(item[h] ?? ""))
        );
        return {
          format: "json",
          headers,
          rows,
          rendered: this.renderTable(headers, rows),
          rowCount: rows.length,
        };
      }
      return { format: "json", rendered, rowCount: 1 };
    } catch {
      return { format: "json", rendered: input, rowCount: 1 };
    }
  }

  private formatCSV(input: string): FormattedData {
    const lines = input.trim().split("\n");
    if (lines.length === 0) {
      return { format: "csv", rendered: input, rowCount: 0 };
    }
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) =>
      line.split(",").map((cell) => cell.trim())
    );
    return {
      format: "csv",
      headers,
      rows,
      rendered: this.renderTable(headers, rows),
      rowCount: rows.length,
    };
  }

  private renderTable(headers: string[], rows: string[][]): string {
    const colWidths = headers.map((h, i) =>
      Math.max(
        h.length,
        ...rows.map((r) => (r[i] ?? "").length)
      )
    );

    const pad = (s: string, w: number) => s.padEnd(w);
    const headerLine = headers
      .map((h, i) => pad(h, colWidths[i]))
      .join(" | ");
    const separator = colWidths.map((w) => "-".repeat(w)).join("-+-");
    const dataLines = rows.map((row) =>
      row.map((cell, i) => pad(cell, colWidths[i])).join(" | ")
    );

    return [headerLine, separator, ...dataLines].join("\n");
  }
}

/**
 * CommandTimeline records and replays command execution
 * for time-travel debugging.
 */
export class CommandTimeline {
  private steps: TimelineStep[] = [];
  private currentIndex = -1;

  /** Record a new step. */
  record(step: Omit<TimelineStep, "index">): TimelineStep {
    const newStep: TimelineStep = {
      ...step,
      index: this.steps.length,
    };
    this.steps.push(newStep);
    this.currentIndex = newStep.index;
    return newStep;
  }

  /** Get all recorded steps. */
  getSteps(): TimelineStep[] {
    return [...this.steps];
  }

  /** Navigate to a specific step. */
  goToStep(index: number): TimelineStep | null {
    if (index < 0 || index >= this.steps.length) return null;
    this.currentIndex = index;
    return this.steps[index];
  }

  /** Go to the previous step. */
  stepBack(): TimelineStep | null {
    return this.goToStep(this.currentIndex - 1);
  }

  /** Go to the next step. */
  stepForward(): TimelineStep | null {
    return this.goToStep(this.currentIndex + 1);
  }

  /** Get the current step. */
  getCurrentStep(): TimelineStep | null {
    return this.currentIndex >= 0 ? this.steps[this.currentIndex] : null;
  }

  /** Get total number of steps. */
  getLength(): number {
    return this.steps.length;
  }
}

/**
 * SmartCompleter provides project-aware tab completions.
 */
export class SmartCompleter {
  private projectFiles: string[] = [];
  private gitBranches: string[] = [];
  private envVars: string[] = [];
  private recentCommands: string[] = [];

  /** Update the set of known project files. */
  setProjectFiles(files: string[]): void {
    this.projectFiles = files;
  }

  /** Update the set of known git branches. */
  setGitBranches(branches: string[]): void {
    this.gitBranches = branches;
  }

  /** Update the set of known environment variables. */
  setEnvVars(vars: string[]): void {
    this.envVars = vars;
  }

  /** Record a recently used command. */
  recordCommand(command: string): void {
    this.recentCommands.unshift(command);
    if (this.recentCommands.length > 100) {
      this.recentCommands.pop();
    }
  }

  /**
   * Generate completion suggestions for the given input prefix.
   */
  complete(prefix: string): CompletionItem[] {
    const items: CompletionItem[] = [];

    // File completions
    for (const file of this.projectFiles) {
      if (file.includes(prefix) || file.startsWith(prefix)) {
        items.push({
          text: file,
          label: file,
          type: "file",
          score: file.startsWith(prefix) ? 0.8 : 0.5,
        });
      }
    }

    // Git branch completions
    for (const branch of this.gitBranches) {
      if (branch.startsWith(prefix)) {
        items.push({
          text: branch,
          label: branch,
          type: "branch",
          description: "Git branch",
          score: 0.7,
        });
      }
    }

    // Environment variable completions
    for (const envVar of this.envVars) {
      if (envVar.startsWith(prefix.replace("$", ""))) {
        items.push({
          text: `$${envVar}`,
          label: envVar,
          type: "env-var",
          score: 0.6,
        });
      }
    }

    // Recent command completions
    for (const cmd of this.recentCommands) {
      if (cmd.startsWith(prefix)) {
        items.push({
          text: cmd,
          label: cmd,
          type: "command",
          description: "Recent command",
          score: 0.9,
        });
      }
    }

    return items.sort((a, b) => b.score - a.score);
  }
}
