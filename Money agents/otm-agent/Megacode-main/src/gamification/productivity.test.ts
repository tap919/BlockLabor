import {
  AchievementTracker,
  ProductivityAnalyzer,
  MacroManager,
  ContextSwitcher,
} from "./productivity";

describe("AchievementTracker", () => {
  it("starts with no unlocked achievements", () => {
    const tracker = new AchievementTracker();
    expect(tracker.getUnlocked()).toEqual([]);
  });

  it("unlocks achievement when threshold is met", () => {
    const tracker = new AchievementTracker();
    const unlocked = tracker.updateMetric("commands_run", 1);
    expect(unlocked).toHaveLength(1);
    expect(unlocked[0].id).toBe("first-command");
  });

  it("increments metric and checks achievements", () => {
    const tracker = new AchievementTracker();
    tracker.incrementMetric("commands_run");
    expect(tracker.getUnlocked()).toHaveLength(1);
  });

  it("does not double-unlock achievements", () => {
    const tracker = new AchievementTracker();
    tracker.updateMetric("commands_run", 1);
    const second = tracker.updateMetric("commands_run", 2);
    expect(second).toHaveLength(0);
  });

  it("calls unlock handler", () => {
    const tracker = new AchievementTracker();
    const unlocked: string[] = [];
    tracker.onUnlock((a) => unlocked.push(a.id));
    tracker.updateMetric("commands_run", 1);
    expect(unlocked).toContain("first-command");
  });
});

describe("ProductivityAnalyzer", () => {
  it("detects high-frequency commands", () => {
    const analyzer = new ProductivityAnalyzer();
    for (let i = 0; i < 15; i++) {
      analyzer.recordCommand("npm run build");
    }
    const insights = analyzer.analyze();
    expect(insights.length).toBeGreaterThan(0);
    expect(insights[0].relatedCommands).toContain("npm run build");
  });

  it("returns empty for few commands", () => {
    const analyzer = new ProductivityAnalyzer();
    analyzer.recordCommand("ls");
    expect(analyzer.analyze()).toEqual([]);
  });
});

describe("MacroManager", () => {
  it("records and replays a macro", () => {
    const manager = new MacroManager();
    manager.startRecording("deploy", "Deploy steps");
    manager.recordStep("npm run build");
    manager.recordStep("npm test");
    manager.recordStep("npm run deploy");
    const macro = manager.stopRecording();

    expect(macro).not.toBeNull();
    expect(macro!.commands).toHaveLength(3);

    const commands = manager.resolve("deploy");
    expect(commands).toEqual(["npm run build", "npm test", "npm run deploy"]);
  });

  it("supports variable interpolation", () => {
    const manager = new MacroManager();
    manager.startRecording("branch");
    manager.recordStep("git checkout -b ${branch}");
    manager.recordStep("git push origin ${branch}");
    manager.stopRecording();

    const commands = manager.resolve("branch", { branch: "feature-x" });
    expect(commands).toEqual([
      "git checkout -b feature-x",
      "git push origin feature-x",
    ]);
  });

  it("lists and deletes macros", () => {
    const manager = new MacroManager();
    manager.startRecording("test");
    manager.recordStep("echo hello");
    manager.stopRecording();

    expect(manager.listMacros()).toHaveLength(1);
    manager.deleteMacro("test");
    expect(manager.listMacros()).toHaveLength(0);
  });
});

describe("ContextSwitcher", () => {
  it("saves and loads contexts", () => {
    const switcher = new ContextSwitcher();
    switcher.save({
      name: "project-a",
      cwd: "/path/to/a",
      envVars: { NODE_ENV: "development" },
      openFiles: ["index.ts"],
      savedAt: Date.now(),
    });

    const loaded = switcher.load("project-a");
    expect(loaded).not.toBeNull();
    expect(loaded!.cwd).toBe("/path/to/a");
    expect(switcher.getActiveContext()).toBe("project-a");
  });

  it("lists all contexts", () => {
    const switcher = new ContextSwitcher();
    switcher.save({ name: "a", cwd: "/a", envVars: {}, openFiles: [], savedAt: Date.now() });
    switcher.save({ name: "b", cwd: "/b", envVars: {}, openFiles: [], savedAt: Date.now() });
    expect(switcher.listContexts()).toHaveLength(2);
  });

  it("deletes a context", () => {
    const switcher = new ContextSwitcher();
    switcher.save({ name: "temp", cwd: "/tmp", envVars: {}, openFiles: [], savedAt: Date.now() });
    expect(switcher.deleteContext("temp")).toBe(true);
    expect(switcher.listContexts()).toHaveLength(0);
  });
});

describe("ProductivityAnalyzer - sequential patterns", () => {
  it("detects commands frequently run in sequence", () => {
    const analyzer = new ProductivityAnalyzer();
    for (let i = 0; i < 6; i++) {
      analyzer.recordCommand("git add .");
      analyzer.recordCommand("git commit -m msg");
    }
    const insights = analyzer.analyze();
    const seqInsight = insights.find((i) => i.id.startsWith("seq-"));
    expect(seqInsight).toBeDefined();
    expect(seqInsight?.relatedCommands).toContain("git add .");
    expect(seqInsight?.relatedCommands).toContain("git commit -m msg");
    // Should say "always" when consistency is 100%
    expect(seqInsight?.observation).toContain("always");
    expect(seqInsight?.observation).toContain("100%");
  });

  it("uses 'frequently' when consistency is below 80%", () => {
    const analyzer = new ProductivityAnalyzer();
    // A → B exactly 5 times, but A is followed by other commands too
    for (let i = 0; i < 5; i++) {
      analyzer.recordCommand("npm run lint");
      analyzer.recordCommand("npm run build");
    }
    // A followed by something else 2 more times (lowers consistency)
    for (let i = 0; i < 2; i++) {
      analyzer.recordCommand("npm run lint");
      analyzer.recordCommand("npm test");
    }
    const insights = analyzer.analyze();
    const seqInsight = insights.find(
      (ins) => ins.id.startsWith("seq-") &&
        ins.relatedCommands[0] === "npm run lint" &&
        ins.relatedCommands[1] === "npm run build"
    );
    expect(seqInsight).toBeDefined();
    expect(seqInsight?.observation).toContain("frequently");
  });

  it("does not report repeated single command as a sequence", () => {
    const analyzer = new ProductivityAnalyzer();
    for (let i = 0; i < 8; i++) analyzer.recordCommand("ls -la");
    const insights = analyzer.analyze();
    // Should not report a seq-insight for "ls -la → ls -la"
    const seqInsight = insights.find(
      (ins) => ins.id.startsWith("seq-") && ins.relatedCommands[0] === ins.relatedCommands[1]
    );
    expect(seqInsight).toBeUndefined();
  });
});
