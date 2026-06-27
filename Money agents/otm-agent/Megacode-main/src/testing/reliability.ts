/**
 * Testing & Reliability for OverCoat.
 *
 * Implementation plan for testing and reliability features:
 *
 * 1. Dry-Run Everywhere
 *    - See exactly what would happen without executing
 *    - Command simulation with effect prediction
 *    - Implementation: Command parser + effect analyzer,
 *      file system change simulation, network request preview,
 *      human-readable output of predicted effects
 *
 * 2. Command Testing
 *    - Unit tests for bash scripts
 *    - Assert on exit codes, output patterns, and side effects
 *    - Implementation: Test runner for shell scripts,
 *      assertion library (exit code, stdout/stderr matching, file changes),
 *      test isolation with temp directories, reporting
 *
 * 3. Rollback Capabilities
 *    - Automatic undo for destructive operations
 *    - Creates backups before modifications, supports rollback
 *    - Implementation: Pre-execution state capture (file backups,
 *      database snapshots), operation log with undo actions,
 *      rollback command that reverses last N operations
 *
 * 4. State Snapshots
 *    - Save and restore system/project states
 *    - Capture and restore directory trees, configs, and env vars
 *    - Implementation: Directory tree serialization, env var capture,
 *      named snapshot storage, diff between snapshots,
 *      selective restore (files only, env only, full)
 */

/** A predicted effect of a command (for dry-run). */
export interface PredictedEffect {
  /** Type of effect. */
  type: "file-create" | "file-modify" | "file-delete" | "network" | "process" | "env-change";
  /** Description of the effect. */
  description: string;
  /** Target (file path, URL, process name, env var). */
  target: string;
  /** Severity (how destructive is this effect). */
  severity: "safe" | "cautious" | "destructive";
}

/** Result of a dry-run analysis. */
export interface DryRunResult {
  /** The command being analyzed. */
  command: string;
  /** Predicted effects. */
  effects: PredictedEffect[];
  /** Whether the command is safe to run. */
  safe: boolean;
  /** Warnings, if any. */
  warnings: string[];
  /** Human-readable summary. */
  summary: string;
}

/** A test assertion for command testing. */
export interface CommandAssertion {
  /** What to assert on. */
  type: "exit-code" | "stdout-contains" | "stdout-matches" | "stderr-contains" | "file-exists" | "file-contains";
  /** Expected value or pattern. */
  expected: string | number;
  /** Human-readable description of this assertion. */
  description: string;
}

/** A command test case. */
export interface CommandTestCase {
  /** Test name. */
  name: string;
  /** The command to test. */
  command: string;
  /** Setup commands to run before the test. */
  setup?: string[];
  /** Assertions to check after execution. */
  assertions: CommandAssertion[];
  /** Teardown commands to run after the test. */
  teardown?: string[];
  /** Timeout in milliseconds. */
  timeoutMs: number;
}

/** Result of a single test case. */
export interface TestResult {
  testName: string;
  passed: boolean;
  /** Results of individual assertions. */
  assertionResults: Array<{
    assertion: CommandAssertion;
    passed: boolean;
    actual?: string | number;
    message?: string;
  }>;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Error message, if the test itself failed. */
  error?: string;
}

/** A rollback-capable operation. */
export interface RollbackOperation {
  /** Unique operation ID. */
  id: string;
  /** The command that was executed. */
  command: string;
  /** Timestamp. */
  timestamp: number;
  /** Backup data for rollback. */
  backup: OperationBackup;
  /** Whether this operation has been rolled back. */
  rolledBack: boolean;
}

/** Backup data for a single operation. */
export interface OperationBackup {
  /** Files that were modified (path → original content). */
  modifiedFiles: Map<string, string>;
  /** Files that were created (for deletion on rollback). */
  createdFiles: string[];
  /** Files that were deleted (path → content for restoration). */
  deletedFiles: Map<string, string>;
}

/** A project state snapshot. */
export interface StateSnapshot {
  /** Snapshot identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Timestamp of capture. */
  timestamp: number;
  /** File paths and their checksums (for change detection). */
  fileChecksums: Record<string, string>;
  /** Environment variables. */
  envVars: Record<string, string>;
  /** Working directory. */
  cwd: string;
  /** Git branch, if in a git repo. */
  gitBranch?: string;
  /** Git HEAD commit, if in a git repo. */
  gitHead?: string;
}

/** Diff between two snapshots. */
export interface SnapshotDiff {
  /** Snapshot names/IDs being compared. */
  from: string;
  to: string;
  /** Files added. */
  addedFiles: string[];
  /** Files removed. */
  removedFiles: string[];
  /** Files modified (checksum changed). */
  modifiedFiles: string[];
  /** Env vars added. */
  addedEnvVars: string[];
  /** Env vars removed. */
  removedEnvVars: string[];
  /** Env vars changed. */
  changedEnvVars: string[];
}

/** Common command-to-effect mappings for dry run analysis. */
const EFFECT_PATTERNS: Array<{
  pattern: RegExp;
  effects: (match: RegExpMatchArray) => PredictedEffect[];
}> = [
  {
    pattern: /\brm\s+(?:-[rfi]+\s+)?(.+)/,
    effects: (match) => [
      {
        type: "file-delete",
        description: `Delete: ${match[1]}`,
        target: match[1].trim(),
        severity: match[0].includes("-r") ? "destructive" : "cautious",
      },
    ],
  },
  {
    pattern: /\bmkdir\s+(?:-p\s+)?(.+)/,
    effects: (match) => [
      {
        type: "file-create",
        description: `Create directory: ${match[1]}`,
        target: match[1].trim(),
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\btouch\s+(.+)/,
    effects: (match) => [
      {
        type: "file-create",
        description: `Create or update file: ${match[1]}`,
        target: match[1].trim(),
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\bcp\s+(.+)\s+(.+)/,
    effects: (match) => [
      {
        type: "file-create",
        description: `Copy ${match[1]} to ${match[2]}`,
        target: match[2].trim(),
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\bmv\s+(.+)\s+(.+)/,
    effects: (match) => [
      {
        type: "file-modify",
        description: `Move ${match[1]} to ${match[2]}`,
        target: match[1].trim(),
        severity: "cautious",
      },
    ],
  },
  {
    pattern: /\bcurl\s+.*?(https?:\/\/\S+)/,
    effects: (match) => [
      {
        type: "network",
        description: `HTTP request to ${match[1]}`,
        target: match[1],
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\bwget\s+.*?(https?:\/\/\S+)/,
    effects: (match) => [
      {
        type: "network",
        description: `Download from ${match[1]}`,
        target: match[1],
        severity: "safe",
      },
    ],
  },
  {
    // echo "text" >> file (append) — must be checked BEFORE single-redirect
    pattern: /\becho\b.+>>\s*(\S+)/,
    effects: (match) => [
      {
        type: "file-modify",
        description: `Append to file: ${match[1]}`,
        target: match[1].trim(),
        severity: "safe",
      },
    ],
  },
  {
    // echo "text" > file (overwrite) — use negative lookahead to exclude >>
    pattern: /\becho\b.+(?<![>])>\s*(\S+)/,
    effects: (match) => [
      {
        type: "file-modify",
        description: `Overwrite file: ${match[1]}`,
        target: match[1].trim(),
        severity: "cautious",
      },
    ],
  },
  {
    pattern: /\bchmod\s+\S+\s+(.+)/,
    effects: (match) => [
      {
        type: "env-change",
        description: `Change permissions on: ${match[1]}`,
        target: match[1].trim(),
        severity: "cautious",
      },
    ],
  },
  {
    pattern: /\bchown\s+\S+\s+(.+)/,
    effects: (match) => [
      {
        type: "env-change",
        description: `Change ownership of: ${match[1]}`,
        target: match[1].trim(),
        severity: "cautious",
      },
    ],
  },
  {
    pattern: /\bnpm\s+install\b/,
    effects: () => [
      {
        type: "file-create",
        description: "Install npm packages into node_modules",
        target: "node_modules",
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\bpip3?\s+install\b/,
    effects: () => [
      {
        type: "file-create",
        description: "Install Python packages",
        target: "site-packages",
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\bcargo\s+install\b/,
    effects: () => [
      {
        type: "file-create",
        description: "Install Rust binary to ~/.cargo/bin",
        target: "~/.cargo/bin",
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\bgit\s+clone\s+\S+(?:\s+(\S+))?/,
    effects: (match) => [
      {
        type: "file-create",
        description: `Clone repository into: ${match[1] ?? "new directory"}`,
        target: match[1]?.trim() ?? ".",
        severity: "safe",
      },
    ],
  },
  {
    pattern: /\bgit\s+init\b/,
    effects: () => [
      {
        type: "file-create",
        description: "Initialize a new git repository (.git directory)",
        target: ".git",
        severity: "safe",
      },
    ],
  },
];

/**
 * DryRunner analyzes commands and predicts their effects
 * without actually executing them.
 */
export class DryRunner {
  /**
   * Analyze a command and predict its effects.
   */
  analyze(command: string): DryRunResult {
    const effects: PredictedEffect[] = [];
    const warnings: string[] = [];

    for (const { pattern, effects: getEffects } of EFFECT_PATTERNS) {
      const match = command.match(pattern);
      if (match) {
        effects.push(...getEffects(match));
      }
    }

    // Check for destructive operations
    const hasDestructive = effects.some((e) => e.severity === "destructive");
    if (hasDestructive) {
      warnings.push("This command includes destructive operations that cannot be undone");
    }

    // Check for sudo
    if (command.includes("sudo")) {
      warnings.push("This command requires elevated privileges");
    }

    const safe = !hasDestructive && warnings.length === 0;
    const summary =
      effects.length > 0
        ? `${effects.length} effect(s) predicted: ${effects.map((e) => e.description).join("; ")}`
        : "No side effects predicted";

    return {
      command,
      effects,
      safe,
      warnings,
      summary,
    };
  }
}

/**
 * CommandTestRunner executes command test cases and reports results.
 */
export class CommandTestRunner {
  private testCases: CommandTestCase[] = [];

  /** Add a test case. */
  addTest(testCase: CommandTestCase): void {
    this.testCases.push(testCase);
  }

  /** Get all registered test cases. */
  getTests(): CommandTestCase[] {
    return [...this.testCases];
  }

  /**
   * Check assertions against actual command output and optional file system state.
   * Pass `files` as a map of `{ [filePath]: fileContent }` to support
   * `file-exists` and `file-contains` assertion types.
   */
  checkAssertions(
    assertions: CommandAssertion[],
    actual: { exitCode: number; stdout: string; stderr: string },
    files: Record<string, string> = {}
  ): TestResult["assertionResults"] {
    return assertions.map((assertion) => {
      switch (assertion.type) {
        case "exit-code":
          return {
            assertion,
            passed: actual.exitCode === assertion.expected,
            actual: actual.exitCode,
            message:
              actual.exitCode === assertion.expected
                ? undefined
                : `Expected exit code ${assertion.expected}, got ${actual.exitCode}`,
          };
        case "stdout-contains":
          return {
            assertion,
            passed: actual.stdout.includes(String(assertion.expected)),
            actual: actual.stdout.substring(0, 200),
            message: actual.stdout.includes(String(assertion.expected))
              ? undefined
              : `stdout does not contain "${assertion.expected}"`,
          };
        case "stderr-contains":
          return {
            assertion,
            passed: actual.stderr.includes(String(assertion.expected)),
            actual: actual.stderr.substring(0, 200),
            message: actual.stderr.includes(String(assertion.expected))
              ? undefined
              : `stderr does not contain "${assertion.expected}"`,
          };
        case "stdout-matches": {
          const regex = new RegExp(String(assertion.expected));
          return {
            assertion,
            passed: regex.test(actual.stdout),
            actual: actual.stdout.substring(0, 200),
            message: regex.test(actual.stdout)
              ? undefined
              : `stdout does not match pattern "${assertion.expected}"`,
          };
        }
        case "file-exists": {
          const filePath = String(assertion.expected);
          const exists = filePath in files;
          return {
            assertion,
            passed: exists,
            actual: exists ? "exists" : "not found",
            message: exists
              ? undefined
              : `File "${filePath}" does not exist`,
          };
        }
        case "file-contains": {
          const [filePath, ...rest] = String(assertion.expected).split(":");
          const searchText = rest.join(":");
          const fileContent = files[filePath];
          if (fileContent === undefined) {
            return {
              assertion,
              passed: false,
              actual: "file not found",
              message: `File "${filePath}" does not exist`,
            };
          }
          const contains = fileContent.includes(searchText);
          return {
            assertion,
            passed: contains,
            actual: fileContent.substring(0, 200),
            message: contains
              ? undefined
              : `File "${filePath}" does not contain "${searchText}"`,
          };
        }
        default:
          return {
            assertion,
            passed: false,
            message: `Unknown assertion type: ${assertion.type}`,
          };
      }
    });
  }
}

/**
 * RollbackManager tracks operations and supports undo.
 */
export class RollbackManager {
  private operations: RollbackOperation[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  /**
   * Record an operation for potential rollback.
   */
  record(command: string, backup: OperationBackup): RollbackOperation {
    const operation: RollbackOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      command,
      timestamp: Date.now(),
      backup,
      rolledBack: false,
    };
    this.operations.push(operation);
    if (this.operations.length > this.maxHistory) {
      this.operations.shift();
    }
    return operation;
  }

  /**
   * Get the last N operations that can be rolled back.
   */
  getUndoable(count: number = 5): RollbackOperation[] {
    return this.operations
      .filter((op) => !op.rolledBack)
      .slice(-count)
      .reverse();
  }

  /**
   * Mark an operation as rolled back.
   */
  markRolledBack(id: string): boolean {
    const op = this.operations.find((o) => o.id === id);
    if (op) {
      op.rolledBack = true;
      return true;
    }
    return false;
  }

  /** Get all operations. */
  getHistory(): RollbackOperation[] {
    return [...this.operations];
  }
}

/**
 * SnapshotManager captures and compares project state snapshots.
 */
export class SnapshotManager {
  private snapshots: Map<string, StateSnapshot> = new Map();

  /**
   * Save a snapshot.
   */
  save(snapshot: StateSnapshot): void {
    this.snapshots.set(snapshot.id, snapshot);
  }

  /**
   * Get a snapshot by ID.
   */
  get(id: string): StateSnapshot | null {
    return this.snapshots.get(id) ?? null;
  }

  /**
   * Compare two snapshots and produce a diff.
   */
  diff(fromId: string, toId: string): SnapshotDiff | null {
    const from = this.snapshots.get(fromId);
    const to = this.snapshots.get(toId);
    if (!from || !to) return null;

    const fromFiles = new Set(Object.keys(from.fileChecksums));
    const toFiles = new Set(Object.keys(to.fileChecksums));

    const addedFiles = [...toFiles].filter((f) => !fromFiles.has(f));
    const removedFiles = [...fromFiles].filter((f) => !toFiles.has(f));
    const modifiedFiles = [...fromFiles].filter(
      (f) => toFiles.has(f) && from.fileChecksums[f] !== to.fileChecksums[f]
    );

    const fromEnvKeys = new Set(Object.keys(from.envVars));
    const toEnvKeys = new Set(Object.keys(to.envVars));
    const addedEnvVars = [...toEnvKeys].filter((k) => !fromEnvKeys.has(k));
    const removedEnvVars = [...fromEnvKeys].filter((k) => !toEnvKeys.has(k));
    const changedEnvVars = [...fromEnvKeys].filter(
      (k) => toEnvKeys.has(k) && from.envVars[k] !== to.envVars[k]
    );

    return {
      from: fromId,
      to: toId,
      addedFiles,
      removedFiles,
      modifiedFiles,
      addedEnvVars,
      removedEnvVars,
      changedEnvVars,
    };
  }

  /** List all snapshots. */
  list(): StateSnapshot[] {
    return Array.from(this.snapshots.values());
  }

  /** Delete a snapshot. */
  delete(id: string): boolean {
    return this.snapshots.delete(id);
  }
}
