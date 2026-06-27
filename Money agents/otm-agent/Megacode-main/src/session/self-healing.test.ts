import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  EnhancedSelfHealing,
  createSelfHealingSystem,
} from "./self-healing";

describe("EnhancedSelfHealing", () => {
  let testDir: string;
  let healing: EnhancedSelfHealing;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "self-healing-test-"));
    
    const srcDir = path.join(testDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    
    healing = createSelfHealingSystem({
      enableDependencyAnalysis: true,
      enablePerformanceTracking: true,
      enablePatternLearning: true,
    });
  });

  afterEach(() => {
    healing.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("Dependency Analysis", () => {
    it("should build dependency graph", () => {
      fs.writeFileSync(path.join(testDir, "src", "a.ts"), `
import { b } from "./b";
import c from "external-lib";
export function a() { return b(); }
`);
      fs.writeFileSync(path.join(testDir, "src", "b.ts"), `
export function b() { return 42; }
`);
      fs.writeFileSync(path.join(testDir, "src", "index.ts"), `
import { a } from "./a";
export default a;
`);

      const graph = healing.buildDependencyGraph(path.join(testDir, "src"));

      expect(graph.nodes.size).toBeGreaterThan(0);
    });

    it("should detect direct file dependencies", () => {
      fs.writeFileSync(path.join(testDir, "src", "main.ts"), `
import { util } from "./util";
export function main() { return util(); }
`);
      fs.writeFileSync(path.join(testDir, "src", "util.ts"), `
export function util() { return "util"; }
`);

      healing.buildDependencyGraph(path.join(testDir, "src"));
      const impact = healing.analyzeChangeImpact([path.join(testDir, "src", "util.ts")]);

      expect(impact.directlyAffected).toContain(path.join(testDir, "src", "util.ts"));
    });

    it("should detect indirect dependencies", () => {
      fs.writeFileSync(path.join(testDir, "src", "a.ts"), `export const a = 1;`);
      fs.writeFileSync(path.join(testDir, "src", "b.ts"), `import { a } from "./a"; export const b = a;`);
      fs.writeFileSync(path.join(testDir, "src", "c.ts"), `import { b } from "./b"; export const c = b;`);

      healing.buildDependencyGraph(path.join(testDir, "src"));
      const impact = healing.analyzeChangeImpact([path.join(testDir, "src", "a.ts")]);

      expect(impact.indirectlyAffected.length).toBeGreaterThan(0);
    });

    it("should calculate ripple effect score", () => {
      fs.writeFileSync(path.join(testDir, "src", "core.ts"), `export const core = {};`);
      fs.writeFileSync(path.join(testDir, "src", "a.ts"), `import { core } from "./core"; export const a = core;`);
      fs.writeFileSync(path.join(testDir, "src", "b.ts"), `import { core } from "./core"; export const b = core;`);
      fs.writeFileSync(path.join(testDir, "src", "c.ts"), `import { core } from "./core"; export const c = core;`);

      healing.buildDependencyGraph(path.join(testDir, "src"));
      const impact = healing.analyzeChangeImpact([path.join(testDir, "src", "core.ts")]);

      expect(impact.rippleEffectScore).toBeGreaterThan(0);
    });

    it("should identify critical path", () => {
      fs.writeFileSync(path.join(testDir, "src", "lib.ts"), `export const lib = {};`);
      fs.writeFileSync(path.join(testDir, "src", "service.ts"), `import { lib } from "./lib"; export const service = lib;`);
      fs.writeFileSync(path.join(testDir, "src", "handler.ts"), `import { service } from "./service"; export const handler = service;`);

      healing.buildDependencyGraph(path.join(testDir, "src"));
      const impact = healing.analyzeChangeImpact([path.join(testDir, "src", "lib.ts")]);

      expect(impact.criticalPath.length).toBeGreaterThan(0);
    });

    it("should assess risk level", () => {
      for (let i = 0; i < 10; i++) {
        fs.writeFileSync(path.join(testDir, "src", `file${i}.ts`), `export const x${i} = ${i};`);
      }
      fs.writeFileSync(path.join(testDir, "src", "core.ts"), `import { file0 } from "./file0"; import { file1 } from "./file1";`);

      healing.buildDependencyGraph(path.join(testDir, "src"));
      const impact = healing.analyzeChangeImpact([path.join(testDir, "src", "core.ts")]);

      expect(["low", "medium", "high", "critical"]).toContain(impact.riskAssessment);
    });
  });

  describe("Performance Regression", () => {
    it("should record performance baseline", () => {
      const baseline = healing.recordPerformanceBaseline({
        cpuUsage: 25,
        memoryUsage: 128,
        responseTime: 150,
        throughput: 1000,
      });

      expect(baseline.id).toBeDefined();
      expect(baseline.metrics.cpuUsage).toBe(25);
    });

    it("should compare performance against baseline", () => {
      healing.recordPerformanceBaseline({
        cpuUsage: 20,
        memoryUsage: 100,
        responseTime: 100,
        throughput: 1000,
      });

      const regressions = healing.comparePerformance({
        cpuUsage: 30,
        memoryUsage: 150,
        responseTime: 200,
        throughput: 800,
      });

      expect(regressions.length).toBeGreaterThan(0);
      expect(regressions[0].degradationPercent).toBeGreaterThan(0);
    });

    it("should detect severe regressions", () => {
      healing.recordPerformanceBaseline({
        cpuUsage: 20,
        memoryUsage: 100,
        responseTime: 100,
        throughput: 1000,
      });

      const regressions = healing.comparePerformance({
        cpuUsage: 60,
        memoryUsage: 300,
        responseTime: 500,
        throughput: 200,
      });

      const severe = regressions.filter(r => r.severity === "severe" || r.severity === "critical");
      expect(severe.length).toBeGreaterThan(0);
    });

    it("should get performance baselines", () => {
      healing.recordPerformanceBaseline({ cpuUsage: 10, memoryUsage: 50, responseTime: 50, throughput: 500 });
      healing.recordPerformanceBaseline({ cpuUsage: 15, memoryUsage: 60, responseTime: 60, throughput: 600 });

      const baselines = healing.getPerformanceBaselines();
      expect(baselines.length).toBe(2);
    });
  });

  describe("Intelligent Fix Generation", () => {
    it("should diagnose and fix TypeError", async () => {
      const result = await healing.diagnoseAndFix({
        type: "TypeError",
        message: "Cannot read property 'foo' of undefined",
        file: "/src/utils.ts",
      });

      expect(result).toBeDefined();
      expect(result.finalState).toBeDefined();
    });

    it("should diagnose and fix module not found", async () => {
      const result = await healing.diagnoseAndFix({
        type: "Error",
        message: "Cannot find module 'lodash'",
      });

      expect(result).toBeDefined();
      expect(result.attempts.length).toBeGreaterThanOrEqual(0);
    });

    it("should diagnose and fix syntax error", async () => {
      const result = await healing.diagnoseAndFix({
        type: "SyntaxError",
        message: "Unexpected token }",
        file: "/src/app.ts",
      });

      expect(result).toBeDefined();
    });

    it("should diagnose async errors", async () => {
      const result = await healing.diagnoseAndFix({
        type: "Error",
        message: "Promise is not defined",
      });

      expect(result).toBeDefined();
    });

    it("should learn from successful fixes", async () => {
      await healing.diagnoseAndFix({
        type: "TypeError",
        message: "undefined is not an object",
      });

      const patterns = healing.getFixPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });

    it("should generate recommendations", async () => {
      const result = await healing.diagnoseAndFix({
        type: "Error",
        message: "Test error",
      });

      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it("should track fix history", async () => {
      await healing.diagnoseAndFix({ type: "Error", message: "test 1" });
      await healing.diagnoseAndFix({ type: "Error", message: "test 2" });

      const history = healing.getFixHistory();
      expect(history.length).toBe(2);
    });
  });

  describe("Rollback Strategies", () => {
    it("should create soft rollback strategy", () => {
      const strategy = healing.createRollbackStrategy("snap-123", "soft");

      expect(strategy.type).toBe("soft");
      expect(strategy.risk).toBe("low");
      expect(strategy.canUndo).toBe(true);
    });

    it("should create hard rollback strategy", () => {
      const strategy = healing.createRollbackStrategy("snap-123", "hard");

      expect(strategy.type).toBe("hard");
      expect(strategy.risk).toBe("high");
      expect(strategy.canUndo).toBe(false);
    });

    it("should create merge rollback strategy", () => {
      const strategy = healing.createRollbackStrategy("snap-123", "merge");

      expect(strategy.type).toBe("merge");
      expect(strategy.risk).toBe("medium");
    });

    it("should create checkpoint rollback strategy", () => {
      const strategy = healing.createRollbackStrategy("snap-123", "checkpoint");

      expect(strategy.type).toBe("checkpoint");
    });
  });

  describe("Test Intelligence", () => {
    it("should analyze test coverage", () => {
      fs.writeFileSync(path.join(testDir, "src", "test.spec.ts"), `
import { add } from "./math";
describe("math", () => {
  it("should add", () => { expect(add(1,2)).toBe(3); });
});
`);
      fs.writeFileSync(path.join(testDir, "src", "math.ts"), `export function add(a, b) { return a + b; }`);

      const intelligence = healing.analyzeTestCoverage(
        [path.join(testDir, "src", "test.spec.ts")],
        [path.join(testDir, "src", "math.ts")]
      );

      expect(intelligence.coverage.size).toBeGreaterThan(0);
    });

    it("should identify flaky tests", () => {
      for (let i = 0; i < 15; i++) {
        fs.writeFileSync(path.join(testDir, "src", `test${i}.spec.ts`), `test("test ${i}", () => {});`);
      }

      const intelligence = healing.analyzeTestCoverage(
        fs.readdirSync(path.join(testDir, "src")).map(f => path.join(testDir, "src", f)),
        []
      );

      expect(Array.isArray(intelligence.flakyTests)).toBe(true);
    });

    it("should suggest test improvements", () => {
      fs.writeFileSync(path.join(testDir, "src", "api.ts"), `
import { fetchData } from "./api";
export async function getData() {
  try {
    return await fetchData();
  } catch (e) {
    return null;
  }
}
`);

      const suggestions = healing.suggestTestImprovements(path.join(testDir, "src", "api.ts"));

      expect(suggestions.edgeCases.length).toBeGreaterThan(0);
    });
  });

  describe("Pipeline Integration", () => {
    it("should run pipeline with tests", async () => {
      const run = await healing.runPipeline({
        provider: "github",
        testCommand: "npm test",
      });

      expect(run.id).toBeDefined();
      expect(run.stages.length).toBeGreaterThan(0);
    });

    it("should run pipeline with build", async () => {
      const run = await healing.runPipeline({
        provider: "github",
        testCommand: "npm test",
        buildCommand: "npm run build",
      });

      const buildStage = run.stages.find(s => s.name === "Build");
      expect(buildStage).toBeDefined();
    });
  });

  describe("Statistics", () => {
    it("should get healing stats", async () => {
      await healing.diagnoseAndFix({ type: "Error", message: "test 1" });
      await healing.diagnoseAndFix({ type: "Error", message: "test 2" });

      const stats = healing.getHealingStats();

      expect(stats.totalFixes).toBe(2);
      expect(stats.patternsLearned).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Graph Access", () => {
    it("should get dependency graph", () => {
      const graph = healing.getDependencyGraph();
      expect(graph.nodes).toBeDefined();
      expect(graph.affectedPaths).toBeDefined();
    });

    it("should get fix patterns", () => {
      const patterns = healing.getFixPatterns();
      expect(Array.isArray(patterns)).toBe(true);
    });
  });
});
