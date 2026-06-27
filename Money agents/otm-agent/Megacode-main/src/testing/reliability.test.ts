import {
  DryRunner,
  CommandTestRunner,
  RollbackManager,
  SnapshotManager,
} from "./reliability";

describe("DryRunner", () => {
  const runner = new DryRunner();

  it("predicts file deletion effects", () => {
    const result = runner.analyze("rm -rf node_modules");
    expect(result.effects.length).toBeGreaterThan(0);
    expect(result.effects[0].type).toBe("file-delete");
    expect(result.effects[0].severity).toBe("destructive");
    expect(result.safe).toBe(false);
  });

  it("predicts directory creation as safe", () => {
    const result = runner.analyze("mkdir -p src/components");
    expect(result.effects.length).toBeGreaterThan(0);
    expect(result.effects[0].type).toBe("file-create");
    expect(result.effects[0].severity).toBe("safe");
    expect(result.safe).toBe(true);
  });

  it("warns about sudo commands", () => {
    const result = runner.analyze("sudo apt-get install vim");
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain("elevated privileges");
  });

  it("produces a summary", () => {
    const result = runner.analyze("cp file1 file2");
    expect(result.summary).toBeTruthy();
  });

  it("handles commands with no predicted effects", () => {
    const result = runner.analyze("echo hello");
    expect(result.effects).toEqual([]);
    expect(result.safe).toBe(true);
  });
});

describe("CommandTestRunner", () => {
  const runner = new CommandTestRunner();

  it("checks exit code assertions", () => {
    const results = runner.checkAssertions(
      [{ type: "exit-code", expected: 0, description: "Should succeed" }],
      { exitCode: 0, stdout: "", stderr: "" }
    );
    expect(results[0].passed).toBe(true);
  });

  it("fails on exit code mismatch", () => {
    const results = runner.checkAssertions(
      [{ type: "exit-code", expected: 0, description: "Should succeed" }],
      { exitCode: 1, stdout: "", stderr: "" }
    );
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain("exit code");
  });

  it("checks stdout-contains assertions", () => {
    const results = runner.checkAssertions(
      [{ type: "stdout-contains", expected: "success", description: "Contains success" }],
      { exitCode: 0, stdout: "Build success!", stderr: "" }
    );
    expect(results[0].passed).toBe(true);
  });

  it("checks stdout-matches assertions", () => {
    const results = runner.checkAssertions(
      [{ type: "stdout-matches", expected: "\\d+ tests passed", description: "Test count" }],
      { exitCode: 0, stdout: "42 tests passed", stderr: "" }
    );
    expect(results[0].passed).toBe(true);
  });
});

describe("RollbackManager", () => {
  it("records operations", () => {
    const manager = new RollbackManager();
    const op = manager.record("npm install", {
      modifiedFiles: new Map(),
      createdFiles: ["node_modules"],
      deletedFiles: new Map(),
    });
    expect(op.id).toBeTruthy();
    expect(op.rolledBack).toBe(false);
  });

  it("gets undoable operations", () => {
    const manager = new RollbackManager();
    manager.record("cmd1", { modifiedFiles: new Map(), createdFiles: [], deletedFiles: new Map() });
    manager.record("cmd2", { modifiedFiles: new Map(), createdFiles: [], deletedFiles: new Map() });

    const undoable = manager.getUndoable();
    expect(undoable).toHaveLength(2);
    expect(undoable[0].command).toBe("cmd2"); // Most recent first
  });

  it("marks operations as rolled back", () => {
    const manager = new RollbackManager();
    const op = manager.record("cmd", { modifiedFiles: new Map(), createdFiles: [], deletedFiles: new Map() });
    manager.markRolledBack(op.id);
    expect(manager.getUndoable()).toHaveLength(0);
  });
});

describe("SnapshotManager", () => {
  it("saves and retrieves snapshots", () => {
    const manager = new SnapshotManager();
    manager.save({
      id: "snap1",
      name: "Before deploy",
      timestamp: Date.now(),
      fileChecksums: { "index.ts": "abc123" },
      envVars: { NODE_ENV: "production" },
      cwd: "/app",
    });
    expect(manager.get("snap1")).not.toBeNull();
  });

  it("diffs two snapshots", () => {
    const manager = new SnapshotManager();
    manager.save({
      id: "a",
      name: "Before",
      timestamp: Date.now(),
      fileChecksums: { "file1.ts": "aaa", "file2.ts": "bbb" },
      envVars: { NODE_ENV: "dev" },
      cwd: "/app",
    });
    manager.save({
      id: "b",
      name: "After",
      timestamp: Date.now(),
      fileChecksums: { "file1.ts": "aaa", "file3.ts": "ccc" },
      envVars: { NODE_ENV: "prod" },
      cwd: "/app",
    });

    const diff = manager.diff("a", "b");
    expect(diff).not.toBeNull();
    expect(diff!.addedFiles).toContain("file3.ts");
    expect(diff!.removedFiles).toContain("file2.ts");
    expect(diff!.changedEnvVars).toContain("NODE_ENV");
  });

  it("lists all snapshots", () => {
    const manager = new SnapshotManager();
    manager.save({ id: "1", name: "A", timestamp: Date.now(), fileChecksums: {}, envVars: {}, cwd: "/" });
    manager.save({ id: "2", name: "B", timestamp: Date.now(), fileChecksums: {}, envVars: {}, cwd: "/" });
    expect(manager.list()).toHaveLength(2);
  });
});

describe("DryRunner - extended patterns", () => {
  const runner = new DryRunner();

  it("predicts touch as safe file-create", () => {
    const result = runner.analyze("touch config.json");
    expect(result.effects).toHaveLength(1);
    expect(result.effects[0].type).toBe("file-create");
    expect(result.effects[0].severity).toBe("safe");
    expect(result.safe).toBe(true);
  });

  it("predicts echo overwrite as cautious file-modify", () => {
    const result = runner.analyze('echo "hello" > output.txt');
    expect(result.effects.length).toBeGreaterThan(0);
    const modify = result.effects.find((e) => e.type === "file-modify");
    expect(modify).toBeDefined();
    expect(modify?.severity).toBe("cautious");
  });

  it("predicts echo append (>>) as safe file-modify", () => {
    const result = runner.analyze('echo "hello" >> output.txt');
    expect(result.effects.length).toBeGreaterThan(0);
    const modify = result.effects.find((e) => e.type === "file-modify");
    expect(modify).toBeDefined();
    expect(modify?.severity).toBe("safe");
    expect(modify?.description).toContain("Append");
  });

  it("predicts chmod as env-change", () => {
    const result = runner.analyze("chmod 755 deploy.sh");
    expect(result.effects.length).toBeGreaterThan(0);
    expect(result.effects[0].type).toBe("env-change");
  });

  it("predicts npm install as safe", () => {
    const result = runner.analyze("npm install");
    expect(result.effects.length).toBeGreaterThan(0);
    expect(result.effects[0].type).toBe("file-create");
    expect(result.effects[0].severity).toBe("safe");
  });

  it("predicts git clone as safe file-create", () => {
    const result = runner.analyze("git clone https://github.com/user/repo mydir");
    expect(result.effects.length).toBeGreaterThan(0);
    expect(result.effects[0].type).toBe("file-create");
    expect(result.effects[0].severity).toBe("safe");
  });

  it("predicts wget as network effect", () => {
    const result = runner.analyze("wget https://example.com/file.tar.gz");
    expect(result.effects.length).toBeGreaterThan(0);
    expect(result.effects[0].type).toBe("network");
  });
});

describe("CommandTestRunner - file assertions", () => {
  const runner = new CommandTestRunner();

  it("passes file-exists when file is present", () => {
    const results = runner.checkAssertions(
      [{ type: "file-exists", expected: "dist/index.js", description: "Output exists" }],
      { exitCode: 0, stdout: "", stderr: "" },
      { "dist/index.js": "console.log('hi');" }
    );
    expect(results[0].passed).toBe(true);
  });

  it("fails file-exists when file is absent", () => {
    const results = runner.checkAssertions(
      [{ type: "file-exists", expected: "dist/index.js", description: "Output exists" }],
      { exitCode: 0, stdout: "", stderr: "" },
      {}
    );
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain("dist/index.js");
  });

  it("passes file-contains when content matches", () => {
    const results = runner.checkAssertions(
      [{ type: "file-contains", expected: "output.txt:hello world", description: "Content check" }],
      { exitCode: 0, stdout: "", stderr: "" },
      { "output.txt": "hello world\nfoo bar" }
    );
    expect(results[0].passed).toBe(true);
  });

  it("fails file-contains when content does not match", () => {
    const results = runner.checkAssertions(
      [{ type: "file-contains", expected: "output.txt:missing text", description: "Content check" }],
      { exitCode: 0, stdout: "", stderr: "" },
      { "output.txt": "hello world" }
    );
    expect(results[0].passed).toBe(false);
  });

  it("fails file-contains when file does not exist", () => {
    const results = runner.checkAssertions(
      [{ type: "file-contains", expected: "nonexistent.txt:text", description: "Content check" }],
      { exitCode: 0, stdout: "", stderr: "" },
      {}
    );
    expect(results[0].passed).toBe(false);
    expect(results[0].message).toContain("nonexistent.txt");
  });
});
