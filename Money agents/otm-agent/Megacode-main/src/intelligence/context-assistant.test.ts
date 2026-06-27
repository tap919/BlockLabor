import { ContextAssistant, CodeReviewAutomation } from "./context-assistant";

describe("ContextAssistant", () => {
  let assistant: ContextAssistant;

  beforeEach(() => {
    assistant = new ContextAssistant();
  });

  describe("initialize", () => {
    it("creates a new project context", async () => {
      const ctx = await assistant.initialize("/test/project");
      expect(ctx.workspaceRoot).toBe("/test/project");
      expect(ctx.projectType).toBe("unknown");
      expect(ctx.fileIndex).toEqual([]);
      expect(ctx.commandHistory).toEqual([]);
    });

    it("derives a project ID from workspace root", async () => {
      const ctx = await assistant.initialize("/home/user/my-project");
      expect(ctx.projectId).toBeTruthy();
      expect(ctx.projectId).not.toContain("/");
    });
  });

  describe("recordCommand", () => {
    it("adds a command to history", async () => {
      await assistant.initialize("/test");
      assistant.recordCommand({
        command: "npm test",
        timestamp: Date.now(),
        exitCode: 0,
        cwd: "/test",
        durationMs: 500,
      });
      const ctx = assistant.getContext();
      expect(ctx?.commandHistory).toHaveLength(1);
      expect(ctx?.commandHistory[0].command).toBe("npm test");
    });

    it("trims history when exceeding maxHistorySize", async () => {
      const small = new ContextAssistant({ maxHistorySize: 2 });
      await small.initialize("/test");
      for (let i = 0; i < 5; i++) {
        small.recordCommand({
          command: `cmd-${i}`,
          timestamp: Date.now(),
          exitCode: 0,
          cwd: "/test",
          durationMs: 100,
        });
      }
      const ctx = small.getContext();
      expect(ctx?.commandHistory).toHaveLength(2);
      expect(ctx?.commandHistory[0].command).toBe("cmd-3");
    });
  });

  describe("indexFile", () => {
    it("adds a new file to the index", async () => {
      await assistant.initialize("/test");
      assistant.indexFile({
        path: "src/index.ts",
        language: "typescript",
        role: "entry-point",
        lastModified: Date.now(),
        dependencies: [],
      });
      const ctx = assistant.getContext();
      expect(ctx?.fileIndex).toHaveLength(1);
    });

    it("updates an existing file in the index", async () => {
      await assistant.initialize("/test");
      assistant.indexFile({
        path: "src/index.ts",
        language: "typescript",
        role: "entry-point",
        lastModified: Date.now(),
        dependencies: [],
      });
      assistant.indexFile({
        path: "src/index.ts",
        language: "typescript",
        role: "config",
        lastModified: Date.now(),
        dependencies: ["a"],
      });
      const ctx = assistant.getContext();
      expect(ctx?.fileIndex).toHaveLength(1);
      expect(ctx?.fileIndex[0].role).toBe("config");
    });
  });

  describe("suggestFix", () => {
    it("fixes common git typo", () => {
      const fix = assistant.suggestFix("gti status", "command not found");
      expect(fix).not.toBeNull();
      expect(fix?.suggested).toBe("git status");
    });

    it("fixes common npm typo", () => {
      const fix = assistant.suggestFix("nmp install", "command not found");
      expect(fix).not.toBeNull();
      expect(fix?.suggested).toBe("npm install");
    });

    it("returns null for unknown commands", () => {
      const fix = assistant.suggestFix("validcmd --flag", "some error");
      expect(fix).toBeNull();
    });
  });

  describe("generateSuggestions", () => {
    it("returns empty when not initialized", async () => {
      const suggestions = await assistant.generateSuggestions();
      expect(suggestions).toEqual([]);
    });

    it("suggests tests before deploy", async () => {
      await assistant.initialize("/test");
      assistant.recordCommand({
        command: "deploy production",
        timestamp: Date.now(),
        exitCode: 0,
        cwd: "/test",
        durationMs: 100,
      });
      const suggestions = await assistant.generateSuggestions();
      expect(suggestions.length).toBeGreaterThanOrEqual(1);
      expect(suggestions[0].trigger).toBe("pre-deploy");
    });
  });
});

describe("CodeReviewAutomation", () => {
  let reviewer: CodeReviewAutomation;

  beforeEach(() => {
    reviewer = new CodeReviewAutomation();
  });

  describe("reviewFile", () => {
    it("detects console.log statements", () => {
      const content = 'console.log("debug");';
      const findings = reviewer.reviewFile("test.ts", content);
      expect(findings.some((f) => f.ruleId === "no-console")).toBe(true);
    });

    it("detects debugger statements", () => {
      const content = 'function test() { debugger; return 42; }';
      const findings = reviewer.reviewFile("test.js", content);
      expect(findings.some((f) => f.ruleId === "no-debugger")).toBe(true);
      expect(findings.find((f) => f.ruleId === "no-debugger")?.severity).toBe("error");
    });

    it("detects TODO/FIXME comments", () => {
      const content = '// TODO: fix this later';
      const findings = reviewer.reviewFile("test.ts", content);
      expect(findings.some((f) => f.ruleId === "no-todo-fixme")).toBe(true);
    });

    it("detects any type usage", () => {
      const content = 'const data: any = {};';
      const findings = reviewer.reviewFile("test.ts", content);
      expect(findings.some((f) => f.ruleId === "no-any-type")).toBe(true);
    });

    it("ignores files in node_modules", () => {
      const content = 'console.log("test");';
      const findings = reviewer.reviewFile("node_modules/pkg/index.js", content);
      expect(findings).toHaveLength(0);
    });

    it("respects file extension filters for rules", () => {
      const content = 'const data: any = {};';
      const jsFindings = reviewer.reviewFile("test.js", content);
      expect(jsFindings.some((f) => f.ruleId === "no-any-type")).toBe(false);
    });
  });

  describe("reviewDiff", () => {
    it("returns a complete review result", () => {
      const files = [
        { path: "src/test.ts", content: 'console.log("test"); debugger;' },
      ];
      const result = reviewer.reviewDiff(files);
      expect(result.filesReviewed).toContain("src/test.ts");
      expect(result.totalFindings).toBeGreaterThan(0);
      expect(result.bySeverity.error).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
    });

    it("passes when no errors are found", () => {
      const files = [
        { path: "src/clean.ts", content: 'export const add = (a: number, b: number) => a + b;' },
      ];
      const result = reviewer.reviewDiff(files);
      expect(result.passed).toBe(true);
    });
  });

  describe("parseDiff", () => {
    it("parses a unified diff into hunks", () => {
      const diff = `--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,4 @@
 const a = 1;
+const b = 2;
 const c = 3;`;
      const hunks = reviewer.parseDiff(diff);
      expect(hunks).toHaveLength(1);
      expect(hunks[0].filePath).toBe("test.ts");
      expect(hunks[0].additions).toContain("const b = 2;");
    });
  });

  describe("summarize", () => {
    it("generates a passing summary", () => {
      const result = reviewer.reviewDiff([
        { path: "clean.ts", content: "const a = 1;" },
      ]);
      const summary = reviewer.summarize(result);
      expect(summary).toContain("✅");
      expect(summary).toContain("passed");
    });

    it("generates a failing summary", () => {
      const result = reviewer.reviewDiff([
        { path: "bad.ts", content: "debugger;" },
      ]);
      const summary = reviewer.summarize(result);
      expect(summary).toContain("❌");
      expect(summary).toContain("failed");
    });
  });

  describe("addRule", () => {
    it("allows adding custom rules", () => {
      reviewer.addRule({
        id: "custom-no-foo",
        pattern: /\bfoo\b/g,
        message: "Avoid using foo",
        severity: "warning",
        category: "style",
        fileExtensions: [],
      });
      const findings = reviewer.reviewFile("test.ts", "const foo = 1;");
      expect(findings.some((f) => f.ruleId === "custom-no-foo")).toBe(true);
    });
  });

  describe("strict mode", () => {
    it("elevates warnings to errors in strict mode", () => {
      const strictReviewer = new CodeReviewAutomation({ strict: true });
      const findings = strictReviewer.reviewFile("test.ts", 'console.log("test");');
      const consoleFinding = findings.find((f) => f.ruleId === "no-console");
      expect(consoleFinding?.severity).toBe("error");
    });
  });
});
