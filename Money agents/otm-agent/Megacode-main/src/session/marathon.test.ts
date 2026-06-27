import { MarathonSession } from "./marathon";

describe("MarathonSession", () => {
  let session: MarathonSession;

  beforeEach(() => {
    session = new MarathonSession();
  });

  afterEach(() => {
    session.stop();
  });

  it("should initialize with defaults", () => {
    const stats = session.getStats();
    expect(stats.checkpoints).toBe(0);
    expect(stats.totalTokens).toBe(0);
    expect(stats.filesModified).toEqual([]);
    expect(stats.breaksTaken).toBe(0);
  });

  it("should use provided config", () => {
    const custom = new MarathonSession({
      name: "my-session",
      checkpointIntervalMinutes: 15,
      breakReminderMinutes: 60,
      maxDurationHours: 4,
    });
    expect(custom.sessionConfig.name).toBe("my-session");
    expect(custom.sessionConfig.checkpointIntervalMinutes).toBe(15);
    expect(custom.sessionConfig.breakReminderMinutes).toBe(60);
    expect(custom.sessionConfig.maxDurationHours).toBe(4);
    custom.stop();
  });

  it("should create manual checkpoints", () => {
    const cp = session.createCheckpoint("milestone-1", { task: "auth" });
    expect(cp.label).toBe("milestone-1");
    expect(cp.context).toEqual({ task: "auth" });
    expect(cp.id).toBeTruthy();
    expect(cp.filesModified).toEqual([]);
    expect(session.getStats().checkpoints).toBe(1);
  });

  it("should track tokens", () => {
    session.recordTokens(100);
    session.recordTokens(250);
    expect(session.getStats().totalTokens).toBe(350);
  });

  it("should track modified files (deduplicated)", () => {
    session.recordFileModified("src/foo.ts");
    session.recordFileModified("src/bar.ts");
    session.recordFileModified("src/foo.ts"); // duplicate
    const stats = session.getStats();
    expect(stats.filesModified).toHaveLength(2);
    expect(stats.filesModified).toContain("src/foo.ts");
    expect(stats.filesModified).toContain("src/bar.ts");
  });

  it("should include file info in checkpoint", () => {
    session.recordFileModified("src/main.ts");
    const cp = session.createCheckpoint("after-edit");
    expect(cp.filesModified).toContain("src/main.ts");
  });

  it("should include token count in checkpoint", () => {
    session.recordTokens(500);
    const cp = session.createCheckpoint("snapshot");
    expect(cp.tokenCount).toBe(500);
  });

  it("should fire checkpoint handlers", () => {
    const fired: string[] = [];
    session.onCheckpoint((cp) => fired.push(cp.label));
    session.createCheckpoint("label-a");
    session.createCheckpoint("label-b");
    expect(fired).toEqual(["label-a", "label-b"]);
  });

  it("should return the latest checkpoint", () => {
    expect(session.getLatestCheckpoint()).toBeUndefined();
    session.createCheckpoint("first");
    session.createCheckpoint("second");
    expect(session.getLatestCheckpoint()?.label).toBe("second");
  });

  it("should return all checkpoints in order", () => {
    session.createCheckpoint("a");
    session.createCheckpoint("b");
    session.createCheckpoint("c");
    const all = session.getAllCheckpoints();
    expect(all.map((c) => c.label)).toEqual(["a", "b", "c"]);
  });

  it("should track breaks taken", () => {
    session.start();
    session.acknowledgeBreak();
    session.acknowledgeBreak();
    expect(session.getStats().breaksTaken).toBe(2);
  });

  it("should throw when acknowledging a break before start", () => {
    expect(() => session.acknowledgeBreak()).toThrow(
      "Cannot acknowledge a break before the session has been started",
    );
  });

  it("should not report over max duration for a fresh session", () => {
    expect(session.isOverMaxDuration()).toBe(false);
  });

  it("should report over max duration when threshold is 0", async () => {
    const short = new MarathonSession({ maxDurationHours: 0 });
    // Wait a tick so elapsed time exceeds the 0ms threshold
    await new Promise((r) => setTimeout(r, 5));
    expect(short.isOverMaxDuration()).toBe(true);
    short.stop();
  });

  it("should start and stop without errors", () => {
    const s = new MarathonSession({
      checkpointIntervalMinutes: 9999,
      breakReminderMinutes: 9999,
    });
    expect(() => {
      s.start();
      s.stop();
    }).not.toThrow();
  });

  it("second call to start() is a no-op (no timer leaks)", () => {
    session.start();
    const onCheckpoint = jest.fn();
    session.onCheckpoint(onCheckpoint);
    // Calling start() again must not create duplicate timers
    expect(() => session.start()).not.toThrow();
  });

  it("should include startedAt in stats", () => {
    const before = Date.now();
    const s = new MarathonSession();
    const after = Date.now();
    const stats = s.getStats();
    expect(stats.startedAt).toBeGreaterThanOrEqual(before);
    expect(stats.startedAt).toBeLessThanOrEqual(after);
    s.stop();
  });

  it("should report increasing duration over time", async () => {
    const stats1 = session.getStats();
    await new Promise((r) => setTimeout(r, 10));
    const stats2 = session.getStats();
    expect(stats2.durationMs).toBeGreaterThan(stats1.durationMs);
  });
});

describe("MarathonSession timer-based behavior", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("fires break reminder handler at the configured interval", () => {
    const session = new MarathonSession({
      breakReminderMinutes: 1,
      checkpointIntervalMinutes: 9999,
    });
    const fired: number[] = [];
    session.onBreakReminder((ms) => fired.push(ms));
    session.start();

    jest.advanceTimersByTime(60 * 1000);
    expect(fired).toHaveLength(1);

    jest.advanceTimersByTime(60 * 1000);
    expect(fired).toHaveLength(2);

    session.stop();
  });

  it("fires auto-checkpoint at the configured interval", () => {
    const session = new MarathonSession({
      checkpointIntervalMinutes: 1,
      breakReminderMinutes: 9999,
    });
    const labels: string[] = [];
    session.onCheckpoint((cp) => labels.push(cp.label));
    session.start();

    jest.advanceTimersByTime(60 * 1000);
    expect(labels).toEqual(["auto"]);

    jest.advanceTimersByTime(60 * 1000);
    expect(labels).toEqual(["auto", "auto"]);

    session.stop();
  });

  it("does not fire reminders after stop()", () => {
    const session = new MarathonSession({
      breakReminderMinutes: 1,
      checkpointIntervalMinutes: 9999,
    });
    const fired: number[] = [];
    session.onBreakReminder((ms) => fired.push(ms));
    session.start();
    session.stop();

    jest.advanceTimersByTime(60 * 1000);
    expect(fired).toHaveLength(0);
  });

  it("acknowledgeBreak resets the break reminder timer", () => {
    const session = new MarathonSession({
      breakReminderMinutes: 1,
      checkpointIntervalMinutes: 9999,
    });
    const fired: number[] = [];
    session.onBreakReminder((ms) => fired.push(ms));
    session.start();

    // Advance to just before the interval fires
    jest.advanceTimersByTime(59 * 1000);
    expect(fired).toHaveLength(0);

    // Acknowledge a break — this resets the timer
    session.acknowledgeBreak();

    // Advance another 59s (total 118s, but timer was reset at 59s)
    jest.advanceTimersByTime(59 * 1000);
    expect(fired).toHaveLength(0); // should not have fired yet

    // Now advance the remaining 1s to complete the new 60s interval
    jest.advanceTimersByTime(1000);
    expect(fired).toHaveLength(1);

    session.stop();
  });
});
