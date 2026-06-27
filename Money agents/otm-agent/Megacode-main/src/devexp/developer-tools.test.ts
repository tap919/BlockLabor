import {
  DataExplorer,
  CommandTimeline,
  SmartCompleter,
} from "./developer-tools";

describe("DataExplorer", () => {
  const explorer = new DataExplorer();

  describe("detectFormat", () => {
    it("detects JSON", () => {
      expect(explorer.detectFormat('{"key": "value"}')).toBe("json");
    });

    it("detects JSON arrays", () => {
      expect(explorer.detectFormat('[1, 2, 3]')).toBe("json");
    });

    it("detects CSV", () => {
      expect(explorer.detectFormat("name,age\nAlice,30\nBob,25")).toBe("csv");
    });

    it("returns text for unknown", () => {
      expect(explorer.detectFormat("hello world")).toBe("text");
    });
  });

  describe("format", () => {
    it("formats JSON array as table", () => {
      const input = JSON.stringify([
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]);
      const result = explorer.format(input);
      expect(result.format).toBe("json");
      expect(result.headers).toContain("name");
      expect(result.rows).toHaveLength(2);
    });

    it("formats CSV with headers", () => {
      const result = explorer.format("name,age\nAlice,30\nBob,25");
      expect(result.format).toBe("csv");
      expect(result.headers).toEqual(["name", "age"]);
      expect(result.rowCount).toBe(2);
    });

    it("passes through plain text", () => {
      const result = explorer.format("just some text");
      expect(result.format).toBe("text");
      expect(result.rendered).toBe("just some text");
    });
  });
});

describe("CommandTimeline", () => {
  it("records and navigates steps", () => {
    const timeline = new CommandTimeline();
    timeline.record({
      command: "ls",
      output: "file1 file2",
      exitCode: 0,
      cwd: "/home",
      timestamp: Date.now(),
      durationMs: 10,
    });
    timeline.record({
      command: "cat file1",
      output: "contents",
      exitCode: 0,
      cwd: "/home",
      timestamp: Date.now(),
      durationMs: 5,
    });

    expect(timeline.getLength()).toBe(2);
    expect(timeline.getCurrentStep()?.command).toBe("cat file1");

    const prev = timeline.stepBack();
    expect(prev?.command).toBe("ls");

    const next = timeline.stepForward();
    expect(next?.command).toBe("cat file1");
  });

  it("handles empty timeline", () => {
    const timeline = new CommandTimeline();
    expect(timeline.getCurrentStep()).toBeNull();
    expect(timeline.stepBack()).toBeNull();
    expect(timeline.stepForward()).toBeNull();
  });

  it("navigates to specific step", () => {
    const timeline = new CommandTimeline();
    for (let i = 0; i < 5; i++) {
      timeline.record({
        command: `cmd-${i}`,
        output: "",
        exitCode: 0,
        cwd: "/",
        timestamp: Date.now(),
        durationMs: 1,
      });
    }
    const step = timeline.goToStep(2);
    expect(step?.command).toBe("cmd-2");
  });
});

describe("SmartCompleter", () => {
  it("completes project files", () => {
    const completer = new SmartCompleter();
    completer.setProjectFiles(["src/index.ts", "src/utils.ts", "package.json"]);
    const items = completer.complete("src/");
    expect(items.length).toBeGreaterThan(0);
    expect(items.some((i) => i.text === "src/index.ts")).toBe(true);
  });

  it("completes git branches", () => {
    const completer = new SmartCompleter();
    completer.setGitBranches(["main", "feature/auth", "feature/api"]);
    const items = completer.complete("feature/");
    expect(items).toHaveLength(2);
  });

  it("completes recent commands", () => {
    const completer = new SmartCompleter();
    completer.recordCommand("npm run build");
    completer.recordCommand("npm test");
    const items = completer.complete("npm");
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("sorts by score descending", () => {
    const completer = new SmartCompleter();
    completer.recordCommand("npm test");
    completer.setProjectFiles(["npm-check.json"]);
    const items = completer.complete("npm");
    // Recent commands should score higher
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].score).toBeGreaterThanOrEqual(items[i].score);
    }
  });
});
