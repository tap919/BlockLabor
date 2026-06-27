/**
 * Marathon Session Manager for OverCoat.
 *
 * Provides tools for deep, long-duration coding sessions:
 * - Automatic checkpoint snapshots of session context
 * - Break reminders to maintain developer wellbeing
 * - Session statistics (duration, tokens used, files touched)
 * - Context continuity across interruptions
 */

export interface SessionCheckpoint {
  id: string;
  timestamp: number;
  label: string;
  context: Record<string, unknown>;
  tokenCount: number;
  filesModified: string[];
}

export interface MarathonSessionConfig {
  /** Name for this session */
  name: string;
  /** How often (in minutes) to create automatic checkpoints */
  checkpointIntervalMinutes: number;
  /** How often (in minutes) to remind the developer to take a break */
  breakReminderMinutes: number;
  /** Maximum session duration in hours before a forced summary is generated */
  maxDurationHours: number;
}

export interface SessionStats {
  name: string;
  startedAt: number;
  durationMs: number;
  checkpoints: number;
  totalTokens: number;
  filesModified: string[];
  breaksTaken: number;
}

const DEFAULT_CONFIG: MarathonSessionConfig = {
  name: "overcoat-session",
  checkpointIntervalMinutes: 30,
  breakReminderMinutes: 90,
  maxDurationHours: 8,
};

export type BreakReminderHandler = (sessionDurationMs: number) => void;
export type CheckpointHandler = (checkpoint: SessionCheckpoint) => void;

/**
 * MarathonSession tracks the state of an extended coding session and
 * surfaces reminders and checkpoints to keep developers productive
 * during long runs.
 */
export class MarathonSession {
  private config: MarathonSessionConfig;
  private startedAt: number;
  private checkpoints: SessionCheckpoint[] = [];
  private totalTokens = 0;
  private filesModified: Set<string> = new Set();
  private breaksTaken = 0;

  private breakReminderTimer: ReturnType<typeof setInterval> | null = null;
  private checkpointTimer: ReturnType<typeof setInterval> | null = null;

  private breakReminderHandlers: BreakReminderHandler[] = [];
  private checkpointHandlers: CheckpointHandler[] = [];

  constructor(config: Partial<MarathonSessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startedAt = Date.now();
  }

  /** Start the session timers for break reminders and auto-checkpoints.
   * Calling start() when already running is a no-op. */
  start(): void {
    if (this.breakReminderTimer !== null || this.checkpointTimer !== null) {
      return; // already started — avoid creating duplicate timer leaks
    }

    const breakMs = this.config.breakReminderMinutes * 60 * 1000;
    const checkpointMs = this.config.checkpointIntervalMinutes * 60 * 1000;

    this.breakReminderTimer = setInterval(() => {
      const duration = Date.now() - this.startedAt;
      for (const handler of this.breakReminderHandlers) {
        handler(duration);
      }
    }, breakMs);

    this.checkpointTimer = setInterval(() => {
      this.createCheckpoint("auto");
    }, checkpointMs);
  }

  /** Stop all session timers. */
  stop(): void {
    if (this.breakReminderTimer !== null) {
      clearInterval(this.breakReminderTimer);
      this.breakReminderTimer = null;
    }
    if (this.checkpointTimer !== null) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
  }

  /** Register a handler that fires when a break reminder triggers. */
  onBreakReminder(handler: BreakReminderHandler): void {
    this.breakReminderHandlers.push(handler);
  }

  /** Register a handler that fires when a checkpoint is created. */
  onCheckpoint(handler: CheckpointHandler): void {
    this.checkpointHandlers.push(handler);
  }

  /**
   * Create a named checkpoint of the current session context.
   * Context can hold arbitrary metadata about the current task.
   */
  createCheckpoint(
    label: string,
    context: Record<string, unknown> = {},
  ): SessionCheckpoint {
    const checkpoint: SessionCheckpoint = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      label,
      context,
      tokenCount: this.totalTokens,
      filesModified: Array.from(this.filesModified),
    };
    this.checkpoints.push(checkpoint);
    for (const handler of this.checkpointHandlers) {
      handler(checkpoint);
    }
    return checkpoint;
  }

  /** Record tokens consumed during this session. */
  recordTokens(count: number): void {
    this.totalTokens += count;
  }

  /** Record that a file was modified. */
  recordFileModified(filePath: string): void {
    this.filesModified.add(filePath);
  }

  /** Acknowledge that a break was taken (resets the break timer). */
  acknowledgeBreak(): void {
    if (this.breakReminderTimer === null) {
      throw new Error(
        'Cannot acknowledge a break before the session has been started. Call start() first.'
      );
    }

    this.breaksTaken++;
    // Restart the break reminder timer from now
    clearInterval(this.breakReminderTimer);
    const breakMs = this.config.breakReminderMinutes * 60 * 1000;
    this.breakReminderTimer = setInterval(() => {
      const duration = Date.now() - this.startedAt;
      for (const handler of this.breakReminderHandlers) {
        handler(duration);
      }
    }, breakMs);
  }

  /** Get the latest checkpoint, or undefined if none exist. */
  getLatestCheckpoint(): SessionCheckpoint | undefined {
    return this.checkpoints[this.checkpoints.length - 1];
  }

  /** Get all checkpoints. */
  getAllCheckpoints(): SessionCheckpoint[] {
    return [...this.checkpoints];
  }

  /** Get a summary of the current session statistics. */
  getStats(): SessionStats {
    return {
      name: this.config.name,
      startedAt: this.startedAt,
      durationMs: Date.now() - this.startedAt,
      checkpoints: this.checkpoints.length,
      totalTokens: this.totalTokens,
      filesModified: Array.from(this.filesModified),
      breaksTaken: this.breaksTaken,
    };
  }

  /**
   * Return true if the session has exceeded the configured maximum duration.
   * Useful for triggering a forced summary and handoff.
   */
  isOverMaxDuration(): boolean {
    const maxMs = this.config.maxDurationHours * 60 * 60 * 1000;
    return Date.now() - this.startedAt > maxMs;
  }

  /** Get the session configuration. */
  get sessionConfig(): MarathonSessionConfig {
    return { ...this.config };
  }
}
