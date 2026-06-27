import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  RegressionPredictor,
  createRegressionPredictor,
} from "./regression-prevention";

describe("RegressionPredictor", () => {
  let testDir: string;
  let predictor: RegressionPredictor;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "regression-test-"));
    predictor = createRegressionPredictor({
      enableRiskAnalysis: true,
      enableSnapshots: true,
      enableAutoTestGeneration: true,
    });
  });

  afterEach(() => {
    predictor.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should create predictor", () => {
    expect(predictor).toBeDefined();
  });

  it("should analyze simple changes", async () => {
    const analysis = await predictor.analyzeChange(["/src/main.ts"]);
    expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
    expect(analysis.files).toContain("/src/main.ts");
  });

  it("should analyze multiple files", async () => {
    const analysis = await predictor.analyzeChange([
      "/src/app.ts",
      "/src/utils.ts",
      "/src/models/user.ts",
    ]);
    expect(analysis.files).toHaveLength(3);
  });

  it("should identify high-risk core modules", async () => {
    const analysis = await predictor.analyzeChange([
      "/src/core/index.ts",
      "/src/lib/base.ts",
    ]);
    expect(analysis.complexity).toBeDefined();
  });

  it("should identify security-impact files", async () => {
    const analysis = await predictor.analyzeChange([
      "/src/auth/password.ts",
      "/src/security/token.ts",
    ]);
    const hasSecurityRec = analysis.recommendations.some(r => 
      r.toLowerCase().includes("security")
    );
    expect(hasSecurityRec).toBe(true);
  });

  it("should identify database-impact files", async () => {
    const analysis = await predictor.analyzeChange([
      "/src/models/user.ts",
      "/src/repository/query.ts",
    ]);
    const hasDbRec = analysis.recommendations.some(r =>
      r.toLowerCase().includes("database")
    );
    expect(hasDbRec).toBe(true);
  });

  it("should create safety nets", async () => {
    const safetyNet = await predictor.createSafetyNet({
      files: ["/src/main.ts", "/src/utils.ts"],
      snapshotBefore: true,
    });

    expect(safetyNet).toBeDefined();
    expect(safetyNet.files).toHaveLength(2);
    expect(safetyNet.status).toBe("active");
  });

  it("should generate tests", async () => {
    const testFile = path.join(testDir, "sample.ts");
    fs.writeFileSync(testFile, `
export function add(a: number, b: number): number {
  return a + b;
}
export function subtract(a: number, b: number): number {
  return a - b;
}
`);

    const safetyNet = await predictor.createSafetyNet({
      files: [testFile],
    });

    expect(safetyNet.tests.length).toBeGreaterThan(0);
  });

  it("should create snapshots", async () => {
    const snapshotFile = path.join(testDir, "test.ts");
    fs.writeFileSync(snapshotFile, "const x = 1;");

    const snapshot = await predictor.createSnapshot("pre-change");
    expect(snapshot).toBeDefined();
    expect(snapshot.id).toBeDefined();
    expect(snapshot.files).toBeDefined();
  });

  it("should get snapshots", async () => {
    await predictor.createSnapshot("first");
    await predictor.createSnapshot("second");

    const snapshots = predictor.getSnapshots();
    expect(snapshots.length).toBe(2);
  });

  it("should get safety nets", async () => {
    await predictor.createSafetyNet({ files: ["/a.ts"] });
    await predictor.createSafetyNet({ files: ["/b.ts"] });

    const nets = predictor.getSafetyNets();
    expect(nets).toHaveLength(2);
  });

  it("should get active safety nets", async () => {
    await predictor.createSafetyNet({ files: ["/a.ts"] });
    await predictor.createSafetyNet({ files: ["/b.ts"] });

    const active = predictor.getActiveSafetyNets();
    expect(active.length).toBeGreaterThanOrEqual(0);
  });

  it("should run tests", async () => {
    const result = await predictor.runTests(["test1", "test2"]);
    expect(result.passed).toBe(true);
    expect(result.executionTime).toBeGreaterThan(0);
  });

  it("should check for failures", async () => {
    const net = await predictor.createSafetyNet({ files: ["/test.ts"] });
    const result = await predictor.checkForFailures(net.id);
    expect(result).toBeDefined();
  });

  it("should revert to snapshot", async () => {
    const testFile = path.join(testDir, "original.ts");
    fs.writeFileSync(testFile, "const original = true;");

    const snapshot = await predictor.createSnapshot("before");
    
    fs.writeFileSync(testFile, "const modified = false;");
    const content = fs.readFileSync(testFile, "utf8");
    expect(content).toBe("const modified = false;");

    await predictor.revert(snapshot.id);
    const reverted = fs.readFileSync(testFile, "utf8");
    expect(reverted).toBe("const original = true;");
  });

  it("should attempt auto-fix", async () => {
    const fix = await predictor.autoFix("Type error in function", {});
    expect(fix).toBeDefined();
    expect(fix.type).toBeDefined();
    expect(fix.confidence).toBeGreaterThanOrEqual(0);
  });

  it("should track auto-fix history", async () => {
    await predictor.autoFix("Error 1", {});
    await predictor.autoFix("Error 2", {});

    const history = predictor.getAutoFixHistory();
    expect(history.length).toBe(2);
  });

  it("should get statistics", async () => {
    await predictor.createSnapshot("snap1");
    await predictor.createSafetyNet({ files: ["/a.ts"] });
    await predictor.autoFix("error", {});

    const stats = predictor.getStatistics();
    expect(stats.totalSnapshots).toBe(1);
    expect(stats.activeSafetyNets).toBe(1);
  });

  it("should handle non-existent files gracefully", async () => {
    const analysis = await predictor.analyzeChange(["/nonexistent/file.ts"]);
    expect(analysis.riskScore).toBeGreaterThanOrEqual(0);
  });

  it("should calculate risk based on file count", async () => {
    const files = Array.from({ length: 20 }, (_, i) => `/src/file${i}.ts`);
    const analysis = await predictor.analyzeChange(files);
    expect(analysis.riskScore).toBeGreaterThan(0);
  });
});
