/**
 * CascadeMode + TerminalMonitor + DestructiveCommandGate
 * Items #11, #12, #13 (Windsurf features)
 *
 * CascadeMode: Windsurf-style cascading multi-step planner that breaks a
 *   high-level task into sequential sub-steps, executes each with the
 *   appropriate tool, and surfaces a running plan the user can inspect.
 *
 * TerminalMonitor: Captures terminal output and command history, detects
 *   anomalies (build failures, test failures, unhandled errors), and emits
 *   structured events.
 *
 * DestructiveCommandGate: Intercepts risky CLI commands (rm -rf, DROP TABLE,
 *   git push --force, etc.) and requires explicit user confirmation before
 *   allowing execution.
 */

import { EventEmitter } from "events";

// ============================================================================
// CascadeMode (Item #11)
// ============================================================================

/** A single step in a cascade plan. */
export interface CascadeStep {
  /** Stable identifier for this step. */
  id: string;
  /** Human-readable description of what this step does. */
  label: string;
  /** The tool to call (MCP tool name or built-in action). */
  tool: string;
  /** Arguments to pass to the tool. */
  args: Record<string, unknown>;
  /** Status of this step. */
  status: "pending" | "running" | "done" | "failed" | "skipped";
  /** Result returned by the tool (if done). */
  result?: unknown;
  /** Error message (if failed). */
  error?: string;
  /** Duration in ms. */
  durationMs?: number;
  /** Whether this step can be skipped if a previous step fails. */
  optional?: boolean;
}

/** A cascade plan — an ordered list of steps for a high-level task. */
export interface CascadePlan {
  /** Unique plan identifier. */
  id: string;
  /** High-level goal description. */
  goal: string;
  /** Steps to execute in order. */
  steps: CascadeStep[];
  /** Overall status of the plan. */
  status: "pending" | "running" | "done" | "failed";
  /** Timestamp when the plan started. */
  startedAt?: number;
  /** Timestamp when the plan finished. */
  finishedAt?: number;
}

/** Tool executor function injected into CascadeMode. */
export type CascadeToolExecutor = (
  tool: string,
  args: Record<string, unknown>
) => Promise<unknown>;

/**
 * CascadeMode: Windsurf-style step-by-step task planner and executor.
 *
 * Usage:
 *   const cascade = new CascadeMode(myToolExecutor);
 *   const plan = cascade.plan("Add user auth to the API", [
 *     { label: "Scaffold auth module", tool: "filesystem", args: { ... } },
 *     { label: "Add JWT middleware", tool: "filesystem", args: { ... } },
 *   ]);
 *   cascade.on("step-done", (step) => console.log(step.label, "✓"));
 *   await cascade.execute(plan.id);
 */
export class CascadeMode extends EventEmitter {
  private plans: Map<string, CascadePlan> = new Map();
  private executor: CascadeToolExecutor;

  constructor(executor: CascadeToolExecutor) {
    super();
    this.executor = executor;
  }

  /**
   * Create a new cascade plan without executing it.
   */
  plan(
    goal: string,
    steps: Array<Omit<CascadeStep, "id" | "status">>
  ): CascadePlan {
    const id = `cascade-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const plan: CascadePlan = {
      id,
      goal,
      steps: steps.map((s, i) => ({
        id: `${id}-step-${i}`,
        status: "pending",
        ...s,
      })),
      status: "pending",
    };
    this.plans.set(id, plan);
    this.emit("plan-created", plan);
    return plan;
  }

  /**
   * Execute a plan step by step.
   *
   * Emits:
   *   - "step-start"  (step: CascadeStep)
   *   - "step-done"   (step: CascadeStep)
   *   - "step-error"  (step: CascadeStep)
   *   - "plan-done"   (plan: CascadePlan)
   *   - "plan-failed" (plan: CascadePlan, failedStep: CascadeStep)
   */
  async execute(planId: string): Promise<CascadePlan> {
    const plan = this.plans.get(planId);
    if (!plan) throw new Error(`No cascade plan with id: ${planId}`);
    if (plan.status === "running") throw new Error(`Plan ${planId} is already running`);

    plan.status = "running";
    plan.startedAt = Date.now();
    this.emit("plan-start", plan);

    for (const step of plan.steps) {
      step.status = "running";
      this.emit("step-start", step);

      const t0 = Date.now();
      try {
        step.result = await this.executor(step.tool, step.args);
        step.status = "done";
        step.durationMs = Date.now() - t0;
        this.emit("step-done", step);
      } catch (err) {
        step.status = "failed";
        step.error = err instanceof Error ? err.message : String(err);
        step.durationMs = Date.now() - t0;
        this.emit("step-error", step);

        if (!step.optional) {
          plan.status = "failed";
          plan.finishedAt = Date.now();
          this.emit("plan-failed", plan, step);
          return plan;
        }

        step.status = "skipped";
      }
    }

    plan.status = "done";
    plan.finishedAt = Date.now();
    this.emit("plan-done", plan);
    return plan;
  }

  /** Get a plan by ID. */
  getPlan(planId: string): CascadePlan | undefined {
    return this.plans.get(planId);
  }

  /** List all plans. */
  listPlans(): CascadePlan[] {
    return Array.from(this.plans.values());
  }

  /** Render a plan as a human-readable status board. */
  renderPlan(planId: string): string {
    const plan = this.plans.get(planId);
    if (!plan) return `[No plan: ${planId}]`;

    const icon = (s: CascadeStep["status"]) =>
      ({ pending: "○", running: "⟳", done: "✓", failed: "✗", skipped: "–" }[s] ?? "?");

    const lines = [`${plan.goal} [${plan.status}]`];
    for (const step of plan.steps) {
      lines.push(`  ${icon(step.status)} ${step.label}${step.durationMs != null ? ` (${step.durationMs}ms)` : ""}`);
      if (step.error) lines.push(`      ↳ ${step.error}`);
    }
    return lines.join("\n");
  }
}

// ============================================================================
// TerminalMonitor (Item #12)
// ============================================================================

/** A captured terminal command and its output. */
export interface TerminalRecord {
  /** Sequential ID. */
  id: number;
  /** Command that was run. */
  command: string;
  /** Combined stdout + stderr. */
  output: string;
  /** Exit code (0 = success). */
  exitCode: number;
  /** Start timestamp. */
  startedAt: number;
  /** Duration in ms. */
  durationMs: number;
  /** Anomalies detected in this record. */
  anomalies: TerminalAnomaly[];
}

/** An anomaly detected in terminal output. */
export interface TerminalAnomaly {
  type:
    | "build-failure"
    | "test-failure"
    | "unhandled-error"
    | "oom"
    | "timeout"
    | "permission-denied"
    | "missing-dependency"
    | "custom";
  message: string;
  /** Line in the output where the anomaly was detected. */
  lineNumber?: number;
}

const ANOMALY_PATTERNS: Array<{
  pattern: RegExp;
  type: TerminalAnomaly["type"];
}> = [
  { pattern: /error TS\d+:/i,                 type: "build-failure"      },
  { pattern: /SyntaxError:/i,                 type: "build-failure"      },
  { pattern: /\bBUILD FAILED\b/i,             type: "build-failure"      },
  { pattern: /\d+ failed/i,                   type: "test-failure"       },
  { pattern: /FAIL\s+\S+\.test\.[jt]s/,       type: "test-failure"       },
  { pattern: /UnhandledPromiseRejection/i,    type: "unhandled-error"    },
  { pattern: /FATAL ERROR.*heap/i,            type: "oom"                },
  { pattern: /Killed/,                        type: "oom"                },
  { pattern: /EACCES|Permission denied/i,     type: "permission-denied"  },
  { pattern: /Cannot find module/i,           type: "missing-dependency" },
  { pattern: /command not found/i,            type: "missing-dependency" },
];

/**
 * TerminalMonitor: Records terminal activity and detects anomalies.
 *
 * Usage:
 *   const mon = new TerminalMonitor();
 *   const record = mon.record("npm test", testOutput, 1, startTime, 4200);
 *   mon.on("anomaly", (record, anomaly) => { ... });
 */
export class TerminalMonitor extends EventEmitter {
  private records: TerminalRecord[] = [];
  private nextId = 1;
  private maxRecords: number;

  constructor(maxRecords = 500) {
    super();
    this.maxRecords = maxRecords;
  }

  /**
   * Record a completed terminal command and detect anomalies.
   *
   * @param command   The CLI command that ran.
   * @param output    Combined stdout + stderr.
   * @param exitCode  Exit code.
   * @param startedAt Start timestamp (ms).
   * @param durationMs Duration in ms.
   */
  record(
    command: string,
    output: string,
    exitCode: number,
    startedAt: number,
    durationMs: number
  ): TerminalRecord {
    const anomalies = this._detectAnomalies(output, exitCode);
    const record: TerminalRecord = {
      id: this.nextId++,
      command,
      output,
      exitCode,
      startedAt,
      durationMs,
      anomalies,
    };

    this.records.push(record);
    if (this.records.length > this.maxRecords) {
      this.records.shift();
    }

    this.emit("record", record);
    for (const anomaly of anomalies) {
      this.emit("anomaly", record, anomaly);
    }

    return record;
  }

  /** Get all records (most recent last). */
  getRecords(): TerminalRecord[] {
    return [...this.records];
  }

  /** Get the last N records. */
  recent(n = 10): TerminalRecord[] {
    return this.records.slice(-n);
  }

  /** Get all records with anomalies. */
  anomalousRecords(): TerminalRecord[] {
    return this.records.filter((r) => r.anomalies.length > 0);
  }

  /** Search records by command substring. */
  search(query: string): TerminalRecord[] {
    const q = query.toLowerCase();
    return this.records.filter(
      (r) =>
        r.command.toLowerCase().includes(q) ||
        r.output.toLowerCase().includes(q)
    );
  }

  /** Clear all records. */
  clear(): void {
    this.records = [];
    this.nextId = 1;
  }

  private _detectAnomalies(output: string, exitCode: number): TerminalAnomaly[] {
    const anomalies: TerminalAnomaly[] = [];
    const lines = output.split("\n");

    for (const { pattern, type } of ANOMALY_PATTERNS) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.test(lines[i])) {
          anomalies.push({
            type,
            message: lines[i].trim(),
            lineNumber: i + 1,
          });
          break; // One anomaly per pattern per record
        }
      }
    }

    // Non-zero exit with no other anomaly → generic error
    if (exitCode !== 0 && anomalies.length === 0) {
      anomalies.push({
        type: "unhandled-error",
        message: `Command exited with code ${exitCode}`,
      });
    }

    return anomalies;
  }
}

// ============================================================================
// DestructiveCommandGate (Item #13)
// ============================================================================

/** Result of a gate check. */
export interface GateCheckResult {
  /** Whether the command is considered safe to run immediately. */
  safe: boolean;
  /** The matched rule (undefined if safe). */
  rule?: DestructiveRule;
  /** Human-readable explanation of why the command was flagged. */
  reason?: string;
  /** Suggested safer alternative, if any. */
  alternative?: string;
}

/** A rule that flags a command as potentially destructive. */
export interface DestructiveRule {
  /** Rule identifier. */
  id: string;
  /** Pattern to match against the command string. */
  pattern: RegExp;
  /** Short description of the risk. */
  description: string;
  /** Severity: warn = ask user, block = deny unless overridden. */
  severity: "warn" | "block";
  /** Safer alternative command, if any. */
  alternative?: string;
}

const BUILTIN_RULES: DestructiveRule[] = [
  {
    id: "rm-rf",
    pattern: /\brm\s+(-\w*r\w*f\w*|-rf|-fr)\b/i,
    description: "Recursive force-delete",
    severity: "warn",
    alternative: "Use trash-cli or move to a temp dir instead",
  },
  {
    id: "git-push-force",
    pattern: /\bgit\s+push\b.*--force/i,
    description: "Force-push rewrites remote history",
    severity: "warn",
    alternative: "git push --force-with-lease",
  },
  {
    id: "drop-table",
    pattern: /DROP\s+TABLE/i,
    description: "Drops a database table (irreversible)",
    severity: "block",
  },
  {
    id: "truncate-table",
    pattern: /TRUNCATE\s+(TABLE\s+)?\S+/i,
    description: "Truncates a database table (data loss)",
    severity: "warn",
  },
  {
    id: "drop-database",
    pattern: /DROP\s+DATABASE/i,
    description: "Drops an entire database (irreversible)",
    severity: "block",
  },
  {
    id: "chmod-777",
    pattern: /\bchmod\s+(-R\s+)?777\b/i,
    description: "World-writable permissions (security risk)",
    severity: "warn",
    alternative: "chmod 755 for dirs, 644 for files",
  },
  {
    id: "format-disk",
    pattern: /\b(mkfs|format)\b/i,
    description: "Disk formatting (data loss)",
    severity: "block",
  },
  {
    id: "dd-of-dev",
    pattern: /\bdd\b.*of=\/dev\//i,
    description: "Writing to block device with dd (data loss)",
    severity: "block",
  },
  {
    id: "fork-bomb",
    pattern: /:\(\)\{.*\|.*:&\};:/,
    description: "Fork bomb pattern detected",
    severity: "block",
  },
  {
    id: "delete-all-pods",
    pattern: /kubectl\s+delete\s+(pod|pods|all)\s+--all/i,
    description: "Deletes all Kubernetes pods",
    severity: "warn",
  },
];

/**
 * DestructiveCommandGate: Screens CLI commands before execution.
 *
 * Usage:
 *   const gate = new DestructiveCommandGate();
 *   const check = gate.check("rm -rf node_modules");
 *   if (!check.safe) {
 *     const confirmed = await askUser(check.reason!);
 *     if (!confirmed) return;
 *   }
 *   // run the command
 */
export class DestructiveCommandGate {
  private rules: DestructiveRule[];
  private allowlist: Set<string> = new Set();

  /** @param extraRules Additional rules to append to the built-in set. */
  constructor(extraRules: DestructiveRule[] = []) {
    this.rules = [...BUILTIN_RULES, ...extraRules];
  }

  /**
   * Check a command string against all rules.
   *
   * @returns `{ safe: true }` if no rules matched,
   *          or `{ safe: false, rule, reason, alternative }` if a rule fired.
   */
  check(command: string): GateCheckResult {
    // Exact-match allowlist bypass
    if (this.allowlist.has(command.trim())) {
      return { safe: true };
    }

    for (const rule of this.rules) {
      if (rule.pattern.test(command)) {
        return {
          safe: false,
          rule,
          reason: `${rule.description} [${rule.severity}]`,
          alternative: rule.alternative,
        };
      }
    }

    return { safe: true };
  }

  /**
   * Add a specific command to the allowlist (bypass all rules).
   * Useful when the user has explicitly confirmed a command once.
   */
  allow(command: string): void {
    this.allowlist.add(command.trim());
  }

  /**
   * Remove a command from the allowlist.
   */
  revoke(command: string): void {
    this.allowlist.delete(command.trim());
  }

  /**
   * Add a custom rule at runtime.
   */
  addRule(rule: DestructiveRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove a rule by ID.
   */
  removeRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
  }

  /** List all active rules. */
  listRules(): DestructiveRule[] {
    return [...this.rules];
  }
}
