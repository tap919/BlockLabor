/**
 * Marathon Agent Integration for OverCoat.
 *
 * Autonomous integration layer that ensures all Marathon features
 * are utilized during coding sessions without requiring manual intervention:
 * - Automatic energy monitoring and break suggestions
 * - Automatic context switch detection
 * - Automatic quality gates at appropriate moments
 * - Automatic checkpoint creation on significant events
 * - Smart goal progression
 * - Continuous session optimization
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
import {
  MarathonSprint,
  MarathonSprintConfig,
  SprintGoal,
  SubTask,
  FocusSession,
  EnergyLevel,
  QualityGate,
  ContextSwitch,
  ProductivityMetrics,
  SprintSessionStats,
  BreakSuggestion,
} from "./marathon-sprint";

export interface AgentActivity {
  type: "edit" | "read" | "search" | "test" | "build" | "refactor" | "debug";
  filePath?: string;
  description: string;
  timestamp: number;
  riskLevel: "low" | "medium" | "high";
}

export interface AutonomousConfig {
  enableAutoBreaks?: boolean;
  enableAutoCheckpoints?: boolean;
  enableAutoQualityGates?: boolean;
  enableContextMonitoring?: boolean;
  enableGoalTracking?: boolean;
  autoCheckpointOnRiskLevel?: "low" | "medium" | "high";
  breakSuggestionThreshold?: number;
  contextSwitchWarningThreshold?: number;
}

export interface AgentEvent {
  type: string;
  timestamp: number;
  data: unknown;
}

export interface AutonomousState {
  active: boolean;
  currentGoalId?: string;
  lastBreakSuggestion?: BreakSuggestion;
  lastCheckpoint?: SessionCheckpoint;
  lastQualityGate?: QualityGate;
  consecutiveErrors: number;
  productivityScore: number;
  events: AgentEvent[];
}

const DEFAULT_AUTONOMOUS_CONFIG: Required<AutonomousConfig> = {
  enableAutoBreaks: true,
  enableAutoCheckpoints: true,
  enableAutoQualityGates: true,
  enableContextMonitoring: true,
  enableGoalTracking: true,
  autoCheckpointOnRiskLevel: "high",
  breakSuggestionThreshold: 40,
  contextSwitchWarningThreshold: 8,
};

export type EventHandler = (event: AgentEvent) => void;
export type BreakHandler = (suggestion: BreakSuggestion) => void;
export type CheckpointHandler = (checkpoint: SessionCheckpoint) => void;
export type QualityGateHandler = (results: QualityGate[]) => void;
export type ContextSwitchHandler = (switchCount: number) => void;

export class MarathonAgentIntegration {
  private sprint: MarathonSprint;
  private config: Required<AutonomousConfig>;
  private state: AutonomousState;
  private activityHistory: AgentActivity[] = [];
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private breakHandlers: BreakHandler[] = [];
  private checkpointHandlers: CheckpointHandler[] = [];
  private qualityGateHandlers: QualityGateHandler[] = [];
  private contextSwitchHandlers: ContextSwitchHandler[] = [];
  private monitorInterval: ReturnType<typeof setInterval> | null = null;
  private currentActivity: AgentActivity | null = null;
  private lastFileAnalyzed: string | null = null;

  constructor(sprint: MarathonSprint, autonomousConfig?: AutonomousConfig) {
    this.sprint = sprint;
    this.config = { ...DEFAULT_AUTONOMOUS_CONFIG, ...autonomousConfig };
    this.state = {
      active: true,
      consecutiveErrors: 0,
      productivityScore: 100,
      events: [],
    };
  }

  start(): void {
    this.state.active = true;
    this._startMonitoring();
    this._emitEvent({ type: "autonomous_started", timestamp: Date.now(), data: null });
  }

  stop(): void {
    this.state.active = false;
    this._stopMonitoring();
    this._emitEvent({ type: "autonomous_stopped", timestamp: Date.now(), data: null });
  }

  private _startMonitoring(): void {
    if (this.monitorInterval) return;

    this.monitorInterval = setInterval(() => {
      this._runAutonomousChecks();
    }, 30000);
  }

  private _stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private _runAutonomousChecks(): void {
    if (!this.state.active) return;

    if (this.config.enableAutoBreaks) {
      this._checkBreakSuggestion();
    }

    if (this.config.enableContextMonitoring) {
      this._checkContextSwitches();
    }

    this._updateProductivityScore();
    this._pruneOldActivities();
  }

  recordActivity(activity: AgentActivity): void {
    this.activityHistory.push(activity);
    this.currentActivity = activity;

    if (activity.filePath) {
      this.sprint.recordContextSwitch(activity.filePath, activity.description);
    }

    if (this.config.enableAutoCheckpoints) {
      this._maybeAutoCheckpoint(activity);
    }

    if (this.config.enableGoalTracking && activity.filePath) {
      this._trackGoalActivity(activity);
    }

    if (activity.riskLevel === "high" && this.config.enableAutoCheckpoints) {
      this._createPreRiskCheckpoint(activity);
    }

    if (this.config.enableAutoQualityGates) {
      this._maybeRunQualityGate(activity);
    }

    this._emitEvent({
      type: "activity_recorded",
      timestamp: Date.now(),
      data: activity,
    });

    if (this.activityHistory.length > 1000) {
      this.activityHistory = this.activityHistory.slice(-500);
    }
  }

  private _checkBreakSuggestion(): void {
    const suggestion = this.sprint.getBreakSuggestion();

    if (suggestion.shouldBreak && suggestion.breakDurationMinutes >= 5) {
      this.state.lastBreakSuggestion = suggestion;

      for (const handler of this.breakHandlers) {
        handler(suggestion);
      }

      this._emitEvent({
        type: "break_suggestion",
        timestamp: Date.now(),
        data: suggestion,
      });
    }
  }

  private _checkContextSwitches(): void {
    const switches = this.sprint.getContextSwitches();
    const lastHour = switches.filter(
      s => Date.now() - s.timestamp < 3600000
    ).length;

    if (lastHour > this.config.contextSwitchWarningThreshold) {
      for (const handler of this.contextSwitchHandlers) {
        handler(lastHour);
      }

      this._emitEvent({
        type: "high_context_switching",
        timestamp: Date.now(),
        data: { count: lastHour, threshold: this.config.contextSwitchWarningThreshold },
      });
    }
  }

  private _maybeAutoCheckpoint(activity: AgentActivity): void {
    const riskLevels = ["low", "medium", "high"];
    const checkpointRisk = riskLevels.indexOf(this.config.autoCheckpointOnRiskLevel);

    if (riskLevels.indexOf(activity.riskLevel) >= checkpointRisk) {
      const checkpoint = this.sprint.createPreOperationCheckpoint(
        `${activity.type}-${activity.riskLevel}`
      );
      if (checkpoint) {
        this.state.lastCheckpoint = checkpoint;

        for (const handler of this.checkpointHandlers) {
          handler(checkpoint);
        }
      }
    }

    const sessionStats = this.sprint.getSessionStats();
    if (sessionStats && sessionStats.sessionActive) {
      const minutesSinceLastCheckpoint = 30;
      if (Math.random() < 0.1 || minutesSinceLastCheckpoint >= 30) {
        const checkpoint = this.sprint.createCheckpoint("auto-progress");
        if (checkpoint) {
          this.state.lastCheckpoint = checkpoint;
          for (const handler of this.checkpointHandlers) {
            handler(checkpoint);
          }
        }
      }
    }
  }

  private _createPreRiskCheckpoint(activity: AgentActivity): void {
    const checkpoint = this.sprint.createPreOperationCheckpoint(
      `pre-${activity.type}-risk`
    );
    if (checkpoint) {
      this.state.lastCheckpoint = checkpoint;
      this._emitEvent({
        type: "pre_risk_checkpoint",
        timestamp: Date.now(),
        data: { activity, checkpoint },
      });
    }
  }

  private _trackGoalActivity(activity: AgentActivity): void {
    const activeGoal = this.sprint.getActiveGoal();
    if (!activeGoal && this.config.enableGoalTracking) {
      const pendingGoals = this.sprint.getGoals().filter(
        g => g.status === "pending"
      );
      if (pendingGoals.length > 0) {
        const matchingGoal = pendingGoals.find(g => {
          if (!activity.filePath) return false;
          return g.subTasks.some(
            t => t.filePath && activity.filePath.includes(path.dirname(t.filePath))
          );
        });

        if (matchingGoal) {
          this.sprint.startGoal(matchingGoal.id);
          this.state.currentGoalId = matchingGoal.id;
        }
      }
    }
  }

  private _maybeRunQualityGate(activity: AgentActivity): void {
    const shouldRun = 
      activity.type === "build" ||
      activity.type === "test" ||
      (activity.type === "refactor" && activity.riskLevel === "high") ||
      this.sprint.getOverallProgress() % 25 === 0;

    if (shouldRun) {
      this._runQualityGatesAsync();
    }
  }

  private async _runQualityGatesAsync(): Promise<void> {
    try {
      const results = await this.sprint.getQualityGates();
      this.state.lastQualityGate = results[results.length - 1];

      for (const handler of this.qualityGateHandlers) {
        handler(results);
      }

      this._emitEvent({
        type: "quality_gates_completed",
        timestamp: Date.now(),
        data: results,
      });
    } catch (error) {
      this.state.consecutiveErrors++;
      this._emitEvent({
        type: "quality_gate_error",
        timestamp: Date.now(),
        data: { error },
      });
    }
  }

  suggestNextGoal(): SprintGoal | null {
    const goals = this.sprint.getGoals();
    const pending = goals.filter(g => g.status === "pending");
    const inProgress = goals.filter(g => g.status === "in_progress");

    if (inProgress.length > 0) {
      return inProgress[0];
    }

    const highPriority = pending.filter(g => g.priority === "high");
    if (highPriority.length > 0) {
      return highPriority[0];
    }

    if (pending.length > 0) {
      return pending[0];
    }

    return null;
  }

  autoCreateGoal(taskDescription: string, filePath?: string): SprintGoal | null {
    const goal = this.sprint.setGoal(
      taskDescription,
      `Auto-created goal from agent activity`,
      "medium"
    );

    if (filePath) {
      this.sprint.addSubTask(goal.id, `Implement: ${taskDescription}`, filePath);
    }

    this._emitEvent({
      type: "goal_auto_created",
      timestamp: Date.now(),
      data: { goal },
    });

    return goal;
  }

  autoStartGoal(goalId?: string): SprintGoal | null {
    const goal = goalId
      ? this.sprint.getGoals().find(g => g.id === goalId)
      : this.suggestNextGoal();

    if (!goal) return null;

    this.sprint.startGoal(goal.id);
    this.state.currentGoalId = goal.id;

    this._emitEvent({
      type: "goal_auto_started",
      timestamp: Date.now(),
      data: { goal },
    });

    return goal;
  }

  recordCodeChange(filePath: string, changeType: "create" | "modify" | "delete"): void {
    this.sprint.recordFileModified(filePath);

    const activity: AgentActivity = {
      type: changeType === "create" ? "edit" : changeType === "modify" ? "edit" : "refactor",
      filePath,
      description: `Code ${changeType}`,
      timestamp: Date.now(),
      riskLevel: changeType === "delete" ? "high" : "medium",
    };

    this.recordActivity(activity);
  }

  recordDecision(description: string, rationale: string, filesAffected: string[]): DecisionRecord {
    const decision = this.sprint.recordDecision(description, rationale, filesAffected);

    this._emitEvent({
      type: "decision_recorded",
      timestamp: Date.now(),
      data: { decision },
    });

    return decision;
  }

  storeImportantCode(filePath: string, code: string, description: string): CodeSnippet {
    const relevanceScore = this._calculateRelevanceScore(filePath, code);
    const snippet = this.sprint.storeCodeSnippet(filePath, code, description, relevanceScore);

    this._emitEvent({
      type: "code_stored",
      timestamp: Date.now(),
      data: { snippet },
    });

    return snippet;
  }

  private _calculateRelevanceScore(filePath: string, code: string): number {
    const activeGoal = this.sprint.getActiveGoal();
    if (!activeGoal) return 0.5;

    const goalKeywords = activeGoal.title.toLowerCase().split(/\s+/);
    const codeLower = code.toLowerCase();
    const pathLower = filePath.toLowerCase();

    let matches = 0;
    for (const keyword of goalKeywords) {
      if (codeLower.includes(keyword) || pathLower.includes(keyword)) {
        matches++;
      }
    }

    return Math.min(1, (matches / goalKeywords.length) * 0.5 + 0.5);
  }

  private _updateProductivityScore(): void {
    const stats = this.sprint.getSprintStats();
    if (!stats) return;

    let score = 100;

    const energy = this.sprint.getEnergyLevel();
    score -= (100 - energy.score) * 0.3;

    const contextSwitches = stats.context.switchesLastHour;
    if (contextSwitches > this.config.contextSwitchWarningThreshold) {
      score -= (contextSwitches - this.config.contextSwitchWarningThreshold) * 2;
    }

    if (stats.focus.currentSession) {
      score += 10;
    }

    this.state.productivityScore = Math.max(0, Math.min(100, score));
  }

  private _pruneOldActivities(): void {
    const oneDayAgo = Date.now() - 86400000;
    this.activityHistory = this.activityHistory.filter(
      a => a.timestamp > oneDayAgo
    );
  }

  onBreakSuggestion(handler: BreakHandler): void {
    this.breakHandlers.push(handler);
  }

  onCheckpoint(handler: CheckpointHandler): void {
    this.checkpointHandlers.push(handler);
  }

  onQualityGate(handler: QualityGateHandler): void {
    this.qualityGateHandlers.push(handler);
  }

  onContextSwitch(handler: ContextSwitchHandler): void {
    this.contextSwitchHandlers.push(handler);
  }

  on(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler);
    this.eventHandlers.set(eventType, handlers);
  }

  private _emitEvent(event: AgentEvent): void {
    this.state.events.push(event);
    if (this.state.events.length > 100) {
      this.state.events = this.state.events.slice(-50);
    }

    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }

    const allHandlers = this.eventHandlers.get("*");
    if (allHandlers) {
      for (const handler of allHandlers) {
        handler(event);
      }
    }
  }

  getAutonomousState(): AutonomousState {
    return { ...this.state };
  }

  getActivityHistory(limit?: number): AgentActivity[] {
    if (limit) {
      return this.activityHistory.slice(-limit);
    }
    return [...this.activityHistory];
  }

  getRecentEvents(limit?: number): AgentEvent[] {
    if (limit) {
      return this.state.events.slice(-limit);
    }
    return [...this.state.events];
  }

  getProductivityScore(): number {
    return this.state.productivityScore;
  }

  acknowledgeBreak(): void {
    this.sprint.acknowledgeBreak();
    this.state.lastBreakSuggestion = undefined;
  }

  isActive(): boolean {
    return this.state.active;
  }

  getCurrentGoal(): SprintGoal | undefined {
    return this.sprint.getActiveGoal();
  }

  getGoalProgress(): number {
    return this.sprint.getOverallProgress();
  }

  getEnergyLevel(): EnergyLevel {
    return this.sprint.getEnergyLevel();
  }

  getStats(): SprintSessionStats {
    return this.sprint.getSprintStats();
  }

  generateSummary(): string {
    return this.sprint.generateSessionSummary();
  }
}

export function createMarathonAgent(
  config?: {
    marathon?: MarathonSprintConfig;
    autonomous?: AutonomousConfig;
  }
): { sprint: MarathonSprint; integration: MarathonAgentIntegration } {
  const sprintConfig: MarathonSprintConfig = {
    bankDir: config?.marathon?.bankDir || ".overcoat/marathon-agent",
    capacityBytes: config?.marathon?.capacityBytes || ONE_GIB,
    sessionConfig: config?.marathon?.sessionConfig,
    autoSaveIntervalMs: config?.marathon?.autoSaveIntervalMs || 60000,
    maxContextSnapshots: config?.marathon?.maxContextSnapshots || 100,
    enableEnergyTracking: config?.marathon?.enableEnergyTracking ?? true,
    enableQualityGates: config?.marathon?.enableQualityGates ?? true,
    enableContextSwitchDetection: config?.marathon?.enableContextSwitchDetection ?? true,
    focusSessionDurationMinutes: config?.marathon?.focusSessionDurationMinutes || 25,
    maxContextSwitchesPerHour: config?.marathon?.maxContextSwitchesPerHour || 10,
  };

  const sprint = new MarathonSprint(sprintConfig);
  sprint.open();

  const integration = new MarathonAgentIntegration(sprint, config?.autonomous);
  integration.start();

  return { sprint, integration };
}
