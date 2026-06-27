import {
  SemanticColorizer,
  ProgressRenderer,
  OutputFormatter,
  HistoryTimeline,
} from "./interface";

describe("SemanticColorizer", () => {
  const colorizer = new SemanticColorizer();

  it("classifies read commands", () => {
    expect(colorizer.classifyIntent("cat file.txt")).toBe("read");
    expect(colorizer.classifyIntent("ls -la")).toBe("read");
    expect(colorizer.classifyIntent("grep pattern file")).toBe("read");
  });

  it("classifies delete commands", () => {
    expect(colorizer.classifyIntent("rm -rf node_modules")).toBe("delete");
  });

  it("classifies create commands", () => {
    expect(colorizer.classifyIntent("mkdir -p src/components")).toBe("create");
    expect(colorizer.classifyIntent("touch newfile.ts")).toBe("create");
  });

  it("classifies navigate commands", () => {
    expect(colorizer.classifyIntent("cd /home/user")).toBe("navigate");
  });

  it("classifies execute commands", () => {
    expect(colorizer.classifyIntent("npm run build")).toBe("execute");
    expect(colorizer.classifyIntent("node server.js")).toBe("execute");
  });

  it("returns unknown for unrecognized commands", () => {
    expect(colorizer.classifyIntent("myCustomTool --flag")).toBe("unknown");
  });

  it("colorizes a command", () => {
    const colorized = colorizer.colorize("ls -la");
    expect(colorized).toContain("ls -la");
    expect(colorized).toContain("\x1b["); // Has ANSI code
    expect(colorized).toContain("\x1b[0m"); // Has reset
  });
});

describe("ProgressRenderer", () => {
  it("creates a progress state", () => {
    const renderer = new ProgressRenderer();
    const state = renderer.start("Building", 100);
    expect(state.label).toBe("Building");
    expect(state.total).toBe(100);
    expect(state.percent).toBe(0);
    expect(state.complete).toBe(false);
  });

  it("updates progress", () => {
    const renderer = new ProgressRenderer();
    let state = renderer.start("Test", 10);
    state = renderer.update(state, 5);
    expect(state.percent).toBe(50);
    expect(state.complete).toBe(false);

    state = renderer.update(state, 10);
    expect(state.percent).toBe(100);
    expect(state.complete).toBe(true);
  });

  it("renders a progress bar", () => {
    const renderer = new ProgressRenderer();
    let state = renderer.start("Loading", 100);
    state = renderer.update(state, 50);
    const bar = renderer.renderBar(state, 20);
    expect(bar).toContain("Loading");
    expect(bar).toContain("50%");
  });

  it("renders a spinner", () => {
    const renderer = new ProgressRenderer();
    const frame = renderer.renderSpinner("Processing...");
    expect(frame).toContain("Processing...");
  });
});

describe("OutputFormatter", () => {
  const formatter = new OutputFormatter();

  it("formats JSON output", () => {
    const result = formatter.format('{"a":1}');
    expect(result).toContain('"a": 1');
  });

  it("passes through non-JSON output", () => {
    const result = formatter.format("plain text");
    expect(result).toBe("plain text");
  });

  it("detects structured data", () => {
    expect(formatter.isStructured('{"key":"value"}')).toBe(true);
    expect(formatter.isStructured("plain text")).toBe(false);
  });
});

describe("HistoryTimeline", () => {
  it("adds entries", () => {
    const timeline = new HistoryTimeline();
    const entry = timeline.add("npm test", "passed", 0, ["ci"]);
    expect(entry.command).toBe("npm test");
    expect(entry.tags).toContain("ci");
  });

  it("searches by command text", () => {
    const timeline = new HistoryTimeline();
    timeline.add("npm test", "all passed", 0);
    timeline.add("npm run build", "done", 0);
    timeline.add("git status", "clean", 0);

    const results = timeline.search("npm");
    expect(results).toHaveLength(2);
  });

  it("searches by tag", () => {
    const timeline = new HistoryTimeline();
    timeline.add("cmd1", undefined, 0, ["deploy"]);
    timeline.add("cmd2", undefined, 0, ["test"]);

    expect(timeline.search("deploy")).toHaveLength(1);
  });

  it("toggles bookmarks", () => {
    const timeline = new HistoryTimeline();
    const entry = timeline.add("important", undefined, 0);
    expect(entry.bookmarked).toBe(false);

    timeline.toggleBookmark(entry.id);
    expect(timeline.getBookmarked()).toHaveLength(1);
  });

  it("adds tags", () => {
    const timeline = new HistoryTimeline();
    const entry = timeline.add("cmd", undefined, 0);
    timeline.addTag(entry.id, "important");
    expect(timeline.getByTag("important")).toHaveLength(1);
  });

  it("removes a tag from an entry", () => {
    const timeline = new HistoryTimeline();
    const entry = timeline.add("cmd", undefined, 0, ["alpha", "beta"]);
    timeline.removeTag(entry.id, "alpha");
    const updated = timeline.getAll().find((e) => e.id === entry.id);
    expect(updated?.tags).not.toContain("alpha");
    expect(updated?.tags).toContain("beta");
  });

  it("clears all entries", () => {
    const timeline = new HistoryTimeline();
    timeline.add("cmd1");
    timeline.add("cmd2");
    expect(timeline.getAll()).toHaveLength(2);
    timeline.clear();
    expect(timeline.getAll()).toHaveLength(0);
  });
});

describe("OutputFormatter - XML", () => {
  const formatter = new OutputFormatter();

  it("indents XML content", () => {
    const xml = "<root><child>value</child></root>";
    const result = formatter.format(xml);
    expect(result).toContain("<root>");
    expect(result).toContain("  <child>"); // indented
  });

  it("detects XML as structured", () => {
    expect(formatter.isStructured("<root><item/></root>")).toBe(true);
    expect(formatter.isStructured("<?xml version='1.0'?><root/>")).toBe(true);
  });

  it("passes through plain text unchanged", () => {
    expect(formatter.format("just text")).toBe("just text");
  });
});
