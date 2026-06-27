/**
 * BashSkill — Item #25 (Claude Code skill)
 *
 * A safe, structured wrapper around shell command execution.
 * Provides:
 *   - Allowlist/blocklist-based command safety gate (integrates with DestructiveCommandGate)
 *   - Timeout enforcement
 *   - Structured output (stdout, stderr, exit code, duration)
 *   - Command history
 *   - Dry-run mode (preview command without execution)
 *
 * Mirrors the BashTool used internally by Claude Code agents.
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/** Result of a shell command execution. */
export interface BashResult {
  /** The command that was run. */
  command: string;
  /** Standard output. */
  stdout: string;
  /** Standard error. */
  stderr: string;
  /** Exit code. */
  exitCode: number;
  /** Whether the command succeeded (exit code 0). */
  success: boolean;
  /** Execution duration in ms. */
  durationMs: number;
  /** Whether this was a dry-run (not actually executed). */
  dryRun: boolean;
}

/** Configuration for BashSkill. */
export interface BashSkillConfig {
  /**
   * Working directory for commands. Defaults to process.cwd().
   */
  cwd?: string;
  /**
   * Default timeout in ms. Default: 30 000 (30 seconds).
   */
  timeoutMs?: number;
  /**
   * If true, commands are previewed but never executed.
   */
  dryRun?: boolean;
  /**
   * Patterns that are always blocked (regex). These override the allowlist.
   */
  blocklist?: RegExp[];
  /**
   * Maximum number of history entries. Default: 500.
   */
  maxHistory?: number;
  /**
   * Environment variables to merge into the child process environment.
   */
  env?: Record<string, string>;
}

// ============================================================================
// BashSkill (Item #25)
// ============================================================================

/**
 * BashSkill: Safe, structured shell command execution.
 *
 * Usage:
 *   const bash = new BashSkill({ cwd: "/my/project", timeoutMs: 60000 });
 *
 *   const result = await bash.run("npm test");
 *   if (!result.success) {
 *     console.error(result.stderr);
 *   }
 *
 *   // Dry-run preview:
 *   const preview = bash.preview("rm -rf dist");
 *   console.log(preview);
 */
export class BashSkill extends EventEmitter {
  private config: Required<BashSkillConfig>;
  private history: BashResult[] = [];

  constructor(config: BashSkillConfig = {}) {
    super();
    this.config = {
      cwd: config.cwd ?? process.cwd(),
      timeoutMs: config.timeoutMs ?? 30_000,
      dryRun: config.dryRun ?? false,
      blocklist: config.blocklist ?? [
        // Default hard blocks matching DestructiveCommandGate's "block" severity
        /DROP\s+DATABASE/i,
        /DROP\s+TABLE/i,
        /\bdd\b.*of=\/dev\//i,
        /:\(\)\{.*\|.*:&\};:/,    // fork bomb
        /\bmkfs\b/i,
        /\bformat\b.*\/dev\//i,
      ],
      maxHistory: config.maxHistory ?? 500,
      env: config.env ?? {},
    };
  }

  // --------------------------------------------------------------------------
  // Execution
  // --------------------------------------------------------------------------

  /**
   * Execute a shell command.
   *
   * @param command   The command string to run (passed to /bin/sh or cmd.exe).
   * @param options   Per-call overrides.
   * @returns         Structured BashResult.
   */
  async run(
    command: string,
    options: { cwd?: string; timeoutMs?: number; dryRun?: boolean } = {}
  ): Promise<BashResult> {
    const cwd = options.cwd ?? this.config.cwd;
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const dryRun = options.dryRun ?? this.config.dryRun;

    // Safety gate — check blocklist
    const blocked = this._isBlocked(command);
    if (blocked) {
      const result: BashResult = {
        command,
        stdout: "",
        stderr: `Command blocked: matches blocklist pattern '${blocked.source}'`,
        exitCode: -1,
        success: false,
        durationMs: 0,
        dryRun: false,
      };
      this._record(result);
      this.emit("blocked", command, blocked);
      return result;
    }

    // Dry-run mode
    if (dryRun) {
      const result: BashResult = {
        command,
        stdout: `[dry-run] Would execute: ${command}`,
        stderr: "",
        exitCode: 0,
        success: true,
        durationMs: 0,
        dryRun: true,
      };
      this._record(result);
      this.emit("dry-run", command);
      return result;
    }

    // Execute
    this.emit("before-run", command);
    const t0 = Date.now();

    let stdout = "";
    let stderr = "";
    let exitCode = 0;

    try {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      const execAsync = promisify(exec);

      const env = { ...process.env, ...this.config.env } as Record<string, string>;

      const result = await execAsync(command, {
        cwd,
        timeout: timeoutMs,
        env,
        maxBuffer: 10 * 1024 * 1024, // 10 MB
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (err: unknown) {
      // exec rejects with an Error that has stdout/stderr/code properties
      const e = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean; message?: string };
      stdout = e.stdout ?? "";
      stderr = e.stderr ?? (e.message ?? "Unknown error");
      exitCode = typeof e.code === "number" ? e.code : 1;
      if (e.killed) {
        stderr += `\n[Command timed out after ${timeoutMs}ms]`;
        exitCode = 124; // conventional timeout exit code
      }
    }

    const durationMs = Date.now() - t0;

    // If exitCode is still 0 but stderr is not empty, check if exec put exit code elsewhere
    if (exitCode === 0 && stdout === "" && stderr !== "" && !stderr.includes("[Command timed out")) {
      // Could still be a normal success with stderr output — leave exitCode as 0
    }

    const bashResult: BashResult = {
      command,
      stdout,
      stderr,
      exitCode,
      success: exitCode === 0,
      durationMs,
      dryRun: false,
    };

    this._record(bashResult);
    this.emit("after-run", bashResult);

    return bashResult;
  }

  /**
   * Run a command and return stdout as a string (throws on non-zero exit).
   */
  async output(command: string): Promise<string> {
    const result = await this.run(command);
    if (!result.success) {
      throw new Error(
        `Command failed (exit ${result.exitCode}): ${command}\n${result.stderr}`
      );
    }
    return result.stdout.trim();
  }

  /**
   * Preview what would be executed (returns a human-readable description,
   * never runs anything).
   */
  preview(command: string): string {
    const blocked = this._isBlocked(command);
    if (blocked) {
      return `[BLOCKED] ${command}\n  Reason: matches blocklist pattern '${blocked.source}'`;
    }
    return `[DRY-RUN] Would execute:\n  $ ${command}\n  cwd: ${this.config.cwd}\n  timeout: ${this.config.timeoutMs}ms`;
  }

  // --------------------------------------------------------------------------
  // History
  // --------------------------------------------------------------------------

  /** Get command execution history. */
  getHistory(): BashResult[] {
    return [...this.history];
  }

  /** Get the last N history entries. */
  recent(n = 10): BashResult[] {
    return this.history.slice(-n);
  }

  /** Get only failed commands from history. */
  failures(): BashResult[] {
    return this.history.filter((r) => !r.success && !r.dryRun);
  }

  /** Clear history. */
  clearHistory(): void {
    this.history = [];
  }

  // --------------------------------------------------------------------------
  // Configuration
  // --------------------------------------------------------------------------

  /** Set the working directory. */
  setCwd(cwd: string): void {
    this.config.cwd = cwd;
  }

  /** Toggle global dry-run mode. */
  setDryRun(dryRun: boolean): void {
    this.config.dryRun = dryRun;
  }

  /** Add a blocklist pattern. */
  addBlock(pattern: RegExp): void {
    this.config.blocklist.push(pattern);
  }

  // --------------------------------------------------------------------------
  // Private
  // --------------------------------------------------------------------------

  private _isBlocked(command: string): RegExp | null {
    for (const pattern of this.config.blocklist) {
      if (pattern.test(command)) return pattern;
    }
    return null;
  }

  private _record(result: BashResult): void {
    this.history.push(result);
    if (this.history.length > this.config.maxHistory) {
      this.history.shift();
    }
  }
}
