/**
 * SubAgentSpawner — Item #24 (Claude Code skill)
 *
 * Spawns and manages lightweight "sub-agents": named, isolated task runners
 * that execute a sequence of tool calls or LLM completions in parallel or in
 * series. Each sub-agent has its own context, result store, and lifecycle.
 *
 * Mirrors Claude Code's Task tool / sub-agent pattern and Windsurf's
 * parallel flow execution.
 */

import { EventEmitter } from "events";

// ============================================================================
// Types
// ============================================================================

/** A task that a sub-agent should execute. */
export interface AgentTask {
  /** Human-readable description. */
  description: string;
  /**
   * The actual work to perform. Receives the agent's context and should
   * return a result (any serialisable value).
   */
  run: (ctx: AgentContext) => Promise<unknown>;
}

/** Mutable context passed to every AgentTask. */
export interface AgentContext {
  /** Agent name. */
  agentName: string;
  /** Arbitrary shared state — tasks can read/write here. */
  state: Record<string, unknown>;
  /** Append a log line to the agent's output. */
  log: (msg: string) => void;
  /** Report incremental progress (0–100). */
  progress: (pct: number) => void;
}

/** The full record of a spawned sub-agent. */
export interface SubAgent {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Current lifecycle state. */
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  /** Tasks assigned to this agent. */
  tasks: AgentTask[];
  /** Results indexed by task position. */
  results: unknown[];
  /** Log lines emitted during execution. */
  logs: string[];
  /** Shared state bag. */
  state: Record<string, unknown>;
  /** Progress (0–100). */
  progress: number;
  /** Error (if failed). */
  error?: string;
  /** Start timestamp. */
  startedAt?: number;
  /** Finish timestamp. */
  finishedAt?: number;
}

// ============================================================================
// SubAgentSpawner (Item #24)
// ============================================================================

/**
 * SubAgentSpawner: Create, run, and monitor isolated sub-agents.
 *
 * Usage:
 *   const spawner = new SubAgentSpawner();
 *
 *   const agent = spawner.spawn("refactor-module", [
 *     { description: "Analyse file", run: async (ctx) => { ctx.log("analysing..."); return analysis; } },
 *     { description: "Apply changes", run: async (ctx) => { ... } },
 *   ]);
 *
 *   spawner.on("agent-done", (agent) => console.log(agent.results));
 *   await spawner.run(agent.id);
 *
 * To run multiple agents in parallel:
 *   await spawner.runAll([id1, id2, id3]);
 */
export class SubAgentSpawner extends EventEmitter {
  private agents: Map<string, SubAgent> = new Map();
  private nextId = 1;

  // --------------------------------------------------------------------------
  // Spawning
  // --------------------------------------------------------------------------

  /**
   * Spawn a new sub-agent with the given tasks.
   *
   * @param name  Human-readable agent name.
   * @param tasks Ordered list of tasks to execute.
   * @returns     The newly created (not yet running) SubAgent.
   */
  spawn(name: string, tasks: AgentTask[]): SubAgent {
    const id = `agent-${this.nextId++}-${Date.now().toString(36)}`;
    const agent: SubAgent = {
      id,
      name,
      status: "pending",
      tasks,
      results: [],
      logs: [],
      state: {},
      progress: 0,
    };
    this.agents.set(id, agent);
    this.emit("agent-spawned", agent);
    return agent;
  }

  // --------------------------------------------------------------------------
  // Execution
  // --------------------------------------------------------------------------

  /**
   * Run a single agent to completion.
   *
   * Emits:
   *   - "agent-start"   (agent)
   *   - "task-start"    (agent, taskIndex, task)
   *   - "agent-log"     (agent, message)
   *   - "agent-progress"(agent, percent)
   *   - "task-done"     (agent, taskIndex, result)
   *   - "task-error"    (agent, taskIndex, error)
   *   - "agent-done"    (agent)
   *   - "agent-failed"  (agent)
   */
  async run(agentId: string): Promise<SubAgent> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`No sub-agent with id: ${agentId}`);
    if (agent.status === "running") throw new Error(`Agent ${agentId} is already running`);
    if (agent.status === "cancelled") throw new Error(`Agent ${agentId} was cancelled`);

    agent.status = "running";
    agent.startedAt = Date.now();
    this.emit("agent-start", agent);

    const ctx: AgentContext = {
      agentName: agent.name,
      state: agent.state,
      log: (msg: string) => {
        agent.logs.push(msg);
        this.emit("agent-log", agent, msg);
      },
      progress: (pct: number) => {
        agent.progress = Math.max(0, Math.min(100, pct));
        this.emit("agent-progress", agent, agent.progress);
      },
    };

    for (let i = 0; i < agent.tasks.length; i++) {
      // status may be mutated externally by cancel(), so read via indirection
      if ((agent.status as string) === "cancelled") break;

      const task = agent.tasks[i];
      this.emit("task-start", agent, i, task);

      try {
        const result = await task.run(ctx);
        agent.results[i] = result;
        agent.progress = Math.round(((i + 1) / agent.tasks.length) * 100);
        this.emit("task-done", agent, i, result);
      } catch (err) {
        agent.status = "failed";
        agent.error = err instanceof Error ? err.message : String(err);
        agent.finishedAt = Date.now();
        this.emit("task-error", agent, i, err);
        this.emit("agent-failed", agent);
        return agent;
      }
    }

    if ((agent.status as string) !== "cancelled") {
      agent.status = "done";
      agent.progress = 100;
    }
    agent.finishedAt = Date.now();
    this.emit("agent-done", agent);
    return agent;
  }

  /**
   * Run multiple agents in parallel.
   *
   * @param agentIds  IDs to run (default: all pending agents).
   */
  async runAll(agentIds?: string[]): Promise<SubAgent[]> {
    const ids = agentIds ?? Array.from(this.agents.keys());
    const toRun = ids.filter((id) => {
      const a = this.agents.get(id);
      return a && a.status === "pending";
    });

    return Promise.all(toRun.map((id) => this.run(id)));
  }

  /**
   * Run agents sequentially (one after another).
   */
  async runSequential(agentIds?: string[]): Promise<SubAgent[]> {
    const ids = agentIds ?? Array.from(this.agents.keys());
    const results: SubAgent[] = [];
    for (const id of ids) {
      const a = this.agents.get(id);
      if (a && a.status === "pending") {
        results.push(await this.run(id));
      }
    }
    return results;
  }

  // --------------------------------------------------------------------------
  // Control
  // --------------------------------------------------------------------------

  /**
   * Cancel an agent (if it hasn't started yet or is currently running).
   */
  cancel(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent || agent.status === "done" || agent.status === "failed") return false;
    agent.status = "cancelled";
    agent.finishedAt = Date.now();
    this.emit("agent-cancelled", agent);
    return true;
  }

  // --------------------------------------------------------------------------
  // Introspection
  // --------------------------------------------------------------------------

  /** Get a sub-agent by ID. */
  get(agentId: string): SubAgent | undefined {
    return this.agents.get(agentId);
  }

  /** List all agents. */
  list(): SubAgent[] {
    return Array.from(this.agents.values());
  }

  /** List agents by status. */
  byStatus(status: SubAgent["status"]): SubAgent[] {
    return this.list().filter((a) => a.status === status);
  }

  /** Clear completed/failed/cancelled agents from memory. */
  cleanup(): number {
    let count = 0;
    for (const [id, agent] of this.agents) {
      if (agent.status !== "running" && agent.status !== "pending") {
        this.agents.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Get a formatted status summary. */
  summary(): string {
    const agents = this.list();
    const byStatus: Record<string, number> = {};
    for (const a of agents) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
    }
    return `SubAgents: ${agents.length} total | ${Object.entries(byStatus)
      .map(([k, v]) => `${v} ${k}`)
      .join(", ")}`;
  }
}
