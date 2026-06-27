import {
  TeamAnalytics,
  SkillTracker,
  RegressionDetector,
  LeakDetector,
} from "./improvement";

describe("TeamAnalytics", () => {
  it("records user activity", () => {
    const analytics = new TeamAnalytics();
    analytics.recordActivity("user1", "git status");
    analytics.recordActivity("user1", "git commit");

    const metrics = analytics.getUserMetrics("user1");
    expect(metrics).not.toBeNull();
    expect(metrics!.commandCount).toBe(2);
    expect(metrics!.uniqueCommands).toBe(2);
  });

  it("aggregates team metrics", () => {
    const analytics = new TeamAnalytics();
    analytics.recordActivity("user1", "npm test");
    analytics.recordActivity("user2", "npm test");
    analytics.recordActivity("user2", "npm run build");

    const team = analytics.getTeamMetrics();
    expect(team.memberCount).toBe(2);
    expect(team.totalCommands).toBe(3);
    expect(team.avgCommandsPerMember).toBe(2); // rounds 1.5
  });

  it("tracks top team commands", () => {
    const analytics = new TeamAnalytics();
    for (let i = 0; i < 5; i++) {
      analytics.recordActivity("user1", "git status");
    }
    analytics.recordActivity("user2", "git status");

    const team = analytics.getTeamMetrics();
    expect(team.topTeamCommands[0].command).toBe("git status");
    expect(team.topTeamCommands[0].count).toBe(6);
  });
});

describe("SkillTracker", () => {
  it("records usage and tracks known commands", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("git status");
    tracker.recordUsage("npm test");

    const profile = tracker.getProfile();
    expect(profile.knownCommands).toContain("git");
    expect(profile.knownCommands).toContain("npm");
    expect(profile.categories).toContain("git");
    expect(profile.categories).toContain("node");
  });

  it("recommends gh CLI for git users", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("git status");
    tracker.recordUsage("git commit");

    const recs = tracker.getRecommendations();
    expect(recs.some((r) => r.command === "gh")).toBe(true);
  });

  it("does not recommend already-known commands", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("git status");
    tracker.recordUsage("gh pr create");

    const recs = tracker.getRecommendations();
    expect(recs.some((r) => r.command === "gh")).toBe(false);
  });
});

describe("RegressionDetector", () => {
  it("detects performance regressions", () => {
    const detector = new RegressionDetector({
      minSamplesForRegression: 3,
      regressionThresholdPercent: 20,
    });

    // Baseline: fast
    for (let i = 0; i < 5; i++) {
      detector.record("build", 100);
    }
    // Recent: slow
    for (let i = 0; i < 5; i++) {
      detector.record("build", 200);
    }

    const alert = detector.checkRegression("build");
    expect(alert).not.toBeNull();
    expect(alert!.changePercent).toBeGreaterThan(20);
    expect(alert!.significant).toBe(true);
  });

  it("returns null with insufficient data", () => {
    const detector = new RegressionDetector({ minSamplesForRegression: 5 });
    detector.record("build", 100);
    expect(detector.checkRegression("build")).toBeNull();
  });

  it("provides performance summary", () => {
    const detector = new RegressionDetector();
    detector.record("test", 50);
    detector.record("test", 60);
    detector.record("test", 70);

    const summary = detector.getSummary("test");
    expect(summary).not.toBeNull();
    expect(summary!.samples).toBe(3);
    expect(summary!.min).toBe(50);
    expect(summary!.max).toBe(70);
  });
});

describe("LeakDetector", () => {
  it("takes memory samples", () => {
    const detector = new LeakDetector();
    detector.sampleMemory();
    detector.sampleMemory();
    const trend = detector.getMemoryTrend();
    expect(trend).not.toBeNull();
    expect(trend!.samples).toBe(2);
  });

  it("returns null with insufficient samples for leak detection", () => {
    const detector = new LeakDetector();
    detector.sampleMemory();
    expect(detector.detectMemoryLeaks()).toBeNull();
  });
});

describe("SkillTracker - extended recommendations", () => {
  it("recommends kubectl when docker is used", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("docker run ubuntu");
    const recs = tracker.getRecommendations();
    expect(recs.some((r) => r.command === "kubectl")).toBe(true);
  });

  it("recommends tsc when npm is used", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("npm install");
    const recs = tracker.getRecommendations();
    expect(recs.some((r) => r.command === "tsc")).toBe(true);
  });

  it("recommends jq when curl is used", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("curl https://api.example.com");
    const recs = tracker.getRecommendations();
    expect(recs.some((r) => r.command === "jq")).toBe(true);
  });

  it("recommends pytest when python is used", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("python main.py");
    const recs = tracker.getRecommendations();
    expect(recs.some((r) => r.command === "pytest")).toBe(true);
  });

  it("recommends tmux when ssh is used", () => {
    const tracker = new SkillTracker();
    tracker.recordUsage("ssh user@host");
    const recs = tracker.getRecommendations();
    expect(recs.some((r) => r.command === "tmux")).toBe(true);
  });
});
