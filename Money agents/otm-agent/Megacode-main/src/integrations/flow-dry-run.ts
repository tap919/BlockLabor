/**
 * Flow Dry-Run and Session Replay for Megacode (OverCoat).
 *
 * FlowDryRun (#41) — Validates a flow plan without executing any real tool
 * calls. Detects missing server references, bad step ordering, circular
 * dependencies, and unsatisfied conditions before expensive I/O begins.
 *
 * SessionReplay (#32) — Records every tool call result emitted during a real
 * flow execution and can play it back deterministically for debugging,
 * testing, or UX demos.
 */

import type { FlowStep, FlowContext, ToolCallResult } from "./mcp-flow-coordinator";

// ============================================================================
// FlowDryRun (#41)
// ============================================================================

export interface DryRunIssue {
  stepId: string;
  severity: "error" | "warning";
  message: string;
}

export interface DryRunReport {
  valid: boolean;
  issues: DryRunIssue[];
  /** Resolved execution order (topological sort of the DAG). */
  executionOrder: string[];
  /** Steps that can run in parallel (same depth level). */
  parallelGroups: string[][];
}

/**
 * Validates a flow plan without issuing any real tool calls.
 *
 * Checks:
 * - All `dependsOn` step IDs actually exist in the flow.
 * - No circular dependency chains.
 * - All parallel fan-out arrays are non-empty.
 * - Condition and transform steps have their functions attached.
 */
export class FlowDryRun {
  /**
   * Run a dry-run validation of the given flow steps.
   *
   * @param steps The flow steps to validate.
   * @param knownServerIds Optional set of registered MCP server IDs; if
   *   provided, any step that references an unknown server ID is flagged.
   */
  validate(steps: FlowStep[], knownServerIds?: Set<string>): DryRunReport {
    const issues: DryRunIssue[] = [];
    const stepIds = new Set(steps.map(s => s.id));

    for (const step of steps) {
      // Check dependsOn references
      for (const dep of step.dependsOn ?? []) {
        if (!stepIds.has(dep)) {
          issues.push({
            stepId: step.id,
            severity: "error",
            message: `dependsOn references unknown step "${dep}"`,
          });
        }
      }

      // Check call steps
      if (step.type === "call") {
        if (!step.call) {
          issues.push({
            stepId: step.id,
            severity: "error",
            message: `Step type is "call" but no call definition provided`,
          });
        } else if (knownServerIds && !knownServerIds.has(step.call.serverId)) {
          issues.push({
            stepId: step.id,
            severity: "warning",
            message: `Server "${step.call.serverId}" is not in the registered server list`,
          });
        }
      }

      // Check parallel steps
      if (step.type === "parallel") {
        if (!step.parallel || step.parallel.length === 0) {
          issues.push({
            stepId: step.id,
            severity: "error",
            message: `Step type is "parallel" but parallel array is empty`,
          });
        } else if (knownServerIds) {
          for (const call of step.parallel) {
            if (!knownServerIds.has(call.serverId)) {
              issues.push({
                stepId: step.id,
                severity: "warning",
                message: `Parallel call references unknown server "${call.serverId}"`,
              });
            }
          }
        }
      }

      // Check transform steps
      if (step.type === "transform" && typeof step.transform !== "function") {
        issues.push({
          stepId: step.id,
          severity: "error",
          message: `Step type is "transform" but no transform function provided`,
        });
      }

      // Check condition steps
      if (step.type === "condition" && typeof step.condition !== "function") {
        issues.push({
          stepId: step.id,
          severity: "error",
          message: `Step type is "condition" but no condition function provided`,
        });
      }
    }

    // Topological sort & cycle detection
    const { order, cycles, parallelGroups } = this._topoSort(steps);

    for (const cycle of cycles) {
      issues.push({
        stepId: cycle[0],
        severity: "error",
        message: `Circular dependency detected: ${cycle.join(" → ")}`,
      });
    }

    return {
      valid: issues.filter(i => i.severity === "error").length === 0,
      issues,
      executionOrder: order,
      parallelGroups,
    };
  }

  /** Kahn's algorithm — returns topological order and any cycles found. */
  private _topoSort(steps: FlowStep[]): {
    order: string[];
    cycles: string[][];
    parallelGroups: string[][];
  } {
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // id → ids that depend on it

    for (const s of steps) {
      inDegree.set(s.id, inDegree.get(s.id) ?? 0);
      for (const dep of s.dependsOn ?? []) {
        if (!dependents.has(dep)) dependents.set(dep, []);
        dependents.get(dep)!.push(s.id);
        inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1);
      }
    }

    const order: string[] = [];
    const parallelGroups: string[][] = [];
    let frontier = steps.filter(s => (inDegree.get(s.id) ?? 0) === 0).map(s => s.id);

    while (frontier.length > 0) {
      parallelGroups.push([...frontier]);
      order.push(...frontier);
      const next: string[] = [];
      for (const id of frontier) {
        for (const dep of dependents.get(id) ?? []) {
          const deg = (inDegree.get(dep) ?? 1) - 1;
          inDegree.set(dep, deg);
          if (deg === 0) next.push(dep);
        }
      }
      frontier = next;
    }

    // Any node still with inDegree > 0 is in a cycle
    const cycles: string[][] = [];
    const remaining = steps.filter(s => (inDegree.get(s.id) ?? 0) > 0);
    if (remaining.length > 0) {
      cycles.push(remaining.map(s => s.id));
    }

    return { order, cycles, parallelGroups };
  }
}

// ============================================================================
// SessionReplay (#32)
// ============================================================================

export interface ReplayEvent {
  stepId: string;
  tool: string;
  serverId: string;
  result: ToolCallResult;
  timestamp: number;
}

export interface ReplaySession {
  id: string;
  flowId: string;
  startedAt: number;
  endedAt: number;
  events: ReplayEvent[];
  /** Final context variables snapshot. */
  variables: Record<string, unknown>;
}

export interface ReplayOptions {
  /** Artificial delay between replayed events in ms (0 = no delay). */
  delayMs?: number;
  /** Callback fired for each replayed event. */
  onEvent?: (event: ReplayEvent, index: number, total: number) => void;
}

/**
 * Records tool call results during a flow execution and can replay them.
 *
 * Usage:
 * 1. Create a `SessionReplay` instance.
 * 2. During a real flow, call `record()` for each `ToolCallResult`.
 * 3. Call `finalize()` when the flow ends.
 * 4. Store the session with `export()`.
 * 5. Later, call `replay()` to iterate over events deterministically.
 */
export class SessionReplay {
  private sessions = new Map<string, ReplaySession>();
  private active = new Map<string, { flowId: string; events: ReplayEvent[]; startedAt: number }>();

  /** Begin recording a new session for the given flow. Returns session ID. */
  beginRecording(flowId: string): string {
    const sessionId = `replay-${flowId}-${Date.now()}`;
    this.active.set(sessionId, { flowId, events: [], startedAt: Date.now() });
    return sessionId;
  }

  /** Record one tool call result against an active session. */
  record(sessionId: string, stepId: string, result: ToolCallResult): void {
    const session = this.active.get(sessionId);
    if (!session) return;

    session.events.push({
      stepId,
      tool: result.tool,
      serverId: result.serverId,
      result,
      timestamp: Date.now(),
    });
  }

  /** Finalize and store the session. */
  finalize(sessionId: string, context?: FlowContext): ReplaySession {
    const active = this.active.get(sessionId);
    if (!active) {
      throw new Error(`No active recording session: ${sessionId}`);
    }

    const session: ReplaySession = {
      id: sessionId,
      flowId: active.flowId,
      startedAt: active.startedAt,
      endedAt: Date.now(),
      events: active.events,
      variables: context ? { ...context.variables } : {},
    };

    this.sessions.set(sessionId, session);
    this.active.delete(sessionId);
    return session;
  }

  /** Load a previously exported session for replay. */
  import(session: ReplaySession): void {
    this.sessions.set(session.id, session);
  }

  /** Export a session to a plain JSON-serialisable object. */
  export(sessionId: string): ReplaySession | undefined {
    return this.sessions.get(sessionId);
  }

  /** Export all sessions. */
  exportAll(): ReplaySession[] {
    return Array.from(this.sessions.values());
  }

  /** List stored session IDs. */
  listSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Replay a stored session, firing `onEvent` for each recorded event.
   * Returns the reconstructed FlowContext variables.
   */
  async replay(
    sessionId: string,
    options: ReplayOptions = {}
  ): Promise<{ variables: Record<string, unknown>; events: ReplayEvent[] }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const { delayMs = 0, onEvent } = options;
    const replayed: ReplayEvent[] = [];

    for (let i = 0; i < session.events.length; i++) {
      const event = session.events[i];
      replayed.push(event);

      if (onEvent) {
        onEvent(event, i, session.events.length);
      }

      if (delayMs > 0) {
        await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { variables: session.variables, events: replayed };
  }

  /** Delete a stored session. */
  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }
}
