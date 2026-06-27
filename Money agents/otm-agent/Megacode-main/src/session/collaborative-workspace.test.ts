import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  CollaborativeWorkspace,
  createCollaborativeWorkspace,
} from "./collaborative-workspace";

describe("CollaborativeWorkspace", () => {
  let testDir: string;
  let workspace: CollaborativeWorkspace;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "collaborative-test-"));
    workspace = createCollaborativeWorkspace({
      bankDir: testDir,
      capacityBytes: 100 * 1024 * 1024,
      enableConflictDetection: true,
      enableSharedContext: true,
    });
  });

  afterEach(() => {
    workspace.shutdown();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should create workspace", () => {
    expect(workspace).toBeDefined();
  });

  it("should spawn agents", () => {
    const agent = workspace.spawnAgent({
      name: "Frontend Developer",
      role: "developer",
      expertise: ["React", "TypeScript"],
    });

    expect(agent).toBeDefined();
    expect(agent.name).toBe("Frontend Developer");
    expect(agent.role).toBe("developer");
    expect(agent.expertise).toContain("React");
  });

  it("should assign goals to agents", () => {
    const agent = workspace.spawnAgent({ name: "Dev" });
    workspace.assignGoal(agent.id, "Implement feature X");

    const updated = workspace.getAgent(agent.id);
    expect(updated?.currentTask).toBe("Implement feature X");
    expect(updated?.status).toBe("working");
  });

  it("should complete goals", () => {
    const agent = workspace.spawnAgent({ name: "Dev" });
    workspace.assignGoal(agent.id, "Task");
    workspace.completeGoal(agent.id);

    const updated = workspace.getAgent(agent.id);
    expect(updated?.status).toBe("completed");
    expect(updated?.completedAt).toBeDefined();
  });

  it("should detect file conflicts", () => {
    const agent1 = workspace.spawnAgent({ name: "Dev1" });
    const agent2 = workspace.spawnAgent({ name: "Dev2" });

    workspace.claimFile(agent1.id, "/src/main.ts");
    const claimed = workspace.claimFile(agent2.id, "/src/main.ts");

    expect(claimed).toBe(false);

    const conflicts = workspace.getConflicts();
    expect(conflicts.length).toBe(1);
    expect(conflicts[0].agents).toContain(agent1.id);
    expect(conflicts[0].agents).toContain(agent2.id);
  });

  it("should resolve conflicts", () => {
    const agent1 = workspace.spawnAgent({ name: "Dev1" });
    const agent2 = workspace.spawnAgent({ name: "Dev2" });

    workspace.claimFile(agent1.id, "/src/main.ts");
    workspace.claimFile(agent2.id, "/src/main.ts");

    const conflict = workspace.getConflicts()[0];
    const resolved = workspace.resolveConflict(conflict.id, "sequential");

    expect(resolved).toBe(true);
    expect(conflict.resolved).toBe(true);
  });

  it("should share context", () => {
    workspace.shareContext({
      apiContracts: {
        "/api/auth": { method: "POST", endpoint: "/auth/login" },
      },
    });

    const context = workspace.getSharedContext();
    expect(context.apiContracts).toBeDefined();
    expect(context.apiContracts?.["/api/auth"]).toBeDefined();
  });

  it("should add shared decisions", () => {
    const agent = workspace.spawnAgent({ name: "Dev" });
    const decision = workspace.addSharedDecision(
      agent.id,
      "Use TypeScript",
      "Better type safety"
    );

    expect(decision.description).toBe("Use TypeScript");
    expect(decision.approved).toBeUndefined();
  });

  it("should approve decisions", () => {
    const agent = workspace.spawnAgent({ name: "Dev" });
    const decision = workspace.addSharedDecision(
      agent.id,
      "Use GraphQL",
      "Better API flexibility"
    );

    workspace.approveDecision(decision.id);

    const context = workspace.getSharedContext();
    const approved = context.decisions?.find(d => d.id === decision.id);
    expect(approved?.approved).toBe(true);
  });

  it("should create shared checkpoints", () => {
    const agent = workspace.spawnAgent({ name: "Dev" });
    const checkpoint = workspace.createSharedCheckpoint(
      agent.id,
      "Pre-refactor",
      ["/src/main.ts", "/src/utils.ts"]
    );

    expect(checkpoint.label).toBe("Pre-refactor");
    expect(checkpoint.files).toHaveLength(2);
  });

  it("should get workspace stats", () => {
    workspace.spawnAgent({ name: "Dev1" });
    workspace.spawnAgent({ name: "Dev2" });
    workspace.spawnAgent({ name: "Dev3" });

    const stats = workspace.getWorkspaceStats();
    expect(stats.totalAgents).toBe(3);
  });

  it("should register conflict handlers", () => {
    let handlerCalled = false;
    workspace.onConflict(() => {
      handlerCalled = true;
    });

    const agent1 = workspace.spawnAgent({ name: "Dev1" });
    const agent2 = workspace.spawnAgent({ name: "Dev2" });
    workspace.claimFile(agent1.id, "/test.ts");
    workspace.claimFile(agent2.id, "/test.ts");

    expect(handlerCalled).toBe(true);
  });

  it("should terminate agents", () => {
    const agent = workspace.spawnAgent({ name: "Dev" });
    const terminated = workspace.terminateAgent(agent.id);

    expect(terminated).toBe(true);
    expect(workspace.getAgent(agent.id)).toBeUndefined();
  });

  it("should handle multiple agents correctly", () => {
    const agents = [];
    for (let i = 0; i < 5; i++) {
      agents.push(workspace.spawnAgent({ name: `Dev${i}` }));
    }

    const allAgents = workspace.getAllAgents();
    expect(allAgents).toHaveLength(5);
  });

  it("should track active agents", () => {
    const agent1 = workspace.spawnAgent({ name: "Dev1" });
    workspace.spawnAgent({ name: "Dev2" });

    workspace.assignGoal(agent1.id, "Task");

    const active = workspace.getActiveAgents();
    expect(active).toHaveLength(1);
  });

  it("should get unresolved conflicts", () => {
    const agent1 = workspace.spawnAgent({ name: "Dev1" });
    const agent2 = workspace.spawnAgent({ name: "Dev2" });

    workspace.claimFile(agent1.id, "/a.ts");
    workspace.claimFile(agent2.id, "/a.ts");

    const unresolved = workspace.getUnresolvedConflicts();
    expect(unresolved).toHaveLength(1);
  });
});
