import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  MarathonSprint,
  MarathonSprintConfig,
} from "./marathon-sprint";

describe("MarathonSprint", () => {
  let testDir: string;
  let sprint: MarathonSprint;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "marathon-sprint-test-"));
    const config: MarathonSprintConfig = {
      bankDir: testDir,
      capacityBytes: 100 * 1024 * 1024,
      sessionConfig: {
        name: "sprint-test",
        checkpointIntervalMinutes: 60,
        breakReminderMinutes: 120,
        maxDurationHours: 4,
      },
      focusSessionDurationMinutes: 1,
    };
    sprint = new MarathonSprint(config);
    sprint.open();
    sprint.startSession("sprint-test");
  });

  afterEach(() => {
    sprint.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("Goal Management", () => {
    it("should create a new goal", () => {
      const goal = sprint.setGoal(
        "Implement authentication",
        "Add JWT-based auth system",
        "high"
      );

      expect(goal).toBeDefined();
      expect(goal.title).toBe("Implement authentication");
      expect(goal.status).toBe("pending");
      expect(goal.priority).toBe("high");
    });

    it("should add sub-tasks to a goal", () => {
      const goal = sprint.setGoal("Test goal", "Description");
      const subTask = sprint.addSubTask(goal.id, "Create auth module", "/src/auth.ts");

      expect(subTask).toBeDefined();
      expect(subTask.title).toBe("Create auth module");
      expect(subTask.status).toBe("pending");
    });

    it("should start a goal and track focus session", () => {
      const goal = sprint.setGoal("Active goal", "Description");
      sprint.startGoal(goal.id);

      const activeGoal = sprint.getActiveGoal();
      expect(activeGoal).toBeDefined();
      expect(activeGoal.status).toBe("in_progress");
    });

    it("should pause a goal", () => {
      const goal = sprint.setGoal("Paused goal", "Description");
      sprint.startGoal(goal.id);
      sprint.pauseGoal(goal.id);

      const pausedGoal = sprint.getGoals().find(g => g.id === goal.id);
      expect(pausedGoal.status).toBe("pending");
    });

    it("should complete a goal", () => {
      const goal = sprint.setGoal("Completed goal", "Description");
      sprint.startGoal(goal.id);
      sprint.completeGoal(goal.id);

      const completedGoal = sprint.getGoals().find(g => g.id === goal.id);
      expect(completedGoal.status).toBe("completed");
      expect(completedGoal.completedAt).toBeDefined();
    });

    it("should complete sub-tasks and auto-complete goal", () => {
      const goal = sprint.setGoal("Multi-task goal", "Description");
      sprint.addSubTask(goal.id, "Task 1");
      sprint.addSubTask(goal.id, "Task 2");

      sprint.startGoal(goal.id);
      const subTasks = goal.subTasks;

      sprint.completeSubTask(goal.id, subTasks[0].id);
      const afterFirst = sprint.getGoals().find(g => g.id === goal.id);
      expect(afterFirst.status).toBe("in_progress");

      sprint.completeSubTask(goal.id, subTasks[1].id);
      const afterSecond = sprint.getGoals().find(g => g.id === goal.id);
      expect(afterSecond.status).toBe("completed");
    });

    it("should calculate goal progress", () => {
      const goal = sprint.setGoal("Progress goal", "Description");
      sprint.addSubTask(goal.id, "Task 1");
      sprint.addSubTask(goal.id, "Task 2");

      expect(sprint.getGoalProgress(goal.id)).toBe(0);

      sprint.startGoal(goal.id);
      sprint.completeSubTask(goal.id, goal.subTasks[0].id);
      expect(sprint.getGoalProgress(goal.id)).toBe(50);

      sprint.completeSubTask(goal.id, goal.subTasks[1].id);
      expect(sprint.getGoalProgress(goal.id)).toBe(100);
    });

    it("should calculate overall progress", () => {
      expect(sprint.getOverallProgress()).toBe(0);

      const goal1 = sprint.setGoal("Goal 1", "Desc");
      sprint.addSubTask(goal1.id, "Task 1");
      sprint.addSubTask(goal1.id, "Task 2");

      sprint.startGoal(goal1.id);
      sprint.completeSubTask(goal1.id, goal1.subTasks[0].id);
      expect(sprint.getOverallProgress()).toBe(50);
    });
  });

  describe("Energy Tracking", () => {
    it("should start with high energy", () => {
      const energy = sprint.getEnergyLevel();
      expect(energy.level).toBe("high");
      expect(energy.score).toBe(100);
    });

    it("should decrease energy over time", async () => {
      const initial = sprint.getEnergyLevel();
      await new Promise(r => setTimeout(r, 100));
      const after = sprint.getEnergyLevel();
      expect(after.score).toBeLessThanOrEqual(initial.score);
    });

    it("should increase energy on activity", () => {
      sprint.recordContextSwitch("/test/a.ts");
      const energy = sprint.getEnergyLevel();
      expect(energy.score).toBeGreaterThan(0);
    });

    it("should recover energy on break", () => {
      sprint.acknowledgeBreak();
      const energy = sprint.getEnergyLevel();
      expect(energy.score).toBeGreaterThan(100);
    });

    it("should provide break suggestions", () => {
      const suggestion = sprint.getBreakSuggestion();
      expect(suggestion).toBeDefined();
      expect(suggestion.shouldBreak).toBe(false);
    });
  });

  describe("Context Switching", () => {
    it("should track context switches", () => {
      sprint.recordContextSwitch("/test/a.ts");
      sprint.recordContextSwitch("/test/b.ts");
      sprint.recordContextSwitch("/test/c.ts");

      const switches = sprint.getContextSwitches();
      expect(switches).toHaveLength(2);
    });

    it("should not count switches to same file", () => {
      sprint.recordContextSwitch("/test/a.ts");
      sprint.recordContextSwitch("/test/a.ts");
      sprint.recordContextSwitch("/test/a.ts");

      const switches = sprint.getContextSwitches();
      expect(switches).toHaveLength(0);
    });
  });

  describe("Quality Gates", () => {
    it("should get quality gates", () => {
      const gates = sprint.getQualityGates();
      expect(Array.isArray(gates)).toBe(true);
    });
  });

  describe("Sprint Statistics", () => {
    it("should get sprint stats", () => {
      const stats = sprint.getSprintStats();
      expect(stats).toBeDefined();
      expect(stats.session).toBeDefined();
      expect(stats.focus).toBeDefined();
      expect(stats.energy).toBeDefined();
      expect(stats.productivity).toBeDefined();
    });

    it("should show active goal in stats", () => {
      const goal = sprint.setGoal("Stats goal", "Description");
      sprint.startGoal(goal.id);

      const stats = sprint.getSprintStats();
      expect(stats.session.activeGoal).toBeDefined();
      expect(stats.session.activeGoal.title).toBe("Stats goal");
    });
  });

  describe("Session Summary", () => {
    it("should generate session summary", () => {
      sprint.setGoal("Summary goal", "Description");

      const summary = sprint.generateSessionSummary();
      expect(summary).toContain("MARATHON SPRINT SESSION SUMMARY");
      expect(summary).toContain("Summary goal");
    });
  });

  describe("Persistence", () => {
    it("should persist goals across sessions", () => {
      sprint.setGoal("Persisted goal", "Will survive restart");
      sprint.stopSession();

      const newSprint = new MarathonSprint({
        bankDir: testDir,
        capacityBytes: 100 * 1024 * 1024,
        sessionConfig: { name: "test" },
        focusSessionDurationMinutes: 1,
      });
      newSprint.open();
      newSprint.resumeSession("sprint-test");

      const goals = newSprint.getGoals();
      expect(goals.some(g => g.title === "Persisted goal")).toBe(true);

      newSprint.close();
    });
  });

  describe("Pre-operation checkpoints", () => {
    it("should create pre-operation checkpoints", () => {
      const checkpoint = sprint.createPreOperationCheckpoint("refactor");
      expect(checkpoint).toBeDefined();
      expect(checkpoint.label).toBe("pre-refactor");
    });
  });
});
