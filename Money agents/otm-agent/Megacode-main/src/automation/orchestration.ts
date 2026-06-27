/**
 * Automation & Orchestration for OverCoat.
 *
 * Implementation plan for automation and orchestration features:
 *
 * 1. Workflow Composer
 *    - Drag-and-drop to chain commands (TUI or GUI based)
 *    - Define workflows as directed acyclic graphs (DAGs)
 *    - Implementation: Workflow definition schema (YAML/JSON),
 *      DAG validation (cycle detection), step execution engine
 *      with dependency resolution, parallel branch execution,
 *      error handling (retry, skip, abort strategies)
 *
 * 2. Scheduled Tasks
 *    - Natural language scheduling: "backup DB every day at 3am"
 *    - Cron-compatible with human-readable descriptions
 *    - Implementation: Cron expression parser, in-process scheduler
 *      with setInterval/setTimeout, natural language → cron translation,
 *      persistent schedule storage, execution logging
 *
 * 3. Event-Driven Commands
 *    - "When file changes, run tests"
 *    - File system watchers, git hooks, and custom event triggers
 *    - Implementation: Event emitter with typed events,
 *      file watcher integration (fs.watch), git hook events,
 *      condition matching, debounce for rapid events
 *
 * 4. Multi-Server Orchestration
 *    - Control entire infrastructure from one CLI
 *    - SSH-based command execution across server groups
 *    - Implementation: Server inventory management, SSH connection
 *      pooling, parallel command execution, result aggregation,
 *      role-based server grouping
 */

import { EventEmitter } from "events";

/** A step in a workflow. */
export interface WorkflowStep {
  /** Unique step identifier. */
  id: string;
  /** Display name for the step. */
  name: string;
  /** The command to execute. */
  command: string;
  /** Steps that must complete before this one. */
  dependsOn: string[];
  /** Error handling strategy. */
  onError: "abort" | "retry" | "skip";
  /** Maximum retries if onError is "retry". */
  maxRetries: number;
  /** Timeout in milliseconds. */
  timeoutMs: number;
  /** Optional condition expression. */
  condition?: string;
}

/** A complete workflow definition. */
export interface Workflow {
  /** Workflow name. */
  name: string;
  /** Description. */
  description: string;
  /** Ordered steps (DAG). */
  steps: WorkflowStep[];
  /** When this workflow was created. */
  createdAt: number;
  /** Variables/parameters for the workflow. */
  variables: Record<string, string>;
}

/** Result of executing a workflow step. */
export interface StepResult {
  stepId: string;
  status: "success" | "failed" | "skipped" | "pending";
  output?: string;
  error?: string;
  durationMs: number;
  attempts: number;
}

/** Result of a full workflow execution. */
export interface WorkflowResult {
  workflowName: string;
  status: "completed" | "failed" | "partial";
  stepResults: StepResult[];
  totalDurationMs: number;
  startedAt: number;
  completedAt: number;
}

/** A scheduled task. */
export interface ScheduledTask {
  /** Unique task identifier. */
  id: string;
  /** Human-readable description. */
  description: string;
  /** The command to execute. */
  command: string;
  /** Cron expression (e.g., "0 3 * * *" for 3am daily). */
  cron: string;
  /** Whether the task is enabled. */
  enabled: boolean;
  /** Last execution time. */
  lastRun?: number;
  /** Next scheduled execution time. */
  nextRun?: number;
  /** How many times the task has run. */
  runCount: number;
}

/** An event trigger configuration. */
export interface EventTrigger {
  /** Unique trigger identifier. */
  id: string;
  /** Event type (e.g., "file-change", "git-push", "command-complete"). */
  event: string;
  /** Pattern to match (e.g., file glob, branch name). */
  pattern: string;
  /** The command to execute when triggered. */
  command: string;
  /** Debounce time in milliseconds. */
  debounceMs: number;
  /** Whether the trigger is enabled. */
  enabled: boolean;
}

/** A server in the orchestration inventory. */
export interface ServerNode {
  /** Server identifier. */
  id: string;
  /** Hostname or IP. */
  host: string;
  /** SSH port. */
  port: number;
  /** SSH user. */
  user: string;
  /** Server role/group (e.g., "web", "db", "worker"). */
  roles: string[];
  /** Whether the server is reachable. */
  online: boolean;
}

/** Result of a command on a remote server. */
export interface RemoteCommandResult {
  serverId: string;
  host: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * WorkflowEngine defines and executes multi-step workflow DAGs.
 */
export class WorkflowEngine {
  private workflows: Map<string, Workflow> = new Map();

  /** Register a workflow. */
  register(workflow: Workflow): void {
    this.workflows.set(workflow.name, workflow);
  }

  /** Get a workflow by name. */
  get(name: string): Workflow | null {
    return this.workflows.get(name) ?? null;
  }

  /** List all registered workflows. */
  list(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  /**
   * Validate a workflow DAG (check for cycles and missing deps).
   */
  validate(workflow: Workflow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const stepIds = new Set(workflow.steps.map((s) => s.id));

    // Check for missing dependencies
    for (const step of workflow.steps) {
      for (const dep of step.dependsOn) {
        if (!stepIds.has(dep)) {
          errors.push(
            `Step "${step.id}" depends on unknown step "${dep}"`
          );
        }
      }
    }

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (stepId: string): boolean => {
      visited.add(stepId);
      recursionStack.add(stepId);

      const step = workflow.steps.find((s) => s.id === stepId);
      if (step) {
        for (const dep of step.dependsOn) {
          if (!visited.has(dep) && hasCycle(dep)) return true;
          if (recursionStack.has(dep)) return true;
        }
      }

      recursionStack.delete(stepId);
      return false;
    };

    for (const step of workflow.steps) {
      if (!visited.has(step.id) && hasCycle(step.id)) {
        errors.push("Workflow contains a dependency cycle");
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get execution order (topological sort) for a workflow.
   */
  getExecutionOrder(workflow: Workflow): string[] {
    const order: string[] = [];
    const visited = new Set<string>();
    const stepMap = new Map(workflow.steps.map((s) => [s.id, s]));

    const visit = (stepId: string) => {
      if (visited.has(stepId)) return;
      visited.add(stepId);
      const step = stepMap.get(stepId);
      if (step) {
        for (const dep of step.dependsOn) {
          visit(dep);
        }
      }
      order.push(stepId);
    };

    for (const step of workflow.steps) {
      visit(step.id);
    }

    return order;
  }

  /** Delete a workflow. */
  delete(name: string): boolean {
    return this.workflows.delete(name);
  }
}

/**
 * TaskScheduler manages cron-based scheduled tasks.
 */
export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private executionHandler: ((task: ScheduledTask) => void) | null = null;

  /** Register a scheduled task. */
  addTask(task: ScheduledTask): void {
    this.tasks.set(task.id, task);
  }

  /** Remove a scheduled task. */
  removeTask(id: string): boolean {
    this.stopTask(id);
    return this.tasks.delete(id);
  }

  /** Start a task's scheduler (simplified interval-based). */
  startTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task || !task.enabled) return;

    // Parse simple cron intervals (simplified: use interval in ms)
    const intervalMs = this.cronToIntervalMs(task.cron);
    if (intervalMs <= 0) return;

    const timer = setInterval(() => {
      task.lastRun = Date.now();
      task.runCount++;
      task.nextRun = Date.now() + intervalMs;
      if (this.executionHandler) {
        this.executionHandler(task);
      }
    }, intervalMs);

    this.timers.set(id, timer);
    task.nextRun = Date.now() + intervalMs;
  }

  /** Stop a task's scheduler. */
  stopTask(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
  }

  /** Stop all scheduled tasks. */
  stopAll(): void {
    for (const id of this.timers.keys()) {
      this.stopTask(id);
    }
  }

  /** Set the handler called when a task fires. */
  onExecute(handler: (task: ScheduledTask) => void): void {
    this.executionHandler = handler;
  }

  /** List all tasks. */
  listTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Simplified cron-to-interval converter.
   * Supports basic patterns like "every X minutes/hours".
   */
  private cronToIntervalMs(cron: string): number {
    // Match "every N minutes" or "every N hours" style
    const minuteMatch = cron.match(/\*\/(\d+)\s+\*/);
    if (minuteMatch) {
      return parseInt(minuteMatch[1], 10) * 60 * 1000;
    }
    // Default: hourly
    return 60 * 60 * 1000;
  }
}

/**
 * EventEngine manages event-driven command triggers.
 */
export class EventEngine extends EventEmitter {
  private triggers: Map<string, EventTrigger> = new Map();
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Register an event trigger. */
  addTrigger(trigger: EventTrigger): void {
    this.triggers.set(trigger.id, trigger);
  }

  /** Remove a trigger. */
  removeTrigger(id: string): boolean {
    return this.triggers.delete(id);
  }

  /**
   * Fire an event and execute matching triggers.
   */
  fireEvent(
    event: string,
    data: { path?: string; [key: string]: unknown }
  ): void {
    for (const trigger of this.triggers.values()) {
      if (!trigger.enabled || trigger.event !== event) continue;

      // Pattern matching
      if (trigger.pattern && data.path) {
        if (!this.matchPattern(String(data.path), trigger.pattern)) continue;
      }

      // Debounce handling
      if (trigger.debounceMs > 0) {
        const existingTimer = this.debounceTimers.get(trigger.id);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }
        const timer = setTimeout(() => {
          this.emit("trigger-fire", { trigger, data });
          this.debounceTimers.delete(trigger.id);
        }, trigger.debounceMs);
        this.debounceTimers.set(trigger.id, timer);
      } else {
        this.emit("trigger-fire", { trigger, data });
      }
    }
  }

  /** List all triggers. */
  listTriggers(): EventTrigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Safe glob-like pattern matching.
   *
   * Splits the pattern on glob tokens (`**` and `*`), escapes every
   * literal segment so no user-controlled characters reach the regex
   * engine, then reassembles the regex. This prevents both regex
   * injection and ReDoS.
   */
  private matchPattern(path: string, pattern: string): boolean {
    // Split on ** first (greedy across directories), then * (single segment).
    // We use a sentinel split approach: replace known tokens with unique
    // markers, escape everything else, then restore tokens as regex.
    const GLOBSTAR = "\0GLOBSTAR\0";
    const WILDCARD = "\0WILDCARD\0";

    // Preserve ** before * so "**" isn't consumed as two single "*"
    let work = pattern.replace(/\*\*/g, GLOBSTAR);
    work = work.replace(/\*/g, WILDCARD);

    // Split on sentinels, keeping them in the result
    const parts = work.split(/(\0GLOBSTAR\0|\0WILDCARD\0)/);

    let regexStr = "^";
    for (const part of parts) {
      if (part === GLOBSTAR) {
        regexStr += ".*";
      } else if (part === WILDCARD) {
        regexStr += "[^/]*";
      } else {
        // Escape all regex-special characters in literal segments
        regexStr += part.replace(/[\\^$.|?+()[\]{}]/g, "\\$&");
      }
    }
    regexStr += "$";

    return new RegExp(regexStr).test(path);
  }
}

/**
 * ServerInventory manages a collection of servers for orchestration.
 */
export class ServerInventory {
  private servers: Map<string, ServerNode> = new Map();

  /** Add a server to the inventory. */
  addServer(server: ServerNode): void {
    this.servers.set(server.id, server);
  }

  /** Remove a server. */
  removeServer(id: string): boolean {
    return this.servers.delete(id);
  }

  /** Get servers by role. */
  getByRole(role: string): ServerNode[] {
    return Array.from(this.servers.values()).filter((s) =>
      s.roles.includes(role)
    );
  }

  /** Get all servers. */
  getAll(): ServerNode[] {
    return Array.from(this.servers.values());
  }

  /** Get a server by ID. */
  getServer(id: string): ServerNode | null {
    return this.servers.get(id) ?? null;
  }

  /** Update server online status. */
  setOnline(id: string, online: boolean): void {
    const server = this.servers.get(id);
    if (server) {
      server.online = online;
    }
  }
}
