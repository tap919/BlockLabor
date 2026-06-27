/**
 * MCPHealthMonitor — Item #3
 *
 * Background health checker for all registered MCP servers.
 * Emits events when servers go down or recover so the coordinator
 * can auto-reconnect without manual intervention.
 *
 * Events:
 *   "mcp-healthy"       (serverId, status)  — server passed a check
 *   "mcp-check-failed"  (serverId, status)  — server failed a check (below threshold)
 *   "mcp-down"          (serverId, status)  — server reached failure threshold
 *   "mcp-recovered"     (serverId, status)  — server came back up
 */

import { EventEmitter } from "events";

export interface MCPServerHealth {
  serverId: string;
  healthy: boolean;
  lastCheckedAt: number;
  lastHealthyAt: number | null;
  consecutiveFailures: number;
  latencyMs: number | null;
}

export interface HealthMonitorConfig {
  /** How often to ping each server (ms). Default 30 s. */
  intervalMs?: number;
  /** Consecutive failures before marking a server as down. Default 2. */
  failureThreshold?: number;
  /** Per-check timeout (ms). Default 5 s. */
  timeoutMs?: number;
}

/** A function that returns true if the given server responds. */
export type PingFn = (serverId: string) => Promise<boolean>;

export class MCPHealthMonitor extends EventEmitter {
  private readonly statuses = new Map<string, MCPServerHealth>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly config: Required<HealthMonitorConfig>;
  private readonly ping: PingFn;

  constructor(ping: PingFn, config: HealthMonitorConfig = {}) {
    super();
    this.ping = ping;
    this.config = {
      intervalMs: config.intervalMs ?? 30_000,
      failureThreshold: config.failureThreshold ?? 2,
      timeoutMs: config.timeoutMs ?? 5_000,
    };
  }

  /** Register a server to be monitored. */
  register(serverId: string): void {
    if (!this.statuses.has(serverId)) {
      this.statuses.set(serverId, {
        serverId,
        healthy: true,
        lastCheckedAt: Date.now(),
        lastHealthyAt: Date.now(),
        consecutiveFailures: 0,
        latencyMs: null,
      });
    }
  }

  /** Stop monitoring a server. */
  unregister(serverId: string): void {
    this.statuses.delete(serverId);
  }

  /** Start the polling loop. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => { void this.checkAll(); }, this.config.intervalMs);
    (this.timer as NodeJS.Timeout).unref?.();
  }

  /** Stop the polling loop. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run a health check on all registered servers immediately. */
  async checkAll(): Promise<MCPServerHealth[]> {
    const results = await Promise.allSettled(
      [...this.statuses.keys()].map(id => this.checkOne(id))
    );
    return results
      .filter((r): r is PromiseFulfilledResult<MCPServerHealth> => r.status === "fulfilled")
      .map(r => r.value);
  }

  /** Run a health check on one server. */
  async checkOne(serverId: string): Promise<MCPServerHealth> {
    const status = this.statuses.get(serverId);
    if (!status) throw new Error(`Unknown server: ${serverId}`);

    const wasHealthy = status.healthy;
    const start = Date.now();

    let ok = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const timeout = new Promise<boolean>((_, rej) => {
        timer = setTimeout(() => rej(new Error("timeout")), this.config.timeoutMs);
      });
      ok = await Promise.race([this.ping(serverId), timeout]);
    } catch {
      ok = false;
    } finally {
      if (timer !== null) clearTimeout(timer);
    }

    status.lastCheckedAt = Date.now();
    status.latencyMs = Date.now() - start;

    if (ok) {
      const recovering = !wasHealthy;
      status.healthy = true;
      status.consecutiveFailures = 0;
      status.lastHealthyAt = Date.now();
      if (recovering) this.emit("mcp-recovered", serverId, { ...status });
      this.emit("mcp-healthy", serverId, { ...status });
    } else {
      status.consecutiveFailures++;
      if (status.consecutiveFailures >= this.config.failureThreshold) {
        const justWentDown = wasHealthy;
        status.healthy = false;
        if (justWentDown) this.emit("mcp-down", serverId, { ...status });
      }
      this.emit("mcp-check-failed", serverId, { ...status });
    }

    return { ...status };
  }

  /** Snapshot of all server statuses. */
  getStatuses(): MCPServerHealth[] {
    return [...this.statuses.values()].map(s => ({ ...s }));
  }

  /** Status of a single server. */
  getStatus(serverId: string): MCPServerHealth | undefined {
    const s = this.statuses.get(serverId);
    return s ? { ...s } : undefined;
  }

  /** True only when all registered servers are healthy. */
  allHealthy(): boolean {
    return [...this.statuses.values()].every(s => s.healthy);
  }
}
