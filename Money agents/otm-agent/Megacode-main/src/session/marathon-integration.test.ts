import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  createMarathonWithReviews,
  MarathonCodeReview,
  MarathonAgentIntegration,
  AgentActivity,
} from "./marathon-code-review";
import { MarathonSprint, MarathonSprintConfig } from "./marathon-sprint";
import { MarathonMemoryBridge, MarathonMemoryConfig } from "./marathon-memory";
import { MarathonSession } from "./marathon";

describe("Marathon Full Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "marathon-integration-test-"));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("createMarathonWithReviews factory", () => {
    it("should create all components", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
          sessionConfig: { name: "integration-test" },
        },
        autonomous: { enableAutoBreaks: false },
        reviewConfig: { reviewOnBuild: true },
      });

      expect(sprint).toBeDefined();
      expect(agent).toBeDefined();
      expect(codeReview).toBeDefined();

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should start session automatically", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
      });

      expect(sprint.isSessionActive()).toBe(true);
      expect(agent.isActive()).toBe(true);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should track activities through integration", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
        autonomous: { enableAutoBreaks: false },
      });

      const testFile = path.join(testDir, "test.ts");
      fs.writeFileSync(testFile, "const x = 1;");

      agent.recordActivity({
        type: "edit",
        filePath: testFile,
        description: "Created test file",
        timestamp: Date.now(),
        riskLevel: "low",
      });

      const history = agent.getActivityHistory();
      expect(history.length).toBeGreaterThan(0);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should create goals and track progress", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
        autonomous: { enableGoalTracking: true },
      });

      sprint.setGoal("Test goal", "Integration test", "high");
      sprint.addSubTask(sprint.getGoals()[0].id, "Subtask 1");
      sprint.startGoal(sprint.getGoals()[0].id);

      const progress = sprint.getOverallProgress();
      expect(progress).toBeGreaterThanOrEqual(0);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should track energy levels", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
        autonomous: { enableAutoBreaks: false },
      });

      const energy = agent.getEnergyLevel();
      expect(energy.score).toBeGreaterThan(0);
      expect(["high", "medium", "low", "depleted"]).toContain(energy.level);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should trigger code reviews", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
        autonomous: { enableAutoBreaks: false },
        reviewConfig: { reviewOnBuild: true },
      });

      const testFile = path.join(testDir, "review-test.ts");
      fs.writeFileSync(testFile, `const password = "secret";
console.log("test");
`);

      const review = codeReview.triggerReview("build");
      expect(review.trigger).toBe("build");
      expect(review.issues.length).toBeGreaterThan(0);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should handle events from agent to code review", () => {
      let reviewTriggered = false;

      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
        autonomous: { enableAutoBreaks: false },
        reviewConfig: { reviewOnBuild: true },
      });

      codeReview.onReview(() => {
        reviewTriggered = true;
      });

      const testFile = path.join(testDir, "event-test.ts");
      fs.writeFileSync(testFile, "const x: any = 1;");

      agent.recordActivity({
        type: "build",
        filePath: testFile,
        description: "Build triggered",
        timestamp: Date.now(),
        riskLevel: "medium",
      });

      codeReview.triggerReview("build");

      expect(reviewTriggered).toBe(true);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should maintain session state across components", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
          sessionConfig: { name: "state-test" },
        },
      });

      sprint.setGoal("State goal", "Testing state");
      agent.recordActivity({
        type: "edit",
        description: "test",
        timestamp: Date.now(),
        riskLevel: "low",
      });

      const stats = agent.getStats();
      expect(stats.session.active).toBe(true);
      expect(stats.session.goals.length).toBe(1);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should generate comprehensive summary", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
      });

      sprint.setGoal("Summary goal", "Testing summary");

      const summary = agent.generateSummary();
      expect(summary).toContain("MARATHON");
      expect(summary).toContain("Summary goal");

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should handle multiple sessions correctly", () => {
      const dir1 = path.join(testDir, "session1");
      const dir2 = path.join(testDir, "session2");

      const { sprint: sprint1, agent: agent1, codeReview: review1 } = createMarathonWithReviews({
        marathon: { bankDir: dir1, capacityBytes: 50 * 1024 * 1024 },
      });

      const { sprint: sprint2, agent: agent2, codeReview: review2 } = createMarathonWithReviews({
        marathon: { bankDir: dir2, capacityBytes: 50 * 1024 * 1024 },
      });

      sprint1.setGoal("Session 1 Goal", "First session");
      sprint2.setGoal("Session 2 Goal", "Second session");

      expect(sprint1.getGoals().length).toBe(1);
      expect(sprint2.getGoals().length).toBe(1);

      agent1.stop();
      review1.close();
      sprint1.close();

      agent2.stop();
      review2.close();
      sprint2.close();
    });

    it("should calculate productivity score", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
        autonomous: { enableAutoBreaks: false },
      });

      const score = agent.getProductivityScore();
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should handle code storage and retrieval", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
      });

      const testFile = path.join(testDir, "store.ts");
      const code = "export function test() { return true; }";
      fs.writeFileSync(testFile, code);

      agent.storeImportantCode(testFile, code, "Test function");

      const context = sprint.getCurrentContext();
      expect(context.codeSnippets.length).toBeGreaterThan(0);

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should record decisions", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
      });

      const decision = agent.recordDecision(
        "Use TypeScript",
        "Better type safety",
        ["/test/tsconfig.json"]
      );

      expect(decision.description).toBe("Use TypeScript");

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should auto-create goals from activities", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
        },
        autonomous: { enableGoalTracking: true },
      });

      const goal = agent.autoCreateGoal("Implement feature", "/src/feature.ts");
      expect(goal).toBeDefined();

      agent.stop();
      codeReview.close();
      sprint.close();
    });

    it("should handle context switches", () => {
      const { sprint, agent, codeReview } = createMarathonWithReviews({
        marathon: {
          bankDir: testDir,
          capacityBytes: 100 * 1024 * 1024,
          maxContextSwitchesPerHour: 5,
        },
        autonomous: { enableAutoBreaks: false },
      });

      agent.recordActivity({
        type: "edit",
        filePath: "/file1.ts",
        description: "First edit",
        timestamp: Date.now(),
        riskLevel: "low",
      });

      agent.recordActivity({
        type: "edit",
        filePath: "/file2.ts",
        description: "Second edit",
        timestamp: Date.now(),
        riskLevel: "low",
      });

      const switches = sprint.getContextSwitches();
      expect(switches.length).toBeGreaterThanOrEqual(0);

      agent.stop();
      codeReview.close();
      sprint.close();
    });
  });

  describe("Component standalone usage", () => {
    it("should allow using MarathonMemoryBridge standalone", () => {
      const bridge = new MarathonMemoryBridge({
        bankDir: testDir,
        capacityBytes: 50 * 1024 * 1024,
      });
      bridge.open();
      bridge.startSession("standalone-test");
      expect(bridge.isSessionActive()).toBe(true);
      bridge.stopSession();
      bridge.close();
    });

    it("should allow using MarathonSession standalone", () => {
      const session = new MarathonSession({
        name: "standalone",
        checkpointIntervalMinutes: 60,
        breakReminderMinutes: 120,
        maxDurationHours: 4,
      });
      session.start();
      expect(session.getStats().checkpoints).toBe(0);
      session.createCheckpoint("test");
      expect(session.getStats().checkpoints).toBe(1);
      session.stop();
    });
  });
});
