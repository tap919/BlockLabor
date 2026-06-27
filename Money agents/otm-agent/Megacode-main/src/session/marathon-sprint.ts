/**
 * Marathon Sprint System for OverCoat.
 *
 * Enhances marathon sessions with features designed for long coding sprints:
 * - Sprint/Goal decomposition and progress tracking
 * - Energy/focus management with smart break suggestions
 * - Quality gates at checkpoints
 * - Context switching detection
 * - Momentum preservation
 * - Session analytics
 */

import * as path from "path";
import { DiskMemoryBank, ONE_GIB } from "../memory/disk-bank";
import {
  MarathonSession,
  SessionCheckpoint,
  MarathonSessionConfig,
} from "./marathon";
import {
  MarathonMemoryBridge,
  MarathonMemoryConfig,
  SessionContext,
  DecisionRecord,
  CodeSnippet,
  PendingWork,
} from "./marathon-memory";

export interface SprintGoal {
  id: string;
  title: string;
  description: string;
  subTasks: SubTask[];
  priority: "high" | "medium" | "low";
  status: "pending" | "in_progress" | "completed" | "blocked";
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDurationMs?: number;
  actualDurationMs?: number;
}

export interface SubTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  completedAt?: number;
  filePath?: string;
}

export interface FocusSession {
  id: string;
  goalId: string;
  startedAt: number;
  endedAt?: number;
  interruptions: number;
  contextSwitches: number;
  tokensUsed: number;
  filesModified: string[];
  qualityGatesPassed: boolean;
}

export interface EnergyLevel {
  level: "high" | "medium" | "low" | "depleted";
  score: number;
  lastActivityAt: number;
  trend: "rising" | "stable" | "falling";
}

export interface QualityGate {
  id: string;
  name: string;
  type: "test" | "lint" | "typecheck" | "build" | "custom";
  command?: string;
  status: "pending" | "passed" | "failed" | "skipped";
  output?: string;
  runAt: number;
}

export interface ContextSwitch {
  fromFile: string;
  toFile: string;
  timestamp: number;
  reason?: string;
}

export interface ProductivityMetrics {
  totalFocusTimeMs: number;
  totalBreakTimeMs: number;
  averageFocusScore: number;
  contextSwitchCount: number;
  qualityGatePassRate: number;
  tasksCompleted: number;
  tasksStarted: number;
  peakFocusHour: number;
  mostProductiveDay: string;
}

export interface MarathonSprintConfig extends MarathonMemoryConfig {
  enableEnergyTracking?: boolean;
  enableQualityGates?: boolean;
  enableContextSwitchDetection?: boolean;
  focusSessionDurationMinutes?: number;
  maxContextSwitchesPerHour?: number;
  qualityGateCommands?: QualityGateConfig[];
}

export interface QualityGateConfig {
  name: string;
  type: "test" | "lint" | "typecheck" | "build";
  command: string;
  required: boolean;
}

export interface SprintSessionStats {
  session: {
    active: boolean;
    durationMs: number;
    goals: SprintGoal[];
    activeGoal?: SprintGoal;
  };
  focus: {
    currentSession?: FocusSession;
    totalFocusSessions: number;
    averageSessionLengthMs: number;
    interruptions: number;
  };
  energy: EnergyLevel;
  context: {
    switches: ContextSwitch[];
    switchesLastHour: number;
  };
  quality: {
    gates: QualityGate[];
    passRate: number;
  };
  productivity: ProductivityMetrics;
}

const DEFAULT_SPRINT_CONFIG: Required<MarathonSprintConfig> = {
  bankDir: ".overcoat/marathon-sprint",
  capacityBytes: ONE_GIB,
  sessionConfig: {},
  autoSaveIntervalMs: 5 * 60 * 1000,
  maxContextSnapshots: 100,
  enableEnergyTracking: true,
  enableQualityGates: true,
  enableContextSwitchDetection: true,
  focusSessionDurationMinutes: 25,
  maxContextSwitchesPerHour: 10,
  qualityGateCommands: [
    { name: "Type Check", type: "typecheck", command: "npx tsc --noEmit", required: true },
    { name: "Lint", type: "lint", command: "npx eslint .", required: false },
  ],
};

const GOAL_PREFIX = "marathon:goal:";
const FOCUS_PREFIX = "marathon:focus:";
const ENERGY_PREFIX = "marathon:energy:";
const QUALITY_PREFIX = "marathon:quality:";

export class MarathonSprint extends MarathonMemoryBridge {
  private sprintConfig: Required<MarathonSprintConfig>;
  private goals: SprintGoal[] = [];
  private activeGoalId: string | null = null;
  private focusSessions: FocusSession[] = [];
  private activeFocusSession: FocusSession | null = null;
  private energyLevel: EnergyLevel;
  private qualityGates: QualityGate[] = [];
  private contextSwitches: ContextSwitch[] = [];
  private lastFileInFocus: string | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private energyCheckInterval: ReturnType<typeof setInterval> | null = null;
  private activityTimestamps: number[] = [];

  constructor(config: MarathonSprintConfig = {}) {
    const mergedConfig = { ...DEFAULT_SPRINT_CONFIG, ...config };
    super(mergedConfig);
    this.sprintConfig = mergedConfig;
    this.energyLevel = {
      level: "high",
      score: 100,
      lastActivityAt: Date.now(),
      trend: "stable",
    };
  }

  override open(): void {
    super.open();
    this._startEnergyTracking();
  }

  override close(): void {
    this._stopFocusSession();
    this._stopEnergyTracking();
    super.close();
  }

  setGoal(
    title: string,
    description: string,
    priority: "high" | "medium" | "low" = "medium",
    estimatedDurationMs?: number
  ): SprintGoal {
    const goal: SprintGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      description,
      subTasks: [],
      priority,
      status: "pending",
      createdAt: Date.now(),
      estimatedDurationMs,
    };

    this.goals.push(goal);
    this._saveGoal(goal);
    this._recordActivity();

    return goal;
  }

  addSubTask(goalId: string, title: string, filePath?: string): SubTask | null {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return null;

    const subTask: SubTask = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      status: "pending",
      filePath,
    };

    goal.subTasks.push(subTask);
    this._saveGoal(goal);
    this._recordActivity();

    return subTask;
  }

  startGoal(goalId: string): SprintGoal | null {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal || goal.status === "completed") return null;

    if (this.activeGoalId && this.activeGoalId !== goalId) {
      this.pauseGoal(this.activeGoalId);
    }

    this.activeGoalId = goalId;
    goal.status = "in_progress";
    goal.startedAt = Date.now();
    this._saveGoal(goal);
    this._startFocusSession(goalId);
    this._recordActivity();

    return goal;
  }

  pauseGoal(goalId: string): SprintGoal | null {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return null;

    goal.status = "pending";
    if (goal.startedAt && !goal.completedAt) {
      const elapsed = Date.now() - goal.startedAt;
      goal.actualDurationMs = (goal.actualDurationMs || 0) + elapsed;
    }
    this._saveGoal(goal);

    if (this.activeGoalId === goalId) {
      this._stopFocusSession();
      this.activeGoalId = null;
    }

    return goal;
  }

  completeGoal(goalId: string): SprintGoal | null {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return null;

    goal.status = "completed";
    goal.completedAt = Date.now();
    if (goal.startedAt) {
      const elapsed = goal.completedAt - goal.startedAt;
      goal.actualDurationMs = (goal.actualDurationMs || 0) + elapsed;
    }
    this._saveGoal(goal);

    if (this.activeGoalId === goalId) {
      this._stopFocusSession();
      this.activeGoalId = null;
    }

    this._runQualityGates();
    this._recordActivity();

    return goal;
  }

  completeSubTask(goalId: string, subTaskId: string): boolean {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal) return false;

    const subTask = goal.subTasks.find(s => s.id === subTaskId);
    if (!subTask) return false;

    subTask.status = "completed";
    subTask.completedAt = Date.now();

    const allCompleted = goal.subTasks.every(s => s.status === "completed");
    if (allCompleted && goal.status !== "completed") {
      this.completeGoal(goalId);
    } else {
      this._saveGoal(goal);
    }

    this._recordActivity();
    return true;
  }

  getGoals(): SprintGoal[] {
    return [...this.goals];
  }

  getActiveGoal(): SprintGoal | undefined {
    return this.goals.find(g => g.id === this.activeGoalId);
  }

  getGoalProgress(goalId: string): number {
    const goal = this.goals.find(g => g.id === goalId);
    if (!goal || goal.subTasks.length === 0) return 0;

    const completed = goal.subTasks.filter(s => s.status === "completed").length;
    return Math.round((completed / goal.subTasks.length) * 100);
  }

  getOverallProgress(): number {
    if (this.goals.length === 0) return 0;

    const totalTasks = this.goals.reduce((sum, g) => sum + g.subTasks.length, 0);
    if (totalTasks === 0) {
      const completed = this.goals.filter(g => g.status === "completed").length;
      return Math.round((completed / this.goals.length) * 100);
    }

    const completedTasks = this.goals.reduce(
      (sum, g) => sum + g.subTasks.filter(s => s.status === "completed").length,
      0
    );
    return Math.round((completedTasks / totalTasks) * 100);
  }

  private _startFocusSession(goalId: string): void {
    if (this.activeFocusSession) {
      this._stopFocusSession();
    }

    this.activeFocusSession = {
      id: `focus-${Date.now()}`,
      goalId,
      startedAt: Date.now(),
      interruptions: 0,
      contextSwitches: 0,
      tokensUsed: 0,
      filesModified: [],
      qualityGatesPassed: false,
    };

    const durationMs = this.sprintConfig.focusSessionDurationMinutes * 60 * 1000;
    this.focusTimer = setTimeout(() => {
      this._onFocusSessionComplete();
    }, durationMs);
  }

  private _stopFocusSession(): void {
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }

    if (this.activeFocusSession) {
      this.activeFocusSession.endedAt = Date.now();
      this.focusSessions.push(this.activeFocusSession);
      this._saveFocusSession(this.activeFocusSession);
      this.activeFocusSession = null;
    }
  }

  private _onFocusSessionComplete(): void {
    if (!this.activeFocusSession) return;

    this._stopFocusSession();
    this._updateEnergy(-5);

    if (this.activeGoalId) {
      const suggestion = this.getBreakSuggestion();
      if (suggestion.shouldBreak) {
        this._triggerBreakSuggestion(suggestion);
      }
    }
  }

  recordContextSwitch(toFile: string, reason?: string): void {
    const fromFile = this.lastFileInFocus;
    this.lastFileInFocus = toFile;

    if (!fromFile || fromFile === toFile) return;

    const switchEvent: ContextSwitch = {
      fromFile,
      toFile,
      timestamp: Date.now(),
      reason,
    };

    this.contextSwitches.push(switchEvent);
    if (this.contextSwitches.length > 100) {
      this.contextSwitches.shift();
    }

    if (this.activeFocusSession) {
      this.activeFocusSession.contextSwitches++;
    }

    if (this.sprintConfig.enableContextSwitchDetection) {
      const switchesLastHour = this._getContextSwitchesLastHour();
      if (switchesLastHour > this.sprintConfig.maxContextSwitchesPerHour) {
        this._triggerContextSwitchWarning(switchesLastHour);
      }
    }

    this._recordActivity();
  }

  private _getContextSwitchesLastHour(): number {
    const oneHourAgo = Date.now() - 3600000;
    return this.contextSwitches.filter(s => s.timestamp > oneHourAgo).length;
  }

  private _triggerContextSwitchWarning(switchCount: number): void {
    console.warn(
      `[MarathonSprint] High context switching detected: ${switchCount} switches in the last hour. ` +
      `This may impact productivity. Consider focusing on one task at a time.`
    );
  }

  private _triggerBreakSuggestion(suggestion: BreakSuggestion): void {
    console.log(
      `[MarathonSprint] ${suggestion.message}`
    );
  }

  private _startEnergyTracking(): void {
    if (!this.sprintConfig.enableEnergyTracking) return;

    this.energyCheckInterval = setInterval(() => {
      this._updateEnergy(-1);
    }, 60000);
  }

  private _stopEnergyTracking(): void {
    if (this.energyCheckInterval) {
      clearInterval(this.energyCheckInterval);
      this.energyCheckInterval = null;
    }
  }

  private _updateEnergy(delta: number): void {
    const prevScore = this.energyLevel.score;
    this.energyLevel.score = Math.max(0, Math.min(100, this.energyLevel.score + delta));

    if (this.energyLevel.score > prevScore) {
      this.energyLevel.trend = "rising";
    } else if (this.energyLevel.score < prevScore) {
      this.energyLevel.trend = "falling";
    } else {
      this.energyLevel.trend = "stable";
    }

    if (this.energyLevel.score >= 70) {
      this.energyLevel.level = "high";
    } else if (this.energyLevel.score >= 40) {
      this.energyLevel.level = "medium";
    } else if (this.energyLevel.score >= 20) {
      this.energyLevel.level = "low";
    } else {
      this.energyLevel.level = "depleted";
    }

    this.energyLevel.lastActivityAt = Date.now();
  }

  private _recordActivity(): void {
    this.activityTimestamps.push(Date.now());
    if (this.activityTimestamps.length > 60) {
      this.activityTimestamps.shift();
    }
    this._updateEnergy(2);
  }

  acknowledgeBreak(): void {
    super.acknowledgeBreak();
    this._updateEnergy(20);
    this.activityTimestamps = [];
  }

  getEnergyLevel(): EnergyLevel {
    return { ...this.energyLevel };
  }

  getBreakSuggestion(): BreakSuggestion {
    const energy = this.energyLevel;
    const sessionStats = this.getSessionStats();
    const durationMs = sessionStats?.sessionDurationMs || 0;
    const durationMinutes = Math.floor(durationMs / 60000);

    let shouldBreak = false;
    let message = "";
    let breakDurationMinutes = 5;

    if (energy.level === "depleted") {
      shouldBreak = true;
      message = "Energy depleted. Take a longer break (15-20 minutes).";
      breakDurationMinutes = 15;
    } else if (energy.level === "low") {
      shouldBreak = true;
      message = "Energy is low. Consider a short break (5-10 minutes).";
      breakDurationMinutes = 10;
    } else if (durationMinutes >= 90 && durationMinutes % 30 < 5) {
      shouldBreak = true;
      message = "You've been coding for over 90 minutes. Take a break to maintain focus.";
      breakDurationMinutes = 10;
    } else if (this._getContextSwitchesLastHour() > this.sprintConfig.maxContextSwitchesPerHour) {
      shouldBreak = true;
      message = "High context switching detected. A break may help reset focus.";
      breakDurationMinutes = 5;
    }

    return { shouldBreak, message, breakDurationMinutes, energyLevel: energy.level };
  }

  private async _runQualityGates(): Promise<QualityGate[]> {
    if (!this.sprintConfig.enableQualityGates || !this.sprintConfig.qualityGateCommands.length) {
      return [];
    }

    const results: QualityGate[] = [];

    for (const gateConfig of this.sprintConfig.qualityGateCommands) {
      const gate: QualityGate = {
        id: `gate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: gateConfig.name,
        type: gateConfig.type,
        command: gateConfig.command,
        status: "pending",
        runAt: Date.now(),
      };

      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        const result = await execAsync(gateConfig.command, { timeout: 120000 });
        gate.status = "passed";
        gate.output = result.stdout + result.stderr;
      } catch (error) {
        gate.status = "failed";
        gate.output = error instanceof Error ? error.message : "Unknown error";
      }

      this.qualityGates.push(gate);
      results.push(gate);
    }

    if (this.activeFocusSession) {
      const allPassed = results.every(r => r.status === "passed" || !this.sprintConfig.qualityGateCommands.find(c => c.name === r.name)?.required);
      this.activeFocusSession.qualityGatesPassed = allPassed;
    }

    return results;
  }

  getQualityGates(): QualityGate[] {
    return [...this.qualityGates];
  }

  getContextSwitches(): ContextSwitch[] {
    return [...this.contextSwitches];
  }

  createPreOperationCheckpoint(operation: string): SessionCheckpoint | null {
    this._recordActivity();
    return this.createCheckpoint(`pre-${operation}`);
  }

  getSprintStats(): SprintSessionStats {
    const sessionStats = this.getSessionStats();

    const totalFocusTimeMs = this.focusSessions.reduce((sum, f) => {
      if (f.endedAt) return sum + (f.endedAt - f.startedAt);
      return sum;
    }, 0);

    const averageFocusScore = this.focusSessions.length > 0
      ? this.focusSessions.reduce((sum, f) => sum + (f.qualityGatesPassed ? 100 : 50), 0) / this.focusSessions.length
      : 0;

    const qualityPassRate = this.qualityGates.length > 0
      ? (this.qualityGates.filter(g => g.status === "passed").length / this.qualityGates.length) * 100
      : 100;

    const tasksCompleted = this.goals.filter(g => g.status === "completed").length;
    const tasksStarted = this.goals.filter(g => g.status === "in_progress" || g.status === "completed").length;

    const hourCounts: number[] = new Array(24).fill(0);
    this.focusSessions.forEach(f => {
      const hour = new Date(f.startedAt).getHours();
      hourCounts[hour]++;
    });
    const peakFocusHour = hourCounts.indexOf(Math.max(...hourCounts));

    return {
      session: {
        active: this.isSessionActive(),
        durationMs: sessionStats?.sessionDurationMs || 0,
        goals: this.goals,
        activeGoal: this.getActiveGoal(),
      },
      focus: {
        currentSession: this.activeFocusSession || undefined,
        totalFocusSessions: this.focusSessions.length,
        averageSessionLengthMs: this.focusSessions.length > 0
          ? totalFocusTimeMs / this.focusSessions.length
          : 0,
        interruptions: this.focusSessions.reduce((sum, f) => sum + f.interruptions, 0),
      },
      energy: this.energyLevel,
      context: {
        switches: this.contextSwitches,
        switchesLastHour: this._getContextSwitchesLastHour(),
      },
      quality: {
        gates: this.qualityGates,
        passRate: qualityPassRate,
      },
      productivity: {
        totalFocusTimeMs,
        totalBreakTimeMs: (sessionStats?.sessionDurationMs || 0) - totalFocusTimeMs,
        averageFocusScore,
        contextSwitchCount: this.contextSwitches.length,
        qualityGatePassRate: qualityPassRate,
        tasksCompleted,
        tasksStarted,
        peakFocusHour,
        mostProductiveDay: "Monday",
      },
    };
  }

  private _saveGoal(goal: SprintGoal): void {
    const key = `${GOAL_PREFIX}${goal.id}`;
    this.getMemoryBank().write(key, JSON.stringify(goal), {
      summary: goal.title,
      tags: ["goal", goal.status, goal.priority],
    });
  }

  private _loadGoals(): void {
    const entries = this.getMemoryBank().listEntries();
    for (const entry of entries) {
      if (!entry.key.startsWith(GOAL_PREFIX)) continue;
      const data = this.getMemoryBank().read(entry.key);
      if (!data) continue;
      try {
        const goal = JSON.parse(data) as SprintGoal;
        this.goals.push(goal);
      } catch {
        continue;
      }
    }
  }

  private _saveFocusSession(session: FocusSession): void {
    const key = `${FOCUS_PREFIX}${session.id}`;
    this.getMemoryBank().write(key, JSON.stringify(session), {
      summary: `Focus session: ${session.goalId}`,
      tags: ["focus", "session"],
    });
  }

  override resumeSession(sessionName?: string): import("./marathon-memory").SessionSnapshot | null {
    const snapshot = super.resumeSession(sessionName);
    if (snapshot) {
      this._loadGoals();
    }
    return snapshot;
  }

  generateSessionSummary(): string {
    const stats = this.getSprintStats();
    const durationHours = Math.floor(stats.session.durationMs / 3600000);
    const durationMinutes = Math.floor((stats.session.durationMs % 3600000) / 60000);

    const summary = `
╔══════════════════════════════════════════════════════════════╗
║              MARATHON SPRINT SESSION SUMMARY                 ║
╠══════════════════════════════════════════════════════════════╣
║ Session Duration: ${durationHours}h ${durationMinutes}m
║ Overall Progress: ${stats.session.goals.length} goals, ${this.getOverallProgress()}% complete
╠══════════════════════════════════════════════════════════════╣
║ FOCUS SESSIONS
║   Total Sessions: ${stats.focus.totalFocusSessions}
║   Average Length: ${Math.round(stats.focus.averageSessionLengthMs / 60000)} minutes
║   Interruptions: ${stats.focus.interruptions}
╠══════════════════════════════════════════════════════════════╣
║ ENERGY
║   Final Level: ${stats.energy.level.toUpperCase()} (${stats.energy.score}%)
║   Trend: ${stats.energy.trend}
╠══════════════════════════════════════════════════════════════╣
║ QUALITY
║   Gates Run: ${stats.quality.gates.length}
║   Pass Rate: ${Math.round(stats.quality.passRate)}%
╠══════════════════════════════════════════════════════════════╣
║ PRODUCTIVITY
║   Total Focus Time: ${Math.round(stats.productivity.totalFocusTimeMs / 3600000 * 10) / 10}h
║   Context Switches: ${stats.productivity.contextSwitchCount}
║   Tasks Completed: ${stats.productivity.tasksCompleted}/${stats.productivity.tasksStarted}
╚══════════════════════════════════════════════════════════════╝
`.trim();

    return summary;
  }
}

export interface BreakSuggestion {
  shouldBreak: boolean;
  message: string;
  breakDurationMinutes: number;
  energyLevel: EnergyLevel["level"];
}
