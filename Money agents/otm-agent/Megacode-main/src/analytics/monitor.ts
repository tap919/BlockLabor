/**
 * Analytics & Monitoring for OverCoat.
 *
 * Implementation plan for analytics and monitoring features:
 *
 * 1. Resource Dashboard
 *    - Real-time CPU/memory/network usage per process
 *    - Historical data collection with configurable retention
 *    - Implementation: process.cpuUsage()/memoryUsage() polling,
 *      time-series data storage, aggregation functions (avg/max/min/p99),
 *      TUI rendering with blessed/ink or WebSocket push to IDE
 *
 * 2. Cost Estimation
 *    - "This AWS command will cost approximately $X"
 *    - Token usage cost tracking for LLM providers
 *    - Implementation: Provider-specific pricing tables (OpenAI, Anthropic,
 *      DeepSeek, etc.), token counting per request/response,
 *      session cost accumulator, budget alerts
 *
 * 3. Performance Benchmarking
 *    - Compare command execution times across runs
 *    - Track build/test/deploy performance over time
 *    - Implementation: High-resolution timing (process.hrtime.bigint()),
 *      benchmark storage with tags, statistical comparison (mean, stddev),
 *      regression detection via configurable thresholds
 *
 * 4. Dependency Graph Visualizer
 *    - See how changes affect your entire stack
 *    - Import/require graph for code, dependency tree for packages
 *    - Implementation: AST parsing for import resolution,
 *      package.json/requirements.txt/Cargo.toml parsing,
 *      graph data structure with DOT/Mermaid export
 */

/** A single data point in a time series. */
export interface DataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

/** Resource usage metrics for a single sample. */
export interface ResourceMetrics {
  /** CPU usage in microseconds (user + system). */
  cpuMicroseconds: number;
  /** Heap memory used in bytes. */
  heapUsedBytes: number;
  /** Heap total in bytes. */
  heapTotalBytes: number;
  /** RSS (Resident Set Size) in bytes. */
  rssBytes: number;
  /** External memory in bytes. */
  externalBytes: number;
  /** Timestamp of the sample. */
  timestamp: number;
}

/** LLM provider cost information. */
export interface ProviderPricing {
  provider: string;
  model: string;
  /** Cost per 1K input tokens in USD. */
  inputCostPer1K: number;
  /** Cost per 1K output tokens in USD. */
  outputCostPer1K: number;
}

/** Cost estimate for a request or session. */
export interface CostEstimate {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Estimated cost in USD. */
  estimatedCostUSD: number;
}

/** A benchmark result for a single command/operation. */
export interface BenchmarkResult {
  /** The operation being benchmarked (e.g., "npm run build"). */
  operation: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Timestamp of the benchmark run. */
  timestamp: number;
  /** Optional tags for categorization. */
  tags: string[];
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

/** Statistical summary of benchmark runs. */
export interface BenchmarkSummary {
  operation: string;
  runs: number;
  meanMs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  stddevMs: number;
  /** Trend direction compared to previous runs. */
  trend: "improving" | "stable" | "degrading";
}

/** A node in a dependency graph. */
export interface DependencyNode {
  /** Module/package name. */
  name: string;
  /** Version if known. */
  version?: string;
  /** Type of dependency (e.g., "npm-package", "local-module", "import"). */
  type: string;
  /** File path for local modules. */
  filePath?: string;
}

/** An edge in a dependency graph. */
export interface DependencyEdge {
  /** Source node name. */
  from: string;
  /** Target node name. */
  to: string;
  /** Relationship type (e.g., "imports", "depends-on", "dev-depends-on"). */
  relationship: string;
}

/** Complete dependency graph. */
export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  /** Root node (entry point). */
  root?: string;
}

export interface MonitorConfig {
  /** How often to sample resource metrics (ms). Default: 5000. */
  sampleIntervalMs: number;
  /** Maximum data points to retain per metric. Default: 1000. */
  maxDataPoints: number;
  /** Known provider pricing data. */
  pricing: ProviderPricing[];
}

const DEFAULT_PRICING: ProviderPricing[] = [
  { provider: "deepseek", model: "deepseek-chat", inputCostPer1K: 0.00014, outputCostPer1K: 0.00028 },
  { provider: "deepseek", model: "deepseek-coder", inputCostPer1K: 0.00014, outputCostPer1K: 0.00028 },
  { provider: "gemini", model: "gemini-pro", inputCostPer1K: 0.0005, outputCostPer1K: 0.0015 },
  { provider: "ollama", model: "llama3", inputCostPer1K: 0, outputCostPer1K: 0 },
  { provider: "ollama", model: "codellama", inputCostPer1K: 0, outputCostPer1K: 0 },
];

const DEFAULT_CONFIG: MonitorConfig = {
  sampleIntervalMs: 5000,
  maxDataPoints: 1000,
  pricing: DEFAULT_PRICING,
};

/**
 * ResourceDashboard collects and exposes real-time resource metrics.
 */
export class ResourceDashboard {
  private config: MonitorConfig;
  private samples: ResourceMetrics[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Take a single resource metrics sample. */
  sample(): ResourceMetrics {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const metrics: ResourceMetrics = {
      cpuMicroseconds: cpu.user + cpu.system,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      rssBytes: mem.rss,
      externalBytes: mem.external,
      timestamp: Date.now(),
    };
    this.samples.push(metrics);
    if (this.samples.length > this.config.maxDataPoints) {
      this.samples.shift();
    }
    return metrics;
  }

  /** Start automatic sampling. */
  startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(
      () => this.sample(),
      this.config.sampleIntervalMs
    );
  }

  /** Stop automatic sampling. */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Get all collected samples. */
  getSamples(): ResourceMetrics[] {
    return [...this.samples];
  }

  /** Get the latest sample. */
  getLatest(): ResourceMetrics | null {
    return this.samples.length > 0
      ? this.samples[this.samples.length - 1]
      : null;
  }
}

/**
 * CostEstimator tracks LLM token usage and estimates costs.
 */
export class CostEstimator {
  private pricing: ProviderPricing[];
  private sessionCosts: CostEstimate[] = [];

  constructor(pricing: ProviderPricing[] = DEFAULT_PRICING) {
    this.pricing = pricing;
  }

  /** Estimate cost for a given request. */
  estimate(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): CostEstimate {
    const priceInfo = this.pricing.find(
      (p) => p.provider === provider && p.model === model
    );
    const inputCost = priceInfo
      ? (inputTokens / 1000) * priceInfo.inputCostPer1K
      : 0;
    const outputCost = priceInfo
      ? (outputTokens / 1000) * priceInfo.outputCostPer1K
      : 0;

    const estimate: CostEstimate = {
      provider,
      model,
      inputTokens,
      outputTokens,
      estimatedCostUSD: Math.round((inputCost + outputCost) * 1000000) / 1000000,
    };
    this.sessionCosts.push(estimate);
    return estimate;
  }

  /** Get total session cost so far. */
  getSessionTotal(): number {
    return this.sessionCosts.reduce(
      (sum, e) => sum + e.estimatedCostUSD,
      0
    );
  }

  /** Get all cost estimates for the session. */
  getSessionCosts(): CostEstimate[] {
    return [...this.sessionCosts];
  }

  /** Reset session cost tracking. */
  resetSession(): void {
    this.sessionCosts = [];
  }
}

/**
 * PerformanceBenchmarker records and compares execution times.
 */
export class PerformanceBenchmarker {
  private results: BenchmarkResult[] = [];

  /** Record a benchmark result. */
  record(
    operation: string,
    durationMs: number,
    tags: string[] = []
  ): BenchmarkResult {
    const result: BenchmarkResult = {
      operation,
      durationMs,
      timestamp: Date.now(),
      tags,
    };
    this.results.push(result);
    return result;
  }

  /** Get a statistical summary for an operation. */
  summarize(operation: string): BenchmarkSummary | null {
    const runs = this.results.filter((r) => r.operation === operation);
    if (runs.length === 0) return null;

    const durations = runs.map((r) => r.durationMs).sort((a, b) => a - b);
    const mean =
      durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];
    const min = durations[0];
    const max = durations[durations.length - 1];
    const variance =
      durations.reduce((sum, d) => sum + (d - mean) ** 2, 0) /
      durations.length;
    const stddev = Math.sqrt(variance);

    // Simple trend detection: compare last 3 to first 3
    let trend: "improving" | "stable" | "degrading" = "stable";
    if (runs.length >= 6) {
      const earlyAvg =
        runs.slice(0, 3).reduce((s, r) => s + r.durationMs, 0) / 3;
      const lateAvg =
        runs.slice(-3).reduce((s, r) => s + r.durationMs, 0) / 3;
      const changePct = ((lateAvg - earlyAvg) / earlyAvg) * 100;
      if (changePct > 10) trend = "degrading";
      else if (changePct < -10) trend = "improving";
    }

    return {
      operation,
      runs: runs.length,
      meanMs: Math.round(mean * 100) / 100,
      medianMs: median,
      minMs: min,
      maxMs: max,
      stddevMs: Math.round(stddev * 100) / 100,
      trend,
    };
  }

  /** Get all benchmark results. */
  getResults(): BenchmarkResult[] {
    return [...this.results];
  }
}

/**
 * DependencyGraphBuilder constructs and queries dependency graphs.
 */
export class DependencyGraphBuilder {
  private nodes: Map<string, DependencyNode> = new Map();
  private edges: DependencyEdge[] = [];

  /** Add a node to the graph. */
  addNode(node: DependencyNode): void {
    this.nodes.set(node.name, node);
  }

  /** Add an edge (dependency relationship). */
  addEdge(edge: DependencyEdge): void {
    this.edges.push(edge);
  }

  /** Get direct dependents of a node (what depends on it). */
  getDependents(name: string): string[] {
    return this.edges
      .filter((e) => e.to === name)
      .map((e) => e.from);
  }

  /** Get direct dependencies of a node. */
  getDependencies(name: string): string[] {
    return this.edges
      .filter((e) => e.from === name)
      .map((e) => e.to);
  }

  /** Build the complete graph structure. */
  build(root?: string): DependencyGraph {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: [...this.edges],
      root,
    };
  }

  /** Export graph in Mermaid diagram format. */
  toMermaid(): string {
    const lines = ["graph TD"];
    for (const edge of this.edges) {
      const label = edge.relationship;
      lines.push(`  ${edge.from} -->|${label}| ${edge.to}`);
    }
    return lines.join("\n");
  }

  /**
   * Export graph in Graphviz DOT format.
   * The output can be rendered with `dot -Tpng graph.dot -o graph.png`.
   */
  toDot(): string {
    const escape = (str: string) => str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const lines = ["digraph dependencies {", "  node [shape=box];"];
    // Add node labels
    for (const node of this.nodes.values()) {
      const label = node.version ? `${node.name}@${node.version}` : node.name;
      lines.push(`  "${escape(node.name)}" [label="${escape(label)}"];`);
    }
    // Add edges
    for (const edge of this.edges) {
      lines.push(`  "${escape(edge.from)}" -> "${escape(edge.to)}" [label="${escape(edge.relationship)}"];`);
    }
    lines.push("}");
    return lines.join("\n");
  }

  /**
   * Detect cycles in the dependency graph using depth-first search.
   * Returns arrays of node names forming each cycle found.
   */
  findCycles(): string[][] {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      if (stack.has(node)) {
        // Found a cycle — extract it from the current path
        const cycleStart = path.indexOf(node);
        cycles.push(path.slice(cycleStart));
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      for (const dep of this.getDependencies(node)) {
        dfs(dep, [...path, node]);
      }

      stack.delete(node);
    };

    for (const node of this.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }
}
