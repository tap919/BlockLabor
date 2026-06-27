/**
 * Metrics & Improvement for OverCoat.
 *
 * Implementation plan for metrics and continuous improvement:
 *
 * 1. Team Analytics
 *    - See productivity patterns across your organization
 *    - Aggregate usage data across team members
 *    - Implementation: Per-user metric collection, team aggregation,
 *      anonymized trend analysis, configurable reporting periods,
 *      dashboard-ready data export (JSON/CSV)
 *
 * 2. Skill Development
 *    - Suggests new commands to learn based on usage
 *    - Identifies skill gaps and recommends learning paths
 *    - Implementation: Command knowledge graph with difficulty levels,
 *      user proficiency tracking, personalized recommendations,
 *      progressive challenges, skill badges
 *
 * 3. Performance Regression Detection
 *    - "This command is 30% slower than last week"
 *    - Automatic performance baseline and drift detection
 *    - Implementation: Rolling performance baselines per command,
 *      statistical significance testing (t-test/z-score),
 *      configurable alert thresholds, history comparison,
 *      root cause hints (system load, dependency changes)
 *
 * 4. Resource Leak Detection
 *    - Finds zombie processes and memory leaks
 *    - Monitors process lifecycle and resource consumption
 *    - Implementation: Process tree monitoring, orphan detection,
 *      memory growth trend analysis, file descriptor tracking,
 *      automatic cleanup recommendations, alert system
 */

import { EventEmitter } from "events";

/** Metrics for a single team member. */
export interface UserMetrics {
  userId: string;
  /** Total commands executed. */
  commandCount: number;
  /** Unique commands used. */
  uniqueCommands: number;
  /** Total active time in minutes. */
  activeMinutes: number;
  /** Most used commands. */
  topCommands: Array<{ command: string; count: number }>;
  /** Time period these metrics cover. */
  period: { start: number; end: number };
}

/** Aggregated team metrics. */
export interface TeamMetrics {
  /** Number of team members. */
  memberCount: number;
  /** Total commands across the team. */
  totalCommands: number;
  /** Average commands per member. */
  avgCommandsPerMember: number;
  /** Most popular commands across the team. */
  topTeamCommands: Array<{ command: string; count: number }>;
  /** Time period. */
  period: { start: number; end: number };
}

/** A skill recommendation. */
export interface SkillRecommendation {
  /** The command/tool to learn. */
  command: string;
  /** Why this skill is recommended. */
  reason: string;
  /** Difficulty level. */
  difficulty: "beginner" | "intermediate" | "advanced";
  /** Category (e.g., "git", "shell", "docker", "debugging"). */
  category: string;
  /** Learning resources. */
  resources: string[];
  /** Estimated learning time in minutes. */
  estimatedMinutes: number;
}

/** A performance regression alert. */
export interface RegressionAlert {
  /** The command/operation. */
  operation: string;
  /** Current average duration (ms). */
  currentMs: number;
  /** Baseline average duration (ms). */
  baselineMs: number;
  /** Percentage change. */
  changePercent: number;
  /** Whether this is statistically significant. */
  significant: boolean;
  /** When this regression was detected. */
  detectedAt: number;
  /** Possible causes. */
  possibleCauses: string[];
}

/** A detected resource leak. */
export interface ResourceLeak {
  /** Process ID if applicable. */
  pid?: number;
  /** Type of leak (e.g., "zombie-process", "memory-growth", "fd-leak"). */
  type: string;
  /** Description. */
  description: string;
  /** Severity (1-10). */
  severity: number;
  /** Recommended action. */
  recommendation: string;
  /** When detected. */
  detectedAt: number;
}

/** Performance data point for regression analysis. */
export interface PerformanceDataPoint {
  operation: string;
  durationMs: number;
  timestamp: number;
  /** System load at the time. */
  systemLoad?: number;
}

export interface MetricsConfig {
  /** How many data points to retain per operation for regression analysis. */
  maxDataPointsPerOperation: number;
  /** Percentage change threshold to trigger regression alerts. */
  regressionThresholdPercent: number;
  /** Minimum number of samples needed for regression analysis. */
  minSamplesForRegression: number;
}

const DEFAULT_CONFIG: MetricsConfig = {
  maxDataPointsPerOperation: 100,
  regressionThresholdPercent: 20,
  minSamplesForRegression: 5,
};

/**
 * TeamAnalytics collects and aggregates usage metrics across team members.
 */
export class TeamAnalytics {
  private userMetrics: Map<string, UserMetrics> = new Map();

  /** Record activity for a user. */
  recordActivity(
    userId: string,
    command: string
  ): void {
    let metrics = this.userMetrics.get(userId);
    if (!metrics) {
      metrics = {
        userId,
        commandCount: 0,
        uniqueCommands: 0,
        activeMinutes: 0,
        topCommands: [],
        period: { start: Date.now(), end: Date.now() },
      };
      this.userMetrics.set(userId, metrics);
    }

    metrics.commandCount++;
    metrics.period.end = Date.now();

    // Update top commands
    const existing = metrics.topCommands.find((tc) => tc.command === command);
    if (existing) {
      existing.count++;
    } else {
      metrics.topCommands.push({ command, count: 1 });
      metrics.uniqueCommands++;
    }

    // Sort top commands
    metrics.topCommands.sort((a, b) => b.count - a.count);
    if (metrics.topCommands.length > 20) {
      metrics.topCommands = metrics.topCommands.slice(0, 20);
    }
  }

  /** Get metrics for a specific user. */
  getUserMetrics(userId: string): UserMetrics | null {
    return this.userMetrics.get(userId) ?? null;
  }

  /** Get aggregated team metrics. */
  getTeamMetrics(): TeamMetrics {
    const users = Array.from(this.userMetrics.values());
    const totalCommands = users.reduce(
      (sum, u) => sum + u.commandCount,
      0
    );

    // Aggregate top commands
    const commandCounts = new Map<string, number>();
    for (const user of users) {
      for (const tc of user.topCommands) {
        commandCounts.set(
          tc.command,
          (commandCounts.get(tc.command) ?? 0) + tc.count
        );
      }
    }

    const topTeamCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      memberCount: users.length,
      totalCommands,
      avgCommandsPerMember:
        users.length > 0 ? Math.round(totalCommands / users.length) : 0,
      topTeamCommands,
      period: {
        start: Math.min(...users.map((u) => u.period.start)),
        end: Math.max(...users.map((u) => u.period.end)),
      },
    };
  }
}

/**
 * SkillTracker identifies skill gaps and recommends learning paths.
 */
export class SkillTracker {
  private knownCommands: Set<string> = new Set();
  private commandCategories: Map<string, string> = new Map();

  constructor() {
    // Initialize command categories
    const categories: Record<string, string[]> = {
      git: ["git", "gh"],
      shell: ["ls", "cd", "cat", "grep", "find", "awk", "sed", "xargs", "sort", "uniq"],
      docker: ["docker", "docker-compose", "podman"],
      network: ["curl", "wget", "ssh", "scp", "rsync", "ping", "dig"],
      debugging: ["gdb", "strace", "ltrace", "valgrind", "perf"],
      node: ["npm", "npx", "node", "yarn", "pnpm"],
      python: ["python", "pip", "pytest", "flask", "django-admin"],
    };

    for (const [category, commands] of Object.entries(categories)) {
      for (const cmd of commands) {
        this.commandCategories.set(cmd, category);
      }
    }
  }

  /** Record that the user has used a command. */
  recordUsage(command: string): void {
    const program = command.split(/\s+/)[0];
    this.knownCommands.add(program);
  }

  /** Get skill recommendations based on current usage. */
  getRecommendations(): SkillRecommendation[] {
    const recommendations: SkillRecommendation[] = [];

    // Recommend commands in categories the user uses but hasn't explored fully
    if (this.knownCommands.has("git") && !this.knownCommands.has("gh")) {
      recommendations.push({
        command: "gh",
        reason: "You use git frequently. The GitHub CLI (gh) can streamline PR and issue workflows.",
        difficulty: "intermediate",
        category: "git",
        resources: ["https://cli.github.com/manual/"],
        estimatedMinutes: 30,
      });
    }

    if (this.knownCommands.has("grep") && !this.knownCommands.has("awk")) {
      recommendations.push({
        command: "awk",
        reason: "You use grep for text search. awk provides powerful text processing for structured data.",
        difficulty: "advanced",
        category: "shell",
        resources: [],
        estimatedMinutes: 60,
      });
    }

    if (this.knownCommands.has("docker") && !this.knownCommands.has("docker-compose")) {
      recommendations.push({
        command: "docker-compose",
        reason: "You use Docker. docker-compose simplifies multi-container applications.",
        difficulty: "intermediate",
        category: "docker",
        resources: [],
        estimatedMinutes: 45,
      });
    }

    if (
      (this.knownCommands.has("docker") || this.knownCommands.has("docker-compose")) &&
      !this.knownCommands.has("kubectl")
    ) {
      recommendations.push({
        command: "kubectl",
        reason: "You work with containers. kubectl lets you manage production workloads on Kubernetes.",
        difficulty: "advanced",
        category: "docker",
        resources: ["https://kubernetes.io/docs/reference/kubectl/"],
        estimatedMinutes: 90,
      });
    }

    if (this.knownCommands.has("npm") && !this.knownCommands.has("tsc")) {
      recommendations.push({
        command: "tsc",
        reason: "You use npm. Adding TypeScript (tsc) improves code safety with static type checking.",
        difficulty: "intermediate",
        category: "node",
        resources: ["https://www.typescriptlang.org/docs/"],
        estimatedMinutes: 60,
      });
    }

    if (this.knownCommands.has("curl") && !this.knownCommands.has("jq")) {
      recommendations.push({
        command: "jq",
        reason: "You use curl for API calls. jq makes it easy to filter and transform JSON responses.",
        difficulty: "intermediate",
        category: "network",
        resources: ["https://jqlang.github.io/jq/manual/"],
        estimatedMinutes: 20,
      });
    }

    if (this.knownCommands.has("find") && !this.knownCommands.has("fd")) {
      recommendations.push({
        command: "fd",
        reason: "You use find. fd is a faster, friendlier alternative with simpler syntax.",
        difficulty: "beginner",
        category: "shell",
        resources: ["https://github.com/sharkdp/fd"],
        estimatedMinutes: 10,
      });
    }

    if (
      (this.knownCommands.has("cat") || this.knownCommands.has("grep")) &&
      !this.knownCommands.has("bat")
    ) {
      recommendations.push({
        command: "bat",
        reason: "You use cat/grep frequently. bat adds syntax highlighting and line numbers to cat.",
        difficulty: "beginner",
        category: "shell",
        resources: ["https://github.com/sharkdp/bat"],
        estimatedMinutes: 10,
      });
    }

    if (this.knownCommands.has("python") && !this.knownCommands.has("pytest")) {
      recommendations.push({
        command: "pytest",
        reason: "You use Python. pytest is the standard testing framework with rich plugin ecosystem.",
        difficulty: "intermediate",
        category: "python",
        resources: ["https://docs.pytest.org/"],
        estimatedMinutes: 45,
      });
    }

    if (this.knownCommands.has("ssh") && !this.knownCommands.has("tmux")) {
      recommendations.push({
        command: "tmux",
        reason: "You use SSH. tmux keeps sessions alive when connections drop and enables window splitting.",
        difficulty: "intermediate",
        category: "network",
        resources: ["https://github.com/tmux/tmux/wiki"],
        estimatedMinutes: 30,
      });
    }

    return recommendations;
  }

  /** Get a summary of the user's skill profile. */
  getProfile(): { knownCommands: string[]; categories: string[] } {
    const categories = new Set<string>();
    for (const cmd of this.knownCommands) {
      const cat = this.commandCategories.get(cmd);
      if (cat) categories.add(cat);
    }
    return {
      knownCommands: Array.from(this.knownCommands),
      categories: Array.from(categories),
    };
  }
}

/**
 * RegressionDetector monitors command performance and alerts
 * when significant regressions are detected.
 */
export class RegressionDetector extends EventEmitter {
  private config: MetricsConfig;
  private data: Map<string, PerformanceDataPoint[]> = new Map();

  constructor(config: Partial<MetricsConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Record a performance data point. */
  record(operation: string, durationMs: number): void {
    let points = this.data.get(operation);
    if (!points) {
      points = [];
      this.data.set(operation, points);
    }

    points.push({ operation, durationMs, timestamp: Date.now() });

    // Trim to max size
    if (points.length > this.config.maxDataPointsPerOperation) {
      points.shift();
    }

    // Check for regressions
    const alert = this.checkRegression(operation);
    if (alert) {
      this.emit("regression", alert);
    }
  }

  /** Check for performance regression in an operation. */
  checkRegression(operation: string): RegressionAlert | null {
    const points = this.data.get(operation);
    if (
      !points ||
      points.length < this.config.minSamplesForRegression * 2
    ) {
      return null;
    }

    const mid = Math.floor(points.length / 2);
    const baselinePoints = points.slice(0, mid);
    const recentPoints = points.slice(mid);

    const baselineAvg =
      baselinePoints.reduce((s, p) => s + p.durationMs, 0) /
      baselinePoints.length;
    const recentAvg =
      recentPoints.reduce((s, p) => s + p.durationMs, 0) /
      recentPoints.length;

    const changePercent =
      baselineAvg > 0
        ? ((recentAvg - baselineAvg) / baselineAvg) * 100
        : 0;

    if (changePercent > this.config.regressionThresholdPercent) {
      return {
        operation,
        currentMs: Math.round(recentAvg),
        baselineMs: Math.round(baselineAvg),
        changePercent: Math.round(changePercent * 10) / 10,
        significant: true,
        detectedAt: Date.now(),
        possibleCauses: [
          "System load may have increased",
          "Recent dependency changes",
          "Larger dataset or input size",
        ],
      };
    }

    return null;
  }

  /** Get performance summary for an operation. */
  getSummary(
    operation: string
  ): { avg: number; min: number; max: number; samples: number } | null {
    const points = this.data.get(operation);
    if (!points || points.length === 0) return null;

    const durations = points.map((p) => p.durationMs);
    return {
      avg:
        Math.round(
          (durations.reduce((s, d) => s + d, 0) / durations.length) * 100
        ) / 100,
      min: Math.min(...durations),
      max: Math.max(...durations),
      samples: durations.length,
    };
  }
}

/**
 * LeakDetector monitors for resource leaks like zombie processes
 * and memory growth.
 */
export class LeakDetector {
  private memorySamples: Array<{ heapUsed: number; timestamp: number }> = [];
  private maxSamples: number;

  constructor(maxSamples: number = 60) {
    this.maxSamples = maxSamples;
  }

  /** Take a memory sample. */
  sampleMemory(): void {
    const mem = process.memoryUsage();
    this.memorySamples.push({
      heapUsed: mem.heapUsed,
      timestamp: Date.now(),
    });
    if (this.memorySamples.length > this.maxSamples) {
      this.memorySamples.shift();
    }
  }

  /**
   * Detect potential memory leaks by analyzing growth trend.
   */
  detectMemoryLeaks(): ResourceLeak | null {
    if (this.memorySamples.length < 10) return null;

    const firstHalf = this.memorySamples.slice(
      0,
      Math.floor(this.memorySamples.length / 2)
    );
    const secondHalf = this.memorySamples.slice(
      Math.floor(this.memorySamples.length / 2)
    );

    const firstAvg =
      firstHalf.reduce((s, m) => s + m.heapUsed, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((s, m) => s + m.heapUsed, 0) / secondHalf.length;

    const growthPercent =
      firstAvg > 0
        ? ((secondAvg - firstAvg) / firstAvg) * 100
        : 0;

    if (growthPercent > 50) {
      return {
        type: "memory-growth",
        description: `Memory usage has grown ${growthPercent.toFixed(1)}% over the monitoring period`,
        severity: growthPercent > 100 ? 9 : 6,
        recommendation:
          "Check for event listener leaks, unclosed connections, or growing data structures",
        detectedAt: Date.now(),
      };
    }

    return null;
  }

  /** Get memory usage trend. */
  getMemoryTrend(): {
    samples: number;
    firstMB: number;
    lastMB: number;
    growthPercent: number;
  } | null {
    if (this.memorySamples.length < 2) return null;

    const first = this.memorySamples[0].heapUsed;
    const last = this.memorySamples[this.memorySamples.length - 1].heapUsed;

    return {
      samples: this.memorySamples.length,
      firstMB: Math.round((first / 1024 / 1024) * 100) / 100,
      lastMB: Math.round((last / 1024 / 1024) * 100) / 100,
      growthPercent:
        first > 0
          ? Math.round(((last - first) / first) * 10000) / 100
          : 0,
    };
  }
}
