import {
  ResourceDashboard,
  CostEstimator,
  PerformanceBenchmarker,
  DependencyGraphBuilder,
} from "./monitor";

describe("ResourceDashboard", () => {
  it("takes a resource sample", () => {
    const dashboard = new ResourceDashboard();
    const sample = dashboard.sample();
    expect(sample.heapUsedBytes).toBeGreaterThan(0);
    expect(sample.timestamp).toBeGreaterThan(0);
  });

  it("returns latest sample", () => {
    const dashboard = new ResourceDashboard();
    expect(dashboard.getLatest()).toBeNull();
    dashboard.sample();
    expect(dashboard.getLatest()).not.toBeNull();
  });

  it("stores multiple samples", () => {
    const dashboard = new ResourceDashboard();
    dashboard.sample();
    dashboard.sample();
    expect(dashboard.getSamples()).toHaveLength(2);
  });
});

describe("CostEstimator", () => {
  const estimator = new CostEstimator();

  it("estimates zero cost for local models", () => {
    const est = estimator.estimate("ollama", "llama3", 1000, 500);
    expect(est.estimatedCostUSD).toBe(0);
  });

  it("estimates non-zero cost for API models", () => {
    const est = estimator.estimate("deepseek", "deepseek-chat", 1000, 500);
    expect(est.estimatedCostUSD).toBeGreaterThan(0);
  });

  it("tracks session costs", () => {
    const e = new CostEstimator();
    e.estimate("deepseek", "deepseek-chat", 1000, 500);
    e.estimate("deepseek", "deepseek-chat", 2000, 1000);
    expect(e.getSessionTotal()).toBeGreaterThan(0);
    expect(e.getSessionCosts()).toHaveLength(2);
  });

  it("resets session costs", () => {
    const e = new CostEstimator();
    e.estimate("deepseek", "deepseek-chat", 1000, 500);
    e.resetSession();
    expect(e.getSessionTotal()).toBe(0);
  });
});

describe("PerformanceBenchmarker", () => {
  it("records benchmark results", () => {
    const bench = new PerformanceBenchmarker();
    const result = bench.record("npm run build", 1500);
    expect(result.operation).toBe("npm run build");
    expect(result.durationMs).toBe(1500);
  });

  it("summarizes benchmarks", () => {
    const bench = new PerformanceBenchmarker();
    bench.record("build", 100);
    bench.record("build", 150);
    bench.record("build", 200);
    const summary = bench.summarize("build");
    expect(summary).not.toBeNull();
    expect(summary!.runs).toBe(3);
    expect(summary!.meanMs).toBe(150);
    expect(summary!.minMs).toBe(100);
    expect(summary!.maxMs).toBe(200);
  });

  it("returns null for unknown operations", () => {
    const bench = new PerformanceBenchmarker();
    expect(bench.summarize("unknown")).toBeNull();
  });
});

describe("DependencyGraphBuilder", () => {
  it("builds a graph with nodes and edges", () => {
    const builder = new DependencyGraphBuilder();
    builder.addNode({ name: "app", type: "local-module" });
    builder.addNode({ name: "lodash", type: "npm-package", version: "4.17" });
    builder.addEdge({ from: "app", to: "lodash", relationship: "depends-on" });

    const graph = builder.build("app");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.root).toBe("app");
  });

  it("finds dependents", () => {
    const builder = new DependencyGraphBuilder();
    builder.addNode({ name: "A", type: "module" });
    builder.addNode({ name: "B", type: "module" });
    builder.addEdge({ from: "A", to: "B", relationship: "imports" });

    expect(builder.getDependents("B")).toEqual(["A"]);
    expect(builder.getDependencies("A")).toEqual(["B"]);
  });

  it("exports Mermaid format", () => {
    const builder = new DependencyGraphBuilder();
    builder.addEdge({ from: "A", to: "B", relationship: "imports" });
    const mermaid = builder.toMermaid();
    expect(mermaid).toContain("graph TD");
    expect(mermaid).toContain("A -->|imports| B");
  });
});

describe("DependencyGraphBuilder - toDot and findCycles", () => {
  it("exports DOT format", () => {
    const builder = new DependencyGraphBuilder();
    builder.addNode({ name: "app", type: "local-module" });
    builder.addNode({ name: "utils", type: "local-module" });
    builder.addEdge({ from: "app", to: "utils", relationship: "imports" });
    const dot = builder.toDot();
    expect(dot).toContain("digraph dependencies");
    expect(dot).toContain('"app"');
    expect(dot).toContain('"utils"');
    expect(dot).toContain('"app" -> "utils"');
  });

  it("includes version in DOT node labels", () => {
    const builder = new DependencyGraphBuilder();
    builder.addNode({ name: "lodash", type: "npm-package", version: "4.17.21" });
    const dot = builder.toDot();
    expect(dot).toContain("lodash@4.17.21");
  });

  it("detects no cycles in a DAG", () => {
    const builder = new DependencyGraphBuilder();
    builder.addNode({ name: "A", type: "module" });
    builder.addNode({ name: "B", type: "module" });
    builder.addNode({ name: "C", type: "module" });
    builder.addEdge({ from: "A", to: "B", relationship: "imports" });
    builder.addEdge({ from: "B", to: "C", relationship: "imports" });
    expect(builder.findCycles()).toHaveLength(0);
  });

  it("detects a direct cycle", () => {
    const builder = new DependencyGraphBuilder();
    builder.addNode({ name: "A", type: "module" });
    builder.addNode({ name: "B", type: "module" });
    builder.addEdge({ from: "A", to: "B", relationship: "imports" });
    builder.addEdge({ from: "B", to: "A", relationship: "imports" });
    const cycles = builder.findCycles();
    expect(cycles.length).toBeGreaterThan(0);
  });

  it("escapes quotes in DOT output", () => {
    const builder = new DependencyGraphBuilder();
    builder.addNode({ name: 'my"package', type: "npm-package" });
    const dot = builder.toDot();
    // Should not produce unescaped quotes that break DOT syntax
    expect(dot).toContain('\\"package');
    expect(dot).not.toMatch(/"my"package"/);
  });

  it("escapes backslashes in DOT output", () => {
    const builder = new DependencyGraphBuilder();
    builder.addEdge({ from: "A\\B", to: "C", relationship: "uses" });
    const dot = builder.toDot();
    expect(dot).toContain('"A\\\\B"');
  });
});
