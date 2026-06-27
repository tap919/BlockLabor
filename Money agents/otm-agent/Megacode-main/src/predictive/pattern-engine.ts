/**
 * Predictive & Adaptive Features for OverCoat.
 *
 * Implementation plan for predictive intelligence:
 *
 * 1. Usage Pattern Learning
 *    - Learns developer workflow and creates shortcuts automatically
 *    - Tracks command sequences, timing, and frequency
 *    - Builds a probabilistic model of developer behavior
 *    - Implementation: Markov chain on command sequences, frequency counters,
 *      time-of-day patterns, auto-alias generation for frequent sequences
 *
 * 2. Command Prediction
 *    - Like fish shell on steroids, predicting multi-step workflows
 *    - Suggests next command based on context and history
 *    - Learns project-specific workflows (e.g., build → test → deploy)
 *    - Implementation: N-gram model on command history, project-type templates,
 *      real-time suggestion via IDE integration or terminal hooks
 *
 * 3. Resource Optimization
 *    - Suggests when to parallelize tasks based on system load
 *    - Monitors CPU/memory usage and recommends batch scheduling
 *    - Implementation: os.cpus()/process.memoryUsage() polling,
 *      task queue with priority scheduling, parallel execution hints
 *
 * 4. Error Prediction
 *    - Warns about commands that might fail before execution
 *    - Checks preconditions (file existence, permissions, dependencies)
 *    - Implementation: Pre-execution validation hooks, dependency checks,
 *      historical failure pattern matching, environment state analysis
 */

import { EventEmitter } from "events";

/** A recorded usage pattern (sequence of actions). */
export interface UsagePattern {
  /** Unique pattern identifier. */
  id: string;
  /** Ordered sequence of commands in this pattern. */
  sequence: string[];
  /** How many times this pattern has been observed. */
  frequency: number;
  /** Average time between commands in the sequence (ms). */
  avgIntervalMs: number;
  /** When this pattern was last seen. */
  lastSeen: number;
  /** Auto-generated shortcut, if any. */
  shortcut?: string;
}

/** A command prediction with confidence. */
export interface CommandPrediction {
  /** The predicted command. */
  command: string;
  /** Confidence score 0-1. */
  confidence: number;
  /** Source of the prediction (e.g., "history", "pattern", "project-type"). */
  source: string;
  /** Additional context for the prediction. */
  context?: string;
}

/** System resource snapshot. */
export interface ResourceSnapshot {
  /** CPU usage percentage (0-100). */
  cpuPercent: number;
  /** Memory usage in MB. */
  memoryUsedMB: number;
  /** Total memory in MB. */
  memoryTotalMB: number;
  /** Number of active processes. */
  activeProcesses: number;
  /** Timestamp of the snapshot. */
  timestamp: number;
}

/** An optimization suggestion based on resource analysis. */
export interface OptimizationHint {
  type: "parallelize" | "defer" | "batch" | "reduce-load";
  message: string;
  /** The tasks/commands this hint applies to. */
  targets: string[];
  /** Priority of this hint (higher = more important). */
  priority: number;
}

/** A predicted error with mitigation steps. */
export interface ErrorPrediction {
  /** The command that might fail. */
  command: string;
  /** The predicted failure reason. */
  reason: string;
  /** Likelihood of failure 0-1. */
  likelihood: number;
  /** Suggested mitigation steps. */
  mitigations: string[];
}

export interface PatternEngineConfig {
  /** Minimum frequency to recognize a pattern. */
  minPatternFrequency: number;
  /** Maximum sequence length to track. */
  maxSequenceLength: number;
  /** How many recent commands to analyze for predictions. */
  predictionWindowSize: number;
  /** Enable resource monitoring. */
  resourceMonitoring: boolean;
  /** Resource polling interval in milliseconds. */
  resourcePollIntervalMs: number;
}

const DEFAULT_CONFIG: PatternEngineConfig = {
  minPatternFrequency: 3,
  maxSequenceLength: 5,
  predictionWindowSize: 10,
  resourceMonitoring: false,
  resourcePollIntervalMs: 5000,
};

/**
 * PatternEngine learns developer workflows, predicts commands,
 * optimizes resource usage, and warns about potential errors.
 */
export class PatternEngine extends EventEmitter {
  private config: PatternEngineConfig;
  private commandHistory: Array<{ command: string; timestamp: number }> = [];
  private patterns: Map<string, UsagePattern> = new Map();
  private resourcePollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: Partial<PatternEngineConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Record a command execution for pattern learning.
   */
  recordCommand(command: string): void {
    this.commandHistory.push({ command, timestamp: Date.now() });
    this.detectPatterns();
  }

  /**
   * Get the current list of detected usage patterns.
   */
  getPatterns(): UsagePattern[] {
    return Array.from(this.patterns.values()).filter(
      (p) => p.frequency >= this.config.minPatternFrequency
    );
  }

  /**
   * Predict the next command based on recent history.
   */
  predictNext(): CommandPrediction[] {
    const predictions: CommandPrediction[] = [];
    const recent = this.commandHistory.slice(
      -this.config.predictionWindowSize
    );

    if (recent.length === 0) return predictions;

    const lastCommand = recent[recent.length - 1].command;

    // Check known patterns for next-step predictions
    for (const pattern of this.patterns.values()) {
      const idx = pattern.sequence.indexOf(lastCommand);
      if (idx >= 0 && idx < pattern.sequence.length - 1) {
        predictions.push({
          command: pattern.sequence[idx + 1],
          confidence: Math.min(
            0.95,
            pattern.frequency / (this.config.minPatternFrequency * 3)
          ),
          source: "pattern",
          context: `Part of pattern: ${pattern.sequence.join(" → ")}`,
        });
      }
    }

    // Sort by confidence descending
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Take a resource snapshot and generate optimization hints.
   */
  async analyzeResources(): Promise<{
    snapshot: ResourceSnapshot;
    hints: OptimizationHint[];
  }> {
    const memUsage = process.memoryUsage();
    const snapshot: ResourceSnapshot = {
      cpuPercent: 0, // Would need os.cpus() polling to calculate
      memoryUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      memoryTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      activeProcesses: 1,
      timestamp: Date.now(),
    };

    const hints: OptimizationHint[] = [];

    // Memory pressure check
    const memPercent =
      snapshot.memoryTotalMB > 0
        ? (snapshot.memoryUsedMB / snapshot.memoryTotalMB) * 100
        : 0;
    if (memPercent > 80) {
      hints.push({
        type: "reduce-load",
        message: `Memory usage is at ${memPercent.toFixed(0)}%. Consider deferring non-critical tasks.`,
        targets: [],
        priority: 8,
      });
    }

    return { snapshot, hints };
  }

  /**
   * Predict potential errors for a command before execution.
   */
  predictErrors(command: string): ErrorPrediction[] {
    const predictions: ErrorPrediction[] = [];

    // Check for common error patterns from history
    const failures = this.commandHistory.filter(
      (h) => h.command === command
    );

    // Check for dangerous commands
    if (command.includes("rm -rf /") || command.includes("rm -rf ~")) {
      predictions.push({
        command,
        reason: "Destructive command targeting root or home directory",
        likelihood: 0.99,
        mitigations: ["Use a more specific path", "Add --dry-run first"],
      });
    }

    // Check for missing dependencies
    if (command.startsWith("npm run") || command.startsWith("yarn")) {
      predictions.push({
        command,
        reason:
          "Ensure node_modules is installed (run npm install if needed)",
        likelihood: 0.3,
        mitigations: ["Run 'npm install' first", "Check package.json exists"],
      });
    }

    return predictions;
  }

  /**
   * Start resource monitoring (polling system stats).
   */
  startResourceMonitoring(): void {
    if (this.resourcePollTimer || !this.config.resourceMonitoring) return;
    this.resourcePollTimer = setInterval(async () => {
      const result = await this.analyzeResources();
      if (result.hints.length > 0) {
        this.emit("optimization-hint", result.hints);
      }
    }, this.config.resourcePollIntervalMs);
  }

  /**
   * Stop resource monitoring.
   */
  stopResourceMonitoring(): void {
    if (this.resourcePollTimer) {
      clearInterval(this.resourcePollTimer);
      this.resourcePollTimer = null;
    }
  }

  /**
   * Detect patterns in the command history using sliding window.
   */
  private detectPatterns(): void {
    const commands = this.commandHistory.map((h) => h.command);
    if (commands.length < 2) return;

    // Sliding window for sequences of length 2..maxSequenceLength
    for (
      let len = 2;
      len <= Math.min(this.config.maxSequenceLength, commands.length);
      len++
    ) {
      for (let i = 0; i <= commands.length - len; i++) {
        const sequence = commands.slice(i, i + len);
        const key = sequence.join(" | ");
        const existing = this.patterns.get(key);

        if (existing) {
          existing.frequency++;
          existing.lastSeen = Date.now();
        } else {
          this.patterns.set(key, {
            id: key,
            sequence,
            frequency: 1,
            avgIntervalMs: 0,
            lastSeen: Date.now(),
          });
        }
      }
    }
  }
}
