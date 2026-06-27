/**
 * Remote & Distributed for OverCoat.
 *
 * Implementation plan for remote and distributed features:
 *
 * 1. Distributed Computing
 *    - "Run this on all servers" with live aggregation
 *    - Fan-out command execution across multiple hosts
 *    - Implementation: Server group management, SSH/WS connection pool,
 *      parallel command dispatch, result aggregation with progress,
 *      live streaming of output from all hosts
 *
 * 2. Remote Tunnels
 *    - Secure access to remote environments
 *    - Port forwarding and reverse tunnels
 *    - Implementation: SSH tunnel management, port allocation,
 *      tunnel health monitoring, auto-reconnect on failure,
 *      tunnel lifecycle management (create/list/close)
 *
 * 3. Edge Computing
 *    - Deploy and monitor edge functions
 *    - Manage serverless/edge function deployments
 *    - Implementation: Provider adapters (Cloudflare Workers, Lambda@Edge,
 *      Deno Deploy), deploy pipeline, log streaming,
 *      metrics collection from edge locations
 *
 * 4. Offline-First
 *    - Full functionality without internet
 *    - Queue operations when offline, sync when reconnected
 *    - Implementation: Online/offline state detection, operation queue
 *      with persistence, sync engine for reconnection,
 *      local LLM fallback (Ollama), cache-first responses
 */

import { EventEmitter } from "events";
import path from "path";

/** A remote host for distributed operations. */
export interface RemoteHost {
  /** Host identifier. */
  id: string;
  /** Hostname or IP address. */
  hostname: string;
  /** SSH port (default: 22). */
  port: number;
  /** SSH user. */
  user: string;
  /** Connection status. */
  status: "connected" | "disconnected" | "error";
  /** Host tags/labels for grouping. */
  tags: string[];
  /** Last seen timestamp. */
  lastSeen: number;
}

/** Result from a distributed command execution on a single host. */
export interface HostResult {
  hostId: string;
  hostname: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timestamp: number;
}

/** Aggregated result from distributed command execution. */
export interface DistributedResult {
  /** The command that was executed. */
  command: string;
  /** Results from each host. */
  results: HostResult[];
  /** Number of hosts that succeeded. */
  successCount: number;
  /** Number of hosts that failed. */
  failureCount: number;
  /** Total execution duration. */
  totalDurationMs: number;
}

/** A remote tunnel configuration. */
export interface TunnelConfig {
  /** Tunnel identifier. */
  id: string;
  /** Tunnel type. */
  type: "local" | "remote" | "dynamic";
  /** Local port. */
  localPort: number;
  /** Remote host. */
  remoteHost: string;
  /** Remote port. */
  remotePort: number;
  /** Jump host for the tunnel. */
  jumpHost?: string;
  /** Whether the tunnel is active. */
  active: boolean;
  /** Created timestamp. */
  createdAt: number;
}

/** Edge function deployment. */
export interface EdgeDeployment {
  /** Deployment identifier. */
  id: string;
  /** Function name. */
  functionName: string;
  /** Provider (e.g., "cloudflare", "lambda-edge", "deno-deploy"). */
  provider: string;
  /** Deployment status. */
  status: "deploying" | "active" | "failed" | "inactive";
  /** URL of the deployed function. */
  url?: string;
  /** Deployment regions/locations. */
  regions: string[];
  /** When the deployment was created. */
  deployedAt: number;
}

/** A queued operation for offline mode. */
export interface QueuedOperation {
  /** Operation identifier. */
  id: string;
  /** The operation type. */
  type: string;
  /** Operation payload. */
  payload: Record<string, unknown>;
  /** When the operation was queued. */
  queuedAt: number;
  /** Number of sync attempts. */
  attempts: number;
  /** Status. */
  status: "pending" | "syncing" | "synced" | "failed";
}

/** Git worktree configuration for isolated task execution. */
export interface WorktreeConfig {
  /** Worktree identifier. */
  id: string;
  /** Path to the worktree directory. */
  path: string;
  /** Branch name in the worktree. */
  branch: string;
  /** Parent repository path. */
  parentRepo: string;
  /** Whether the worktree is currently active. */
  active: boolean;
  /** When the worktree was created. */
  createdAt: number;
  /** Optional task/agent associated with this worktree. */
  taskId?: string;
}

/**
 * HostManager manages remote hosts for distributed operations.
 */
export class HostManager extends EventEmitter {
  private hosts: Map<string, RemoteHost> = new Map();

  /** Add a remote host. */
  addHost(host: RemoteHost): void {
    this.hosts.set(host.id, host);
  }

  /** Remove a host. */
  removeHost(id: string): boolean {
    return this.hosts.delete(id);
  }

  /** Get all hosts. */
  getAll(): RemoteHost[] {
    return Array.from(this.hosts.values());
  }

  /** Get hosts by tag. */
  getByTag(tag: string): RemoteHost[] {
    return Array.from(this.hosts.values()).filter((h) =>
      h.tags.includes(tag)
    );
  }

  /** Get connected hosts. */
  getConnected(): RemoteHost[] {
    return Array.from(this.hosts.values()).filter(
      (h) => h.status === "connected"
    );
  }

  /** Update host status. */
  updateStatus(id: string, status: RemoteHost["status"]): void {
    const host = this.hosts.get(id);
    if (host) {
      host.status = status;
      host.lastSeen = Date.now();
      this.emit("status-change", { host, status });
    }
  }

  /** Get a single host by ID. */
  getHost(id: string): RemoteHost | null {
    return this.hosts.get(id) ?? null;
  }
}

/**
 * TunnelManager manages SSH tunnels for remote access.
 */
export class TunnelManager {
  private tunnels: Map<string, TunnelConfig> = new Map();

  /** Create a tunnel configuration. */
  create(config: Omit<TunnelConfig, "id" | "createdAt" | "active">): TunnelConfig {
    const tunnel: TunnelConfig = {
      ...config,
      id: `tunnel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      active: false,
      createdAt: Date.now(),
    };
    this.tunnels.set(tunnel.id, tunnel);
    return tunnel;
  }

  /** Activate a tunnel. */
  activate(id: string): boolean {
    const tunnel = this.tunnels.get(id);
    if (tunnel) {
      tunnel.active = true;
      return true;
    }
    return false;
  }

  /** Deactivate a tunnel. */
  deactivate(id: string): boolean {
    const tunnel = this.tunnels.get(id);
    if (tunnel) {
      tunnel.active = false;
      return true;
    }
    return false;
  }

  /** List all tunnels. */
  list(): TunnelConfig[] {
    return Array.from(this.tunnels.values());
  }

  /** List active tunnels. */
  listActive(): TunnelConfig[] {
    return Array.from(this.tunnels.values()).filter((t) => t.active);
  }

  /** Remove a tunnel. */
  remove(id: string): boolean {
    return this.tunnels.delete(id);
  }
}

/**
 * OfflineQueue manages operations that are queued when offline
 * and synced when connectivity is restored.
 */
export class OfflineQueue extends EventEmitter {
  private queue: QueuedOperation[] = [];
  private online: boolean = true;

  /** Check if currently online. */
  isOnline(): boolean {
    return this.online;
  }

  /** Set online/offline status. */
  setOnline(online: boolean): void {
    const wasOffline = !this.online;
    this.online = online;
    if (online && wasOffline) {
      this.emit("reconnected");
    } else if (!online) {
      this.emit("disconnected");
    }
  }

  /**
   * Enqueue an operation for later sync.
   */
  enqueue(type: string, payload: Record<string, unknown>): QueuedOperation {
    const operation: QueuedOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type,
      payload,
      queuedAt: Date.now(),
      attempts: 0,
      status: "pending",
    };
    this.queue.push(operation);
    return operation;
  }

  /** Get all pending operations. */
  getPending(): QueuedOperation[] {
    return this.queue.filter((op) => op.status === "pending");
  }

  /** Get the full queue. */
  getAll(): QueuedOperation[] {
    return [...this.queue];
  }

  /** Mark an operation as synced. */
  markSynced(id: string): void {
    const op = this.queue.find((o) => o.id === id);
    if (op) {
      op.status = "synced";
    }
  }

  /** Mark an operation as failed. */
  markFailed(id: string): void {
    const op = this.queue.find((o) => o.id === id);
    if (op) {
      op.status = "failed";
      op.attempts++;
    }
  }

  /** Clear synced operations from the queue. */
  clearSynced(): void {
    this.queue = this.queue.filter((op) => op.status !== "synced");
  }

  /** Get count of pending operations. */
  getPendingCount(): number {
    return this.queue.filter((op) => op.status === "pending").length;
  }
}

// ── Distributed Computing ──────────────────────────────────────────────────

/** Callback invoked when a single host completes its command. */
export type HostResultCallback = (result: HostResult) => void;

/**
 * Executor function that runs a shell command on a single remote host.
 * Callers supply this when creating a DistributedCommandRunner so that
 * OverCoat stays dependency-free with respect to SSH transport.
 */
export type HostExecutor = (
  host: RemoteHost,
  command: string,
) => Promise<Pick<HostResult, "exitCode" | "stdout" | "stderr">>;

/**
 * DistributedCommandRunner fans a command out across multiple hosts and
 * aggregates the results.  Because OverCoat does not bundle an SSH client,
 * callers use {@link DistributedCommandRunner.setExecutor} to supply a
 * {@link HostExecutor} that performs the actual connection and execution.
 * This design keeps the runner dependency-free while still providing
 * orchestration, progress tracking, and result aggregation.
 *
 * @example
 * ```ts
 * const runner = new DistributedCommandRunner(hostManager);
 *
 * // Provide a custom SSH executor (e.g., using node-ssh or ssh2)
 * runner.setExecutor(async (host, command) => {
 *   const ssh = await openSshConnection(host);
 *   return ssh.execCommand(command);
 * });
 *
 * const result = await runner.run("uptime", { tags: ["web"] });
 * console.log(`${result.successCount}/${result.results.length} hosts OK`);
 * ```
 */
export class DistributedCommandRunner extends EventEmitter {
  private hostManager: HostManager;
  private executor: HostExecutor | null = null;

  constructor(hostManager: HostManager) {
    super();
    this.hostManager = hostManager;
  }

  /**
   * Register the executor function that runs a command on a single host.
   * The executor should return `{ exitCode, stdout, stderr }`.
   */
  setExecutor(fn: HostExecutor): void {
    this.executor = fn;
  }

  /**
   * Run a command across all connected hosts (or a subset filtered by tag).
   *
   * @param command  Shell command to execute on each host.
   * @param options  Optional filters, callbacks, and concurrency limit.
   * @returns Aggregated result including per-host output.
   */
  async run(
    command: string,
    options: {
      /** Filter to hosts with this tag. */
      tags?: string[];
      /** Called as each host finishes. */
      onHostResult?: HostResultCallback;
      /**
       * Maximum number of hosts to execute against concurrently.
       * Must be a positive integer. Values less than 1 are treated as
       * unlimited (all hosts run in parallel).
       * Set this to a small number (e.g. 10) when targeting large fleets
       * to avoid overwhelming the local process or target infrastructure.
       */
      maxConcurrency?: number;
    } = {},
  ): Promise<DistributedResult> {
    const hosts =
      options.tags && options.tags.length > 0
        ? this.hostManager
            .getConnected()
            .filter((h) => options.tags!.some((t) => h.tags.includes(t)))
        : this.hostManager.getConnected();

    if (hosts.length === 0) {
      return {
        command,
        results: [],
        successCount: 0,
        failureCount: 0,
        totalDurationMs: 0,
      };
    }

    const startTime = Date.now();

    const runOnHost = async (host: RemoteHost): Promise<HostResult> => {
      const hostStart = Date.now();
      let result: HostResult;

      if (this.executor) {
        try {
          const outcome = await this.executor(host, command);
          result = {
            hostId: host.id,
            hostname: host.hostname,
            exitCode: outcome.exitCode,
            stdout: outcome.stdout,
            stderr: outcome.stderr,
            durationMs: Date.now() - hostStart,
            timestamp: Date.now(),
          };
        } catch (err) {
          result = {
            hostId: host.id,
            hostname: host.hostname,
            exitCode: 1,
            stdout: "",
            stderr: err instanceof Error ? err.message : String(err),
            durationMs: Date.now() - hostStart,
            timestamp: Date.now(),
          };
        }
      } else {
        // No executor registered — record as a simulated result so the
        // runner can still be used for orchestration logic in tests and
        // environments where real SSH is not available.
        result = {
          hostId: host.id,
          hostname: host.hostname,
          exitCode: 0,
          stdout: `[simulated] ${command}`,
          stderr: "",
          durationMs: Date.now() - hostStart,
          timestamp: Date.now(),
        };
      }

      options.onHostResult?.(result);
      this.emit("host-result", result);
      return result;
    };

    const concurrency = options.maxConcurrency;
    let results: HostResult[];

    if (!concurrency || concurrency < 1 || concurrency >= hosts.length) {
      // No effective cap (undefined, zero, negative, or ≥ host count) —
      // run all hosts in parallel (original behaviour).
      results = await Promise.all(hosts.map(runOnHost));
    } else {
      // Pool-based execution: maintain at most `concurrency` in-flight calls.
      results = new Array<HostResult>(hosts.length);
      let nextIndex = 0;

      const worker = async (): Promise<void> => {
        while (nextIndex < hosts.length) {
          const i = nextIndex++;
          results[i] = await runOnHost(hosts[i]);
        }
      };

      const workers: Promise<void>[] = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
      }
      await Promise.all(workers);
    }

    const successCount = results.filter((r) => r.exitCode === 0).length;

    return {
      command,
      results,
      successCount,
      failureCount: results.length - successCount,
      totalDurationMs: Date.now() - startTime,
    };
  }
}

// ── Edge Computing ─────────────────────────────────────────────────────────

/**
 * Deploy handler that performs the actual edge function deployment.
 * The handler receives the prepared deployment record and should return
 * the live URL and regions once the deployment completes.
 */
export type DeployHandler = (
  deployment: EdgeDeployment,
) => Promise<{ url?: string; regions: string[] }>;

/**
 * EdgeComputeManager tracks and manages edge function deployments across
 * providers such as Cloudflare Workers, Lambda@Edge, and Deno Deploy.
 *
 * In a full implementation, each provider would have its own deployment
 * adapter. Here the manager handles the lifecycle (create / activate /
 * deactivate / remove) and status reporting, while actual deployment
 * I/O is delegated to a caller-supplied deploy handler.
 */
export class EdgeComputeManager extends EventEmitter {
  private deployments: Map<string, EdgeDeployment> = new Map();
  private deployHandler: DeployHandler | null = null;

  /**
   * Register the handler that performs the actual deployment (e.g., calling
   * the Cloudflare Workers API).  The handler receives the deployment record
   * and should return the final URL and regions.
   */
  setDeployHandler(fn: DeployHandler): void {
    this.deployHandler = fn;
  }

  /**
   * Create and immediately attempt to deploy an edge function.
   *
   * @param functionName  Name of the function.
   * @param provider      Provider identifier (e.g., "cloudflare", "lambda-edge").
   * @param regions       Target deployment regions.
   */
  async deploy(
    functionName: string,
    provider: string,
    regions: string[] = [],
  ): Promise<EdgeDeployment> {
    const deployment: EdgeDeployment = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      functionName,
      provider,
      status: "deploying",
      regions,
      deployedAt: Date.now(),
    };
    this.deployments.set(deployment.id, deployment);
    this.emit("deploying", deployment);

    try {
      if (this.deployHandler) {
        const result = await this.deployHandler(deployment);
        deployment.url = result.url;
        deployment.regions = result.regions.length > 0 ? result.regions : regions;
      }
      deployment.status = "active";
      this.emit("deployed", deployment);
    } catch (err) {
      deployment.status = "failed";
      this.emit("failed", { deployment, error: err });
    }

    return deployment;
  }

  /** Deactivate (pause) a deployed edge function. */
  deactivate(id: string): boolean {
    const deployment = this.deployments.get(id);
    if (!deployment || deployment.status !== "active") return false;
    deployment.status = "inactive";
    this.emit("deactivated", deployment);
    return true;
  }

  /** Reactivate an inactive edge function. */
  reactivate(id: string): boolean {
    const deployment = this.deployments.get(id);
    if (!deployment || deployment.status !== "inactive") return false;
    deployment.status = "active";
    this.emit("activated", deployment);
    return true;
  }

  /** Remove a deployment from the manager. */
  remove(id: string): boolean {
    const removed = this.deployments.delete(id);
    if (removed) this.emit("removed", id);
    return removed;
  }

  /** Get a deployment by ID. */
  get(id: string): EdgeDeployment | null {
    return this.deployments.get(id) ?? null;
  }

  /** List all deployments, optionally filtered by status. */
  list(status?: EdgeDeployment["status"]): EdgeDeployment[] {
    const all = Array.from(this.deployments.values());
    return status ? all.filter((d) => d.status === status) : all;
  }

  /** List active deployments. */
  listActive(): EdgeDeployment[] {
    return this.list("active");
  }
}

// ── Git Worktree Management ────────────────────────────────────────────────

/**
 * Executor function for running git commands in worktree operations.
 * Callers supply this to keep WorktreeManager dependency-free.
 */
export type GitExecutor = (
  command: string,
  cwd: string,
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

/**
 * WorktreeManager creates and manages isolated git worktrees for parallel
 * development and agent task isolation. Inspired by Claude Code 2.1.49's
 * git worktree support for subagent isolation.
 *
 * Git worktrees allow multiple working directories from the same repository,
 * enabling:
 * - Parallel agent tasks without context pollution
 * - Isolated testing environments
 * - Safe experimentation without affecting main branch
 * - Multi-task development workflows
 *
 * @example
 * ```ts
 * const wtManager = new WorktreeManager();
 * wtManager.setGitExecutor(async (cmd, cwd) => {
 *   try {
 *     const stdout = execSync(cmd, { cwd, encoding: 'utf8' });
 *     return { exitCode: 0, stdout, stderr: "" };
 *   } catch (error: any) {
 *     return {
 *       exitCode: error.status ?? 1,
 *       stdout: error.stdout?.toString?.() ?? "",
 *       stderr: error.stderr?.toString?.() ?? error.message ?? ""
 *     };
 *   }
 * });
 *
 * // Create isolated worktree for an agent task
 * const wt = await wtManager.create({
 *   branch: "feature/isolated-task",
 *   taskId: "agent-123"
 * });
 *
 * // Work in the worktree...
 * // Then clean up when done
 * await wtManager.remove(wt.id);
 * ```
 */
export class WorktreeManager extends EventEmitter {
  private worktrees: Map<string, WorktreeConfig> = new Map();
  private gitExecutor: GitExecutor | null = null;

  /**
   * Register the executor function for running git commands.
   * Required for create() and remove() operations.
   */
  setGitExecutor(fn: GitExecutor): void {
    this.gitExecutor = fn;
  }

  /**
   * Create a new git worktree for isolated task execution.
   *
   * @param options Configuration for the new worktree
   * @returns The created worktree configuration
   */
  async create(options: {
    /** Branch name for the worktree (will be created if it doesn't exist) */
    branch: string;
    /** Parent repository path (default: current directory) */
    parentRepo?: string;
    /** Optional task ID to associate with this worktree */
    taskId?: string;
    /** Base branch to branch from (default: current branch) */
    baseBranch?: string;
  }): Promise<WorktreeConfig> {
    if (!this.gitExecutor) {
      throw new Error("GitExecutor not configured. Call setGitExecutor() first.");
    }

    const parentRepo = options.parentRepo || process.cwd();
    const worktreeId = `wt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    // Place worktrees in a dedicated directory outside .git to avoid corrupting
    // Git's internal administrative state and to work correctly across platforms.
    const worktreePath = path.join(parentRepo, ".worktrees", worktreeId);

    // Validate branch names to prevent command injection via shell execution.
    const SAFE_BRANCH_RE = /^[a-zA-Z0-9._\-/@]+$/;
    if (!SAFE_BRANCH_RE.test(options.branch)) {
      throw new Error(
        `Unsafe branch name: "${options.branch}". Branch names may only contain alphanumeric characters, '.', '-', '_', '/', or '@'.`
      );
    }
    if (options.baseBranch && !SAFE_BRANCH_RE.test(options.baseBranch)) {
      throw new Error(
        `Unsafe base branch name: "${options.baseBranch}". Branch names may only contain alphanumeric characters, '.', '-', '_', '/', or '@'.`
      );
    }
    // Quote the path so that spaces or special characters in the directory path
    // do not break shell parsing when the executor invokes a shell.
    const quotedPath = `"${worktreePath.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

    // Check if branch exists
    const branchCheck = await this.gitExecutor(
      `git rev-parse --verify -- ${options.branch}`,
      parentRepo
    );

    let gitWorktreeAddCmd: string;
    if (branchCheck.exitCode !== 0) {
      // Branch doesn't exist — create it from baseBranch (if provided).
      const newBranchArgs = options.baseBranch
        ? `-b ${options.branch} ${options.baseBranch}`
        : `-b ${options.branch}`;
      gitWorktreeAddCmd = `git worktree add ${newBranchArgs} ${quotedPath}`;
    } else {
      // Existing branch — check it out into the new worktree.
      gitWorktreeAddCmd = `git worktree add ${quotedPath} ${options.branch}`;
    }

    // Create the worktree
    const result = await this.gitExecutor(gitWorktreeAddCmd, parentRepo);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create worktree: ${result.stderr}`);
    }

    const config: WorktreeConfig = {
      id: worktreeId,
      path: worktreePath,
      branch: options.branch,
      parentRepo,
      active: true,
      createdAt: Date.now(),
      taskId: options.taskId,
    };

    this.worktrees.set(worktreeId, config);
    this.emit("worktree-created", config);

    return config;
  }

  /**
   * Remove a worktree and clean up its files.
   *
   * @param id Worktree identifier
   * @param force Force removal even if there are uncommitted changes
   */
  async remove(id: string, force: boolean = false): Promise<boolean> {
    if (!this.gitExecutor) {
      throw new Error("GitExecutor not configured. Call setGitExecutor() first.");
    }

    const worktree = this.worktrees.get(id);
    if (!worktree) {
      return false;
    }

    const forceFlag = force ? "--force " : "";
    const quotedPath = `"${worktree.path.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    const result = await this.gitExecutor(
      `git worktree remove ${forceFlag}${quotedPath}`,
      worktree.parentRepo
    );

    if (result.exitCode !== 0) {
      throw new Error(`Failed to remove worktree: ${result.stderr}`);
    }

    this.worktrees.delete(id);
    this.emit("worktree-removed", { id, path: worktree.path });

    return true;
  }

  /**
   * List all managed worktrees.
   */
  list(): WorktreeConfig[] {
    return Array.from(this.worktrees.values());
  }

  /**
   * List active worktrees.
   */
  listActive(): WorktreeConfig[] {
    return Array.from(this.worktrees.values()).filter((wt) => wt.active);
  }

  /**
   * Get a worktree by ID.
   */
  get(id: string): WorktreeConfig | null {
    return this.worktrees.get(id) ?? null;
  }

  /**
   * Get worktree by task ID.
   */
  getByTaskId(taskId: string): WorktreeConfig | null {
    return Array.from(this.worktrees.values()).find((wt) => wt.taskId === taskId) ?? null;
  }

  /**
   * Mark a worktree as inactive (doesn't delete it).
   */
  deactivate(id: string): boolean {
    const worktree = this.worktrees.get(id);
    if (worktree) {
      worktree.active = false;
      this.emit("worktree-deactivated", worktree);
      return true;
    }
    return false;
  }

  /**
   * Reactivate a worktree.
   */
  reactivate(id: string): boolean {
    const worktree = this.worktrees.get(id);
    if (worktree) {
      worktree.active = true;
      this.emit("worktree-activated", worktree);
      return true;
    }
    return false;
  }

  /**
   * Prune worktrees that no longer exist on disk.
   */
  async prune(): Promise<number> {
    if (!this.gitExecutor) {
      throw new Error("GitExecutor not configured. Call setGitExecutor() first.");
    }

    const worktreeLists = new Map<
      string,
      Awaited<ReturnType<NonNullable<typeof this.gitExecutor>>>
    >();

    for (const worktree of this.worktrees.values()) {
      if (!worktreeLists.has(worktree.parentRepo)) {
        const result = await this.gitExecutor(
          `git worktree list`,
          worktree.parentRepo
        );
        worktreeLists.set(worktree.parentRepo, result);
      }
    }

    let prunedCount = 0;
    for (const [id, worktree] of this.worktrees.entries()) {
      const result = worktreeLists.get(worktree.parentRepo);

      if (result && result.exitCode === 0 && !result.stdout.includes(worktree.path)) {
        this.worktrees.delete(id);
        prunedCount++;
        this.emit("worktree-pruned", { id, path: worktree.path });
      }
    }

    return prunedCount;
  }
}
