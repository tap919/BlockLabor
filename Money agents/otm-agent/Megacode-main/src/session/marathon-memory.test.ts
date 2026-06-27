import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  MarathonMemoryBridge,
  MarathonMemoryConfig,
} from "./marathon-memory";

describe("MarathonMemoryBridge", () => {
  let testDir: string;
  let bridge: MarathonMemoryBridge;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "marathon-test-"));
    const config: MarathonMemoryConfig = {
      bankDir: testDir,
      capacityBytes: 100 * 1024 * 1024,
      sessionConfig: {
        name: "test-session",
        checkpointIntervalMinutes: 60,
        breakReminderMinutes: 120,
        maxDurationHours: 4,
      },
    };
    bridge = new MarathonMemoryBridge(config);
    bridge.open();
  });

  afterEach(() => {
    bridge.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should start and stop a session", () => {
    expect(bridge.isSessionActive()).toBe(false);

    const snapshot = bridge.startSession("test-run");
    expect(snapshot).toBeDefined();
    expect(snapshot.sessionName).toBe("test-run");
    expect(bridge.isSessionActive()).toBe(true);

    const stopped = bridge.stopSession();
    expect(stopped).toBeDefined();
    expect(bridge.isSessionActive()).toBe(false);
  });

  it("should save and resume a session", () => {
    bridge.startSession("resume-test");
    bridge.recordTokens(1000);
    bridge.recordFileModified("/test/file.ts");
    bridge.addKeyInsight("Important insight about the codebase");
    bridge.addPendingWork("Fix bug in auth", "/test/auth.ts", "high");

    const stopped = bridge.stopSession();
    expect(stopped).toBeDefined();

    const resumed = bridge.resumeSession("resume-test");
    expect(resumed).toBeDefined();
    expect(resumed!.context.keyInsights).toContain("Important insight about the codebase");
    expect(resumed!.context.pendingWork).toHaveLength(1);

    bridge.stopSession();
  });

  it("should track decisions", () => {
    bridge.startSession("decision-test");

    const decision = bridge.recordDecision(
      "Use TypeScript strict mode",
      "Improves code quality and catches bugs early",
      ["/test/tsconfig.json"]
    );

    expect(decision.description).toBe("Use TypeScript strict mode");
    expect(decision.rationale).toBe("Improves code quality and catches bugs early");

    const decisions = bridge.getDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0].id).toBe(decision.id);

    bridge.stopSession();
  });

  it("should store code snippets", () => {
    bridge.startSession("snippet-test");

    const snippet = bridge.storeCodeSnippet(
      "/test/utils.ts",
      "export function add(a: number, b: number): number { return a + b; }",
      "Basic addition utility"
    );

    expect(snippet.language).toBe("ts");
    expect(snippet.code).toContain("export function add");

    const context = bridge.getCurrentContext();
    expect(context.codeSnippets).toHaveLength(1);

    bridge.stopSession();
  });

  it("should manage pending work", () => {
    bridge.startSession("pending-test");

    bridge.addPendingWork("Refactor auth module", "/test/auth.ts", "high", ["Setup tests"]);
    bridge.addPendingWork("Update dependencies", undefined, "low");

    const pending = bridge.getPendingWork();
    expect(pending).toHaveLength(2);
    expect(pending[0].priority).toBe("high");

    bridge.completePendingWork(pending[0].id);
    const afterComplete = bridge.getPendingWork();
    expect(afterComplete).toHaveLength(1);

    bridge.stopSession();
  });

  it("should track files in focus", () => {
    bridge.startSession("focus-test");

    bridge.addFileToFocus("/test/a.ts");
    bridge.addFileToFocus("/test/b.ts");
    bridge.addFileToFocus("/test/c.ts");

    const files = bridge.getFilesInFocus();
    expect(files).toHaveLength(3);
    expect(files[0]).toBe("/test/c.ts");

    bridge.removeFileFromFocus("/test/b.ts");
    const afterRemove = bridge.getFilesInFocus();
    expect(afterRemove).toHaveLength(2);

    bridge.stopSession();
  });

  it("should get relevant context by query", () => {
    bridge.startSession("query-test");

    bridge.recordDecision(
      "Use JWT for auth",
      "Better security and scalability",
      ["/test/auth.ts"]
    );
    bridge.storeCodeSnippet(
      "/test/auth.ts",
      "export function verifyToken(token: string): boolean { return true; }",
      "Token verification"
    );
    bridge.addKeyInsight("Auth is critical for security");

    const relevant = bridge.getRelevantContext("auth token");

    expect(relevant.decisions).toHaveLength(1);
    expect(relevant.snippets).toHaveLength(1);
    expect(relevant.insights).toHaveLength(1);

    bridge.stopSession();
  });

  it("should get session stats", () => {
    bridge.startSession("stats-test");

    bridge.recordTokens(5000);
    bridge.recordFileModified("/test/a.ts");
    bridge.recordFileModified("/test/b.ts");
    bridge.createCheckpoint("test-checkpoint");

    const stats = bridge.getSessionStats();
    expect(stats).toBeDefined();
    expect(stats!.sessionActive).toBe(true);
    expect(stats!.totalTokens).toBe(5000);
    expect(stats!.filesModified).toHaveLength(2);
    expect(stats!.totalCheckpoints).toBe(1);

    bridge.stopSession();
  });

  it("should list all sessions", () => {
    bridge.startSession("session-one");
    bridge.stopSession();

    bridge.startSession("session-two");
    bridge.stopSession();

    const sessions = bridge.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].sessionName).toBe("session-two");
  });

  it("should search memory", () => {
    bridge.startSession("search-test");
    bridge.recordDecision("Use React hooks", "Cleaner state management", ["/test/App.tsx"]);
    bridge.storeCodeSnippet("/test/App.tsx", "const App = () => <div>Hello</div>", "Main component");
    bridge.stopSession();

    const results = bridge.searchMemory("React");
    expect(results.decisions).toHaveLength(1);
    expect(results.snippets).toHaveLength(1);
  });

  it("should export and import sessions", () => {
    bridge.startSession("export-test");
    bridge.recordTokens(2500);
    bridge.addKeyInsight("Key insight for export");
    bridge.stopSession();

    const sessions = bridge.listSessions();
    const sessionId = sessions[0].id;

    const exported = bridge.exportSession(sessionId);
    expect(exported).toBeDefined();

    const imported = bridge.importSession(exported!);
    expect(imported).toBeDefined();
    expect(imported!.sessionName).toBe("export-test");

    const allSessions = bridge.listSessions();
    expect(allSessions).toHaveLength(2);
  });

  it("should handle auto-save timer", () => {
    const config: MarathonMemoryConfig = {
      bankDir: testDir,
      capacityBytes: 100 * 1024 * 1024,
      autoSaveIntervalMs: 100,
    };
    const quickBridge = new MarathonMemoryBridge(config);
    quickBridge.open();

    quickBridge.startSession("autosave-test");
    quickBridge.addKeyInsight("Auto-saved insight");

    quickBridge.close();

    const afterBridge = new MarathonMemoryBridge(config);
    afterBridge.open();

    const resumed = afterBridge.resumeSession("autosave-test");
    expect(resumed).toBeDefined();
    expect(resumed!.context.keyInsights).toContain("Auto-saved insight");

    afterBridge.close();
  });

  it("should create checkpoints with context", () => {
    bridge.startSession("checkpoint-test");

    bridge.addFileToFocus("/test/main.ts");
    bridge.addPendingWork("Add tests", "/test/main.spec.ts", "medium");

    const checkpoint = bridge.createCheckpoint("before-refactor");
    expect(checkpoint).toBeDefined();
    expect(checkpoint!.label).toBe("before-refactor");
    expect(checkpoint!.context).toBeDefined();

    bridge.stopSession();
  });

  it("should respect max context snapshots limit", () => {
    const config: MarathonMemoryConfig = {
      bankDir: testDir,
      capacityBytes: 100 * 1024 * 1024,
      maxContextSnapshots: 3,
    };
    const limitedBridge = new MarathonMemoryBridge(config);
    limitedBridge.open();
    limitedBridge.startSession("limit-test");

    limitedBridge.storeCodeSnippet("/test/1.ts", "code1", "desc1", 0.5);
    limitedBridge.storeCodeSnippet("/test/2.ts", "code2", "desc2", 0.5);
    limitedBridge.storeCodeSnippet("/test/3.ts", "code3", "desc3", 0.5);
    limitedBridge.storeCodeSnippet("/test/4.ts", "code4", "desc4", 0.5);
    limitedBridge.storeCodeSnippet("/test/5.ts", "code5", "desc5", 0.5);

    const context = limitedBridge.getCurrentContext();
    expect(context.codeSnippets).toHaveLength(3);

    limitedBridge.stopSession();
    limitedBridge.close();
  });
});
