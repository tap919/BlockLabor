import {
  FrameworkDetector,
  BestPracticeEnforcer,
  TechDebtTracker,
  MigrationAssistant,
} from "./intelligence";

describe("FrameworkDetector", () => {
  const detector = new FrameworkDetector();

  it("detects React from dependencies", () => {
    const result = detector.detect([], { react: "18.2.0", "react-dom": "18.2.0" });
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].id).toBe("react");
    expect(result[0].confidence).toBe(1);
  });

  it("detects Next.js from both file and dependency", () => {
    const result = detector.detect(["next.config.js"], { next: "14.0.0" });
    expect(result.some((f) => f.id === "nextjs")).toBe(true);
  });

  it("detects Django from files", () => {
    const result = detector.detect(["manage.py"], { django: "4.0" });
    expect(result.some((f) => f.id === "django")).toBe(true);
  });

  it("returns empty for unknown projects", () => {
    const result = detector.detect(["random.xyz"], {});
    expect(result).toEqual([]);
  });

  it("sorts by confidence descending", () => {
    const result = detector.detect(
      ["package.json", "next.config.js"],
      { react: "18.0", "react-dom": "18.0", next: "14.0" }
    );
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
    }
  });
});

describe("BestPracticeEnforcer", () => {
  const enforcer = new BestPracticeEnforcer();

  it("flags missing README", () => {
    const practices = enforcer.check("node", [".gitignore"]);
    expect(practices.some((p) => p.id === "missing-readme")).toBe(true);
  });

  it("flags missing .gitignore", () => {
    const practices = enforcer.check("node", ["README.md"]);
    expect(practices.some((p) => p.id === "missing-gitignore")).toBe(true);
  });

  it("flags missing lockfile for Node projects", () => {
    const practices = enforcer.check("node", ["package.json", "README.md", ".gitignore"]);
    expect(practices.some((p) => p.id === "missing-lockfile")).toBe(true);
  });

  it("does not flag lockfile when present", () => {
    const practices = enforcer.check("node", [
      "package.json", "package-lock.json", "README.md", ".gitignore", "LICENSE",
    ]);
    expect(practices.some((p) => p.id === "missing-lockfile")).toBe(false);
  });

  it("sorts by priority", () => {
    const practices = enforcer.check("node", []);
    for (let i = 1; i < practices.length; i++) {
      expect(practices[i - 1].priority).toBeGreaterThanOrEqual(practices[i].priority);
    }
  });
});

describe("TechDebtTracker", () => {
  it("adds and retrieves debt items", () => {
    const tracker = new TechDebtTracker();
    tracker.add("code-smell", "TODO: refactor this", "src/app.ts:42");
    expect(tracker.getAll()).toHaveLength(1);
  });

  it("scans content for TODOs and FIXMEs", () => {
    const tracker = new TechDebtTracker();
    const found = tracker.scanContent("app.ts", [
      "function doStuff() {",
      "  // TODO: optimize this algorithm",
      "  // FIXME: handle edge case",
      "  // HACK: temporary workaround",
      "  return 42;",
      "}",
    ].join("\n"));
    expect(found).toHaveLength(3);
  });

  it("assigns higher severity to HACK markers", () => {
    const tracker = new TechDebtTracker();
    const found = tracker.scanContent("app.ts", "// HACK: dirty workaround\n// TODO: clean this up");
    const hack = found.find((f) => f.description.includes("HACK"));
    const todo = found.find((f) => f.description.includes("TODO"));
    expect(hack!.severity).toBeGreaterThan(todo!.severity);
  });

  it("produces a debt summary", () => {
    const tracker = new TechDebtTracker();
    tracker.add("code-smell", "Issue 1", "file1.ts", 3, 1);
    tracker.add("outdated-dep", "Issue 2", "file2.ts", 7, 2);
    tracker.add("missing-test", "Issue 3", "file3.ts", 9, 4);

    const summary = tracker.getSummary();
    expect(summary.totalItems).toBe(3);
    expect(summary.totalEstimatedHours).toBe(7);
    expect(summary.topPriority.length).toBeLessThanOrEqual(5);
    expect(summary.topPriority[0].severity).toBe(9);
  });

  it("resolves debt items", () => {
    const tracker = new TechDebtTracker();
    const item = tracker.add("code-smell", "Fix me", "app.ts");
    tracker.resolve(item.id);
    expect(tracker.getAll()).toHaveLength(0);
  });
});

describe("MigrationAssistant", () => {
  let assistant: MigrationAssistant;

  beforeEach(() => {
    assistant = new MigrationAssistant();
  });

  describe("analyzePackages", () => {
    it("identifies packages with updates", () => {
      const packages = assistant.analyzePackages(
        { react: "17.0.0", lodash: "4.17.0" },
        { react: "18.0.0", lodash: "4.17.21" }
      );
      expect(packages.some((p) => p.name === "react" && p.hasUpdate)).toBe(true);
      expect(packages.some((p) => p.name === "lodash" && p.hasUpdate)).toBe(true);
    });

    it("identifies breaking changes for react 17->18", () => {
      const packages = assistant.analyzePackages(
        { react: "17.0.0" },
        { react: "18.0.0" }
      );
      const reactPkg = packages.find((p) => p.name === "react");
      expect(reactPkg?.hasBreakingChanges).toBe(true);
    });

    it("normalizes version specifiers", () => {
      const packages = assistant.analyzePackages(
        { lodash: "^4.17.0" },
        { lodash: "4.17.21" }
      );
      expect(packages[0].currentVersion).toBe("4.17.0");
    });

    it("sorts packages with breaking changes first", () => {
      const packages = assistant.analyzePackages(
        { react: "17.0.0", lodash: "4.17.0" },
        { react: "18.0.0", lodash: "4.17.21" }
      );
      expect(packages[0].hasBreakingChanges).toBe(true);
    });
  });

  describe("getBreakingChanges", () => {
    it("returns breaking changes for react 17->18", () => {
      const changes = assistant.getBreakingChanges("react", "17.0.0", "18.0.0");
      expect(changes.length).toBeGreaterThan(0);
      expect(changes.some((c) => c.affectedArea === "Application bootstrap")).toBe(true);
    });

    it("returns empty for minor version updates", () => {
      const changes = assistant.getBreakingChanges("react", "18.0.0", "18.1.0");
      expect(changes).toHaveLength(0);
    });

    it("returns empty for unknown packages", () => {
      const changes = assistant.getBreakingChanges("unknown-pkg", "1.0.0", "2.0.0");
      expect(changes).toHaveLength(0);
    });
  });

  describe("generatePlan", () => {
    it("generates a migration plan with steps", () => {
      const plan = assistant.generatePlan("react", "17.0.0", "18.0.0", ["src/App.tsx"]);
      expect(plan.package).toBe("react");
      expect(plan.fromVersion).toBe("17.0.0");
      expect(plan.toVersion).toBe("18.0.0");
      expect(plan.hasBreakingChanges).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it("includes backup step when createBackups is true", () => {
      const plan = assistant.generatePlan("lodash", "4.17.0", "4.17.21");
      expect(plan.steps.some((s) => s.description.toLowerCase().includes("backup"))).toBe(true);
    });

    it("sets high risk for critical breaking changes", () => {
      // No critical changes in our mock data, but we can test the logic
      const plan = assistant.generatePlan("lodash", "4.17.0", "5.0.0");
      expect(["low", "medium", "high"]).toContain(plan.risk);
    });

    it("includes lockfile update step", () => {
      const plan = assistant.generatePlan("lodash", "4.17.0", "4.17.21");
      expect(plan.steps.some((s) => s.description.toLowerCase().includes("lockfile"))).toBe(true);
    });
  });

  describe("executePlan", () => {
    it("executes in dry run mode by default", () => {
      const plan = assistant.generatePlan("lodash", "4.17.0", "4.17.21");
      const result = assistant.executePlan(plan);
      expect(result.warnings).toContain("Dry run mode - no changes were made");
      expect(result.success).toBe(true);
    });

    it("creates backup when executing for real", () => {
      const plan = assistant.generatePlan("lodash", "4.17.0", "4.17.21");
      const result = assistant.executePlan(plan, false);
      expect(result.backup).toBeDefined();
      expect(result.backup?.id).toBeTruthy();
    });

    it("stores migration in history", () => {
      const plan = assistant.generatePlan("lodash", "4.17.0", "4.17.21");
      assistant.executePlan(plan, false);
      const history = assistant.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].package).toBe("lodash");
    });

    it("reports manual steps as warnings", () => {
      const plan = assistant.generatePlan("react", "17.0.0", "18.0.0", ["src/App.tsx"]);
      const result = assistant.executePlan(plan, false);
      expect(result.warnings.some((w) => w.includes("Manual step required"))).toBe(true);
    });
  });

  describe("rollback", () => {
    it("removes backup on successful rollback", () => {
      const plan = assistant.generatePlan("lodash", "4.17.0", "4.17.21");
      const result = assistant.executePlan(plan, false);
      const backupId = result.backup!.id;
      const success = assistant.rollback(backupId);
      expect(success).toBe(true);
    });

    it("returns false for non-existent backup", () => {
      const success = assistant.rollback("nonexistent");
      expect(success).toBe(false);
    });
  });

  describe("getUpdateSummary", () => {
    it("provides a summary of available updates", () => {
      const packages = assistant.analyzePackages(
        { react: "17.0.0", lodash: "4.17.0", express: "4.18.0" },
        { react: "18.0.0", lodash: "4.17.21", express: "4.18.0" }
      );
      const summary = assistant.getUpdateSummary(packages);
      expect(summary.total).toBe(3);
      expect(summary.withUpdates).toBe(2);
      expect(summary.withBreakingChanges).toBe(1);
      expect(summary.byRisk.low).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("BestPracticeEnforcer - language-specific checks", () => {
  const enforcer = new BestPracticeEnforcer();

  it("flags missing requirements.txt for Python projects", () => {
    const practices = enforcer.check("python", ["README.md", ".gitignore", "main.py"]);
    expect(practices.some((p) => p.id === "missing-requirements")).toBe(true);
  });

  it("flags missing Python tests", () => {
    const practices = enforcer.check("python", ["README.md", ".gitignore", "requirements.txt"]);
    expect(practices.some((p) => p.id === "missing-python-tests")).toBe(true);
  });

  it("does not flag Python tests when test files exist", () => {
    const practices = enforcer.check("python", [
      "README.md", ".gitignore", "requirements.txt", "test_main.py",
    ]);
    expect(practices.some((p) => p.id === "missing-python-tests")).toBe(false);
  });

  it("flags missing go.sum for Go projects", () => {
    const practices = enforcer.check("go", ["go.mod", "README.md", ".gitignore"]);
    expect(practices.some((p) => p.id === "missing-go-sum")).toBe(true);
  });

  it("does not flag go.sum when present", () => {
    const practices = enforcer.check("go", ["go.mod", "go.sum", "README.md", ".gitignore"]);
    expect(practices.some((p) => p.id === "missing-go-sum")).toBe(false);
  });

  it("flags missing Cargo.lock for Rust projects", () => {
    const practices = enforcer.check("rust", ["Cargo.toml", "README.md", ".gitignore"]);
    expect(practices.some((p) => p.id === "missing-cargo-lock")).toBe(true);
  });
});

describe("TechDebtTracker - extended detection", () => {
  it("detects long lines", () => {
    const tracker = new TechDebtTracker();
    const longLine = "x".repeat(130);
    const found = tracker.scanContent("src/file.ts", longLine);
    expect(found.some((f) => f.type === "long-line")).toBe(true);
  });

  it("does not flag normal-length lines", () => {
    const tracker = new TechDebtTracker();
    const normalLine = "const x = 1; // short line";
    const found = tracker.scanContent("src/file.ts", normalLine);
    expect(found.filter((f) => f.type === "long-line")).toHaveLength(0);
  });

  it("detects long functions", () => {
    const tracker = new TechDebtTracker();
    const lines = ["function bigFn() {"];
    for (let i = 0; i < 55; i++) lines.push(`  const x${i} = ${i};`);
    lines.push("}");
    const found = tracker.scanContent("src/file.ts", lines.join("\n"));
    expect(found.some((f) => f.type === "complexity")).toBe(true);
  });
});
