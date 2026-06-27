import {
  HostManager,
  TunnelManager,
  OfflineQueue,
  DistributedCommandRunner,
  EdgeComputeManager,
  RemoteHost,
  WorktreeManager,
  GitExecutor,
} from "./remote";

describe("HostManager", () => {
  it("adds and retrieves hosts", () => {
    const manager = new HostManager();
    manager.addHost({
      id: "web1",
      hostname: "10.0.0.1",
      port: 22,
      user: "deploy",
      status: "connected",
      tags: ["web", "us-east"],
      lastSeen: Date.now(),
    });
    expect(manager.getAll()).toHaveLength(1);
    expect(manager.getHost("web1")?.hostname).toBe("10.0.0.1");
  });

  it("filters by tag", () => {
    const manager = new HostManager();
    manager.addHost({ id: "web1", hostname: "10.0.0.1", port: 22, user: "deploy", status: "connected", tags: ["web"], lastSeen: Date.now() });
    manager.addHost({ id: "db1", hostname: "10.0.0.2", port: 22, user: "deploy", status: "connected", tags: ["db"], lastSeen: Date.now() });
    expect(manager.getByTag("web")).toHaveLength(1);
  });

  it("gets connected hosts only", () => {
    const manager = new HostManager();
    manager.addHost({ id: "a", hostname: "a", port: 22, user: "u", status: "connected", tags: [], lastSeen: Date.now() });
    manager.addHost({ id: "b", hostname: "b", port: 22, user: "u", status: "disconnected", tags: [], lastSeen: Date.now() });
    expect(manager.getConnected()).toHaveLength(1);
  });

  it("updates host status", () => {
    const manager = new HostManager();
    manager.addHost({ id: "h1", hostname: "h1", port: 22, user: "u", status: "disconnected", tags: [], lastSeen: 0 });
    manager.updateStatus("h1", "connected");
    expect(manager.getHost("h1")?.status).toBe("connected");
  });
});

describe("TunnelManager", () => {
  it("creates tunnels", () => {
    const manager = new TunnelManager();
    const tunnel = manager.create({
      type: "local",
      localPort: 8080,
      remoteHost: "db.example.com",
      remotePort: 5432,
    });
    expect(tunnel.id).toBeTruthy();
    expect(tunnel.active).toBe(false);
  });

  it("activates and deactivates tunnels", () => {
    const manager = new TunnelManager();
    const tunnel = manager.create({ type: "local", localPort: 3000, remoteHost: "host", remotePort: 3000 });
    manager.activate(tunnel.id);
    expect(manager.listActive()).toHaveLength(1);
    manager.deactivate(tunnel.id);
    expect(manager.listActive()).toHaveLength(0);
  });

  it("removes tunnels", () => {
    const manager = new TunnelManager();
    const tunnel = manager.create({ type: "local", localPort: 3000, remoteHost: "host", remotePort: 3000 });
    manager.remove(tunnel.id);
    expect(manager.list()).toHaveLength(0);
  });
});

describe("OfflineQueue", () => {
  it("starts online", () => {
    const queue = new OfflineQueue();
    expect(queue.isOnline()).toBe(true);
  });

  it("enqueues operations", () => {
    const queue = new OfflineQueue();
    queue.enqueue("api-call", { url: "/test" });
    expect(queue.getPending()).toHaveLength(1);
  });

  it("marks operations as synced", () => {
    const queue = new OfflineQueue();
    const op = queue.enqueue("api-call", { url: "/test" });
    queue.markSynced(op.id);
    expect(queue.getPending()).toHaveLength(0);
  });

  it("clears synced operations", () => {
    const queue = new OfflineQueue();
    const op = queue.enqueue("api-call", { url: "/test" });
    queue.markSynced(op.id);
    queue.clearSynced();
    expect(queue.getAll()).toHaveLength(0);
  });

  it("emits reconnected event", (done) => {
    const queue = new OfflineQueue();
    queue.setOnline(false);
    queue.on("reconnected", () => done());
    queue.setOnline(true);
  });

  it("reports pending count", () => {
    const queue = new OfflineQueue();
    queue.enqueue("a", {});
    queue.enqueue("b", {});
    expect(queue.getPendingCount()).toBe(2);
  });
});

// ── DistributedCommandRunner ────────────────────────────────────────────────

const makeHost = (id: string, tags: string[] = []): RemoteHost => ({
  id,
  hostname: `${id}.example.com`,
  port: 22,
  user: "deploy",
  status: "connected",
  tags,
  lastSeen: Date.now(),
});

describe("DistributedCommandRunner", () => {
  it("returns empty result when no hosts are connected", async () => {
    const manager = new HostManager();
    const runner = new DistributedCommandRunner(manager);
    const result = await runner.run("uptime");
    expect(result.results).toHaveLength(0);
    expect(result.successCount).toBe(0);
    expect(result.failureCount).toBe(0);
  });

  it("runs command on all connected hosts (simulated)", async () => {
    const manager = new HostManager();
    manager.addHost(makeHost("web1"));
    manager.addHost(makeHost("web2"));
    const runner = new DistributedCommandRunner(manager);
    const result = await runner.run("echo hello");
    expect(result.results).toHaveLength(2);
    expect(result.successCount).toBe(2);
    expect(result.command).toBe("echo hello");
  });

  it("uses a custom executor", async () => {
    const manager = new HostManager();
    manager.addHost(makeHost("db1"));
    const runner = new DistributedCommandRunner(manager);
    runner.setExecutor(async (_host, cmd) => ({
      exitCode: 0,
      stdout: `executed: ${cmd}`,
      stderr: "",
    }));
    const result = await runner.run("df -h");
    expect(result.results[0].stdout).toBe("executed: df -h");
  });

  it("records failures from executor", async () => {
    const manager = new HostManager();
    manager.addHost(makeHost("bad1"));
    const runner = new DistributedCommandRunner(manager);
    runner.setExecutor(async () => {
      throw new Error("connection refused");
    });
    const result = await runner.run("ls");
    expect(result.failureCount).toBe(1);
    expect(result.results[0].exitCode).toBe(1);
    expect(result.results[0].stderr).toContain("connection refused");
  });

  it("filters hosts by tag", async () => {
    const manager = new HostManager();
    manager.addHost(makeHost("web1", ["web"]));
    manager.addHost(makeHost("db1", ["db"]));
    const runner = new DistributedCommandRunner(manager);
    const result = await runner.run("uptime", { tags: ["web"] });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].hostId).toBe("web1");
  });

  it("invokes onHostResult callback for each host", async () => {
    const manager = new HostManager();
    manager.addHost(makeHost("h1"));
    manager.addHost(makeHost("h2"));
    const runner = new DistributedCommandRunner(manager);
    const seen: string[] = [];
    await runner.run("pwd", {
      onHostResult: (r) => seen.push(r.hostId),
    });
    expect(seen).toContain("h1");
    expect(seen).toContain("h2");
  });

  it("emits host-result events", async () => {
    const manager = new HostManager();
    manager.addHost(makeHost("h1"));
    const runner = new DistributedCommandRunner(manager);
    const events: string[] = [];
    runner.on("host-result", (r) => events.push(r.hostId));
    await runner.run("date");
    expect(events).toContain("h1");
  });

  it("skips disconnected hosts", async () => {
    const manager = new HostManager();
    manager.addHost({ ...makeHost("online1"), status: "connected" });
    manager.addHost({ ...makeHost("offline1"), status: "disconnected" });
    const runner = new DistributedCommandRunner(manager);
    const result = await runner.run("uptime");
    expect(result.results).toHaveLength(1);
    expect(result.results[0].hostId).toBe("online1");
  });

  it("respects maxConcurrency by processing hosts in a bounded pool", async () => {
    const manager = new HostManager();
    for (let i = 1; i <= 5; i++) manager.addHost(makeHost(`h${i}`));
    const runner = new DistributedCommandRunner(manager);

    // Track peak concurrency
    let inFlight = 0;
    let peakConcurrency = 0;
    runner.setExecutor(async () => {
      inFlight++;
      peakConcurrency = Math.max(peakConcurrency, inFlight);
      // Yield to event loop to let other tasks start (simulating async work)
      await new Promise((r) => setTimeout(r, 0));
      inFlight--;
      return { exitCode: 0, stdout: "ok", stderr: "" };
    });

    const result = await runner.run("date", { maxConcurrency: 2 });
    expect(result.results).toHaveLength(5);
    expect(result.successCount).toBe(5);
    // With maxConcurrency: 2, exactly 2 tasks should be in-flight at peak.
    expect(peakConcurrency).toBe(2);
  });

  it("runs all hosts in parallel when maxConcurrency is not set", async () => {
    const manager = new HostManager();
    for (let i = 1; i <= 4; i++) manager.addHost(makeHost(`h${i}`));
    const runner = new DistributedCommandRunner(manager);
    const result = await runner.run("echo test");
    expect(result.results).toHaveLength(4);
    expect(result.successCount).toBe(4);
  });
});

// ── EdgeComputeManager ─────────────────────────────────────────────────────

describe("EdgeComputeManager", () => {
  it("deploys a function and marks it active", async () => {
    const manager = new EdgeComputeManager();
    const deployment = await manager.deploy("my-fn", "cloudflare");
    expect(deployment.status).toBe("active");
    expect(deployment.id).toBeTruthy();
    expect(deployment.functionName).toBe("my-fn");
    expect(deployment.provider).toBe("cloudflare");
  });

  it("uses deploy handler to set URL and regions", async () => {
    const manager = new EdgeComputeManager();
    manager.setDeployHandler(async (dep) => ({
      url: `https://${dep.functionName}.workers.dev`,
      regions: ["us-east-1", "eu-west-1"],
    }));
    const deployment = await manager.deploy("hello-world", "cloudflare");
    expect(deployment.url).toBe("https://hello-world.workers.dev");
    expect(deployment.regions).toContain("us-east-1");
    expect(deployment.status).toBe("active");
  });

  it("marks deployment as failed when handler throws", async () => {
    const manager = new EdgeComputeManager();
    manager.setDeployHandler(async () => {
      throw new Error("deploy failed");
    });
    const deployment = await manager.deploy("broken-fn", "cloudflare");
    expect(deployment.status).toBe("failed");
  });

  it("deactivates and reactivates deployments", async () => {
    const manager = new EdgeComputeManager();
    const dep = await manager.deploy("fn", "cloudflare");
    manager.deactivate(dep.id);
    expect(manager.get(dep.id)?.status).toBe("inactive");
    manager.reactivate(dep.id);
    expect(manager.get(dep.id)?.status).toBe("active");
  });

  it("lists active deployments", async () => {
    const manager = new EdgeComputeManager();
    await manager.deploy("fn1", "cloudflare");
    const dep2 = await manager.deploy("fn2", "lambda-edge");
    manager.deactivate(dep2.id);
    expect(manager.listActive()).toHaveLength(1);
  });

  it("removes a deployment", async () => {
    const manager = new EdgeComputeManager();
    const dep = await manager.deploy("fn", "cloudflare");
    manager.remove(dep.id);
    expect(manager.get(dep.id)).toBeNull();
    expect(manager.list()).toHaveLength(0);
  });

  it("emits events during lifecycle", async () => {
    const manager = new EdgeComputeManager();
    const events: string[] = [];
    manager.on("deploying", () => events.push("deploying"));
    manager.on("deployed", () => events.push("deployed"));
    await manager.deploy("fn", "cloudflare");
    expect(events).toContain("deploying");
    expect(events).toContain("deployed");
  });

  it("returns false when deactivating unknown id", () => {
    const manager = new EdgeComputeManager();
    expect(manager.deactivate("nonexistent")).toBe(false);
  });

  it("returns false when reactivating active deployment", async () => {
    const manager = new EdgeComputeManager();
    const dep = await manager.deploy("fn", "cloudflare");
    // Already active, reactivate should return false
    expect(manager.reactivate(dep.id)).toBe(false);
  });
});

// ── WorktreeManager ─────────────────────────────────────────────────────────

describe("WorktreeManager", () => {
  let manager: WorktreeManager;
  let mockGitExecutor: jest.Mock<ReturnType<GitExecutor>, Parameters<GitExecutor>>;

  beforeEach(() => {
    manager = new WorktreeManager();
    mockGitExecutor = jest.fn();
    manager.setGitExecutor(mockGitExecutor);
  });

  describe("create", () => {
    it("should create a new worktree with a new branch", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: "",
          stderr: "fatal: Needed a single revision",
        })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({
        branch: "feature/new-task",
        taskId: "task-123",
      });

      expect(config.branch).toBe("feature/new-task");
      expect(config.taskId).toBe("task-123");
      expect(config.active).toBe(true);
      expect(mockGitExecutor).toHaveBeenCalledTimes(2);
    });

    it("should create a worktree from an existing branch", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 0, stdout: "abc123", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "existing-branch" });

      expect(config.branch).toBe("existing-branch");
      expect(config.active).toBe(true);
    });

    it("should throw error if GitExecutor is not configured", async () => {
      const newManager = new WorktreeManager();
      await expect(newManager.create({ branch: "test" })).rejects.toThrow(
        "GitExecutor not configured"
      );
    });

    it("should throw error for unsafe branch name", async () => {
      await expect(
        manager.create({ branch: "feat; rm -rf /" })
      ).rejects.toThrow("Unsafe branch name");
    });

    it("should throw error for unsafe baseBranch name", async () => {
      await expect(
        manager.create({ branch: "safe-branch", baseBranch: "main`evil`" })
      ).rejects.toThrow("Unsafe base branch name");
    });

    it("should throw error if git worktree add fails", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: "",
          stderr: "Failed to add worktree",
        });

      await expect(manager.create({ branch: "test" })).rejects.toThrow(
        "Failed to create worktree"
      );
    });
  });

  describe("remove", () => {
    it("should remove an existing worktree", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "test-branch" });

      mockGitExecutor.mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
      });

      const removed = await manager.remove(config.id);
      expect(removed).toBe(true);
      expect(manager.get(config.id)).toBeNull();
    });

    it("should force remove worktree when force=true", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "test" });

      mockGitExecutor.mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
      });

      await manager.remove(config.id, true);
      expect(mockGitExecutor).toHaveBeenCalledWith(
        expect.stringContaining("--force"),
        expect.any(String)
      );
    });

    it("should return false for non-existent worktree", async () => {
      const removed = await manager.remove("non-existent-id");
      expect(removed).toBe(false);
    });
  });

  describe("list operations", () => {
    it("should list all worktrees", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      await manager.create({ branch: "wt1" });
      await manager.create({ branch: "wt2" });

      const all = manager.list();
      expect(all).toHaveLength(2);
    });

    it("should list only active worktrees", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const wt1 = await manager.create({ branch: "wt1" });
      await manager.create({ branch: "wt2" });

      manager.deactivate(wt1.id);

      const active = manager.listActive();
      expect(active).toHaveLength(1);
      expect(active[0].branch).toBe("wt2");
    });
  });

  describe("getByTaskId", () => {
    it("should retrieve worktree by task ID", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      await manager.create({ branch: "task-branch", taskId: "task-456" });

      const found = manager.getByTaskId("task-456");
      expect(found).not.toBeNull();
      expect(found?.taskId).toBe("task-456");
      expect(found?.branch).toBe("task-branch");
    });

    it("should return null for non-existent task ID", () => {
      const found = manager.getByTaskId("non-existent");
      expect(found).toBeNull();
    });
  });

  describe("activation/deactivation", () => {
    it("should deactivate a worktree", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "test" });
      expect(config.active).toBe(true);

      const success = manager.deactivate(config.id);
      expect(success).toBe(true);

      const retrieved = manager.get(config.id);
      expect(retrieved?.active).toBe(false);
    });

    it("should reactivate a worktree", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "test" });
      manager.deactivate(config.id);

      const success = manager.reactivate(config.id);
      expect(success).toBe(true);

      const retrieved = manager.get(config.id);
      expect(retrieved?.active).toBe(true);
    });
  });

  describe("prune", () => {
    it("should prune worktrees that no longer exist", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "test" });

      mockGitExecutor.mockResolvedValueOnce({
        exitCode: 0,
        stdout: "/some/other/path main",
        stderr: "",
      });

      const prunedCount = await manager.prune();
      expect(prunedCount).toBe(1);
      expect(manager.get(config.id)).toBeNull();
    });

    it("should keep worktrees that still exist", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "test" });

      mockGitExecutor.mockResolvedValueOnce({
        exitCode: 0,
        stdout: config.path,
        stderr: "",
      });

      const prunedCount = await manager.prune();
      expect(prunedCount).toBe(0);
      expect(manager.get(config.id)).not.toBeNull();
    });
  });

  describe("events", () => {
    it("should emit worktree-created event", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const listener = jest.fn();
      manager.on("worktree-created", listener);

      await manager.create({ branch: "test" });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ branch: "test" })
      );
    });

    it("should emit worktree-removed event", async () => {
      mockGitExecutor
        .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "" })
        .mockResolvedValueOnce({ exitCode: 0, stdout: "", stderr: "" });

      const config = await manager.create({ branch: "test" });

      const listener = jest.fn();
      manager.on("worktree-removed", listener);

      mockGitExecutor.mockResolvedValueOnce({
        exitCode: 0,
        stdout: "",
        stderr: "",
      });

      await manager.remove(config.id);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});

