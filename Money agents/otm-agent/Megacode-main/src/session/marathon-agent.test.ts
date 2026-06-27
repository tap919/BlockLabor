import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  MarathonAgentIntegration,
  createMarathonAgent,
  AutonomousConfig,
  AgentActivity,
} from "./marathon-agent";
import { MarathonSprint, MarathonSprintConfig } from "./marathon-sprint";

describe("MarathonAgentIntegration", () => {
  let testDir: string;
  let sprint: MarathonSprint;
  let integration: MarathonAgentIntegration;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "marathon-agent-test-"));
    const config: MarathonSprintConfig = {
      bankDir: testDir,
      capacityBytes: 100 * 1024 * 1024,
      sessionConfig: {
        name: "agent-test",
        checkpointIntervalMinutes: 60,
        breakReminderMinutes: 120,
        maxDurationHours: 4,
      },
      focusSessionDurationMinutes: 1,
    };
    sprint = new MarathonSprint(config);
    sprint.open();
    sprint.startSession("agent-test");

    const autoConfig: AutonomousConfig = {
      enableAutoBreaks: false,
      enableAutoCheckpoints: false,
      enableAutoQualityGates: false,
      enableContextMonitoring: true,
      enableGoalTracking: true,
    };
    integration = new MarathonAgentIntegration(sprint, autoConfig);
    integration.start();
  });

  afterEach(() => {
    integration.stop();
    sprint.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should start and stop autonomous mode", () => {
    expect(integration.isActive()).toBe(true);
    integration.stop();
    expect(integration.isActive()).toBe(false);
  });

  it("should record activities", () => {
    const activity: AgentActivity = {
      type: "edit",
      filePath: "/test/file.ts",
      description: "Modified file",
      timestamp: Date.now(),
      riskLevel: "low",
    };

    integration.recordActivity(activity);

    const history = integration.getActivityHistory();
    expect(history).toHaveLength(1);
    expect(history[0].filePath).toBe("/test/file.ts");
  });

  it("should track context switches from activities", () => {
    integration.recordActivity({
      type: "edit",
      filePath: "/test/a.ts",
      description: "First edit",
      timestamp: Date.now(),
      riskLevel: "low",
    });

    integration.recordActivity({
      type: "edit",
      filePath: "/test/b.ts",
      description: "Second edit",
      timestamp: Date.now(),
      riskLevel: "low",
    });

    const switches = sprint.getContextSwitches();
    expect(switches.length).toBeGreaterThanOrEqual(1);
  });

  it("should record code changes", () => {
    integration.recordCodeChange("/test/new.ts", "create");

    const history = integration.getActivityHistory();
    const createActivity = history.find(a => a.type === "edit");
    expect(createActivity).toBeDefined();
  });

  it("should record decisions", () => {
    const decision = integration.recordDecision(
      "Use TypeScript",
      "Better type safety",
      ["/test/tsconfig.json"]
    );

    expect(decision.description).toBe("Use TypeScript");
  });

  it("should store important code", () => {
    const code = "export const foo = 'bar';";
    const snippet = integration.storeImportantCode(
      "/test/file.ts",
      code,
      "Important function"
    );

    expect(snippet.code).toBe(code);
  });

  it("should get productivity score", () => {
    const score = integration.getProductivityScore();
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("should get energy level", () => {
    const energy = integration.getEnergyLevel();
    expect(energy.score).toBeGreaterThan(0);
    expect(energy.level).toBeDefined();
  });

  it("should get goal progress", () => {
    sprint.setGoal("Test goal", "Description");
    const progress = integration.getGoalProgress();
    expect(progress).toBe(0);
  });

  it("should auto-create goals", () => {
    const goal = integration.autoCreateGoal("Implement feature X", "/src/feature.ts");
    expect(goal).toBeDefined();
    expect(goal.title).toBe("Implement feature X");
  });

  it("should suggest next goal", () => {
    sprint.setGoal("High priority", "Description", "high");
    sprint.setGoal("Low priority", "Description", "low");

    const suggested = integration.suggestNextGoal();
    expect(suggested).toBeDefined();
    expect(suggested.priority).toBe("high");
  });

  it("should auto-start goals", () => {
    sprint.setGoal("Auto start goal", "Description");
    const started = integration.autoStartGoal();

    expect(started).toBeDefined();
    expect(started.status).toBe("in_progress");
  });

  it("should register and emit events", () => {
    const emitted: string[] = [];
    integration.on("test_event", () => emitted.push("test_event"));
    integration.on("*", () => emitted.push("wildcard"));

    integration.recordActivity({
      type: "edit",
      description: "test",
      timestamp: Date.now(),
      riskLevel: "low",
    });

    expect(emitted).toContain("activity_recorded");
  });

  it("should get autonomous state", () => {
    const state = integration.getAutonomousState();
    expect(state.active).toBe(true);
    expect(state.consecutiveErrors).toBe(0);
    expect(state.productivityScore).toBeGreaterThanOrEqual(0);
  });

  it("should get recent events", () => {
    integration.recordActivity({
      type: "edit",
      description: "event test",
      timestamp: Date.now(),
      riskLevel: "low",
    });

    const events = integration.getRecentEvents();
    expect(events.length).toBeGreaterThan(0);
  });

  it("should handle break handlers", () => {
    let breakCalled = false;
    integration.onBreakSuggestion(() => {
      breakCalled = true;
    });

    integration.stop();
  });

  it("should handle checkpoint handlers", () => {
    let checkpointCalled = false;
    integration.onCheckpoint(() => {
      checkpointCalled = true;
    });
  });

  it("should handle context switch handlers", () => {
    let switchCalled = false;
    integration.onContextSwitch(() => {
      switchCalled = true;
    });
  });

  it("should get current goal", () => {
    expect(integration.getCurrentGoal()).toBeUndefined();

    sprint.setGoal("Current goal", "Desc");
    integration.autoStartGoal();

    expect(integration.getCurrentGoal()).toBeDefined();
  });

  it("should acknowledge breaks", () => {
    integration.acknowledgeBreak();
    const state = integration.getAutonomousState();
    expect(state.lastBreakSuggestion).toBeUndefined();
  });

  describe("createMarathonAgent factory", () => {
    it("should create sprint and integration", () => {
      const { sprint: newSprint, integration: newIntegration } = createMarathonAgent();

      expect(newSprint).toBeDefined();
      expect(newIntegration).toBeDefined();
      expect(newIntegration.isActive()).toBe(true);

      newIntegration.stop();
      newSprint.close();
    });

    it("should accept custom config", () => {
      const { sprint: newSprint, integration: newIntegration } = createMarathonAgent({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
          sessionConfig: { name: "custom-test" },
        },
        autonomous: {
          enableAutoBreaks: true,
          breakSuggestionThreshold: 50,
        },
      });

      expect(newIntegration.isActive()).toBe(true);

      newIntegration.stop();
      newSprint.close();
    });
  });
});
