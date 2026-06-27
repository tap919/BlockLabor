/**
 * Multi-Agent Collaborative Workspace for OverCoat.
 *
 * Enables parallel development where multiple AI agents work on different
 * goals simultaneously while sharing context and detecting conflicts.
 */

import * as fs from "fs";
import * as path from "path";
import { DiskMemoryBank, ONE_GIB } from "../memory/disk-bank";
import {
  MarathonSprint,
  MarathonSprintConfig,
} from "./marathon-sprint";
import {
  MarathonAgentIntegration,
  createMarathonAgent,
  AutonomousConfig,
} from "./marathon-agent";
import {
  MarathonCodeReview,
  CodeReviewConfig,
} from "./marathon-code-review";

export interface AgentConfig {
  id?: string;
  name: string;
  role?: "developer" | "reviewer" | "tester" | "researcher" | "coordinator";
  expertise?: string[];
  goals?: string[];
  workingDirectory?: string;
  maxConcurrency?: number;
}

export interface Agent {
  id: string;
  name: string;
  role: AgentConfig["role"];
  expertise: string[];
  marathon: MarathonAgentIntegration;
  status: "idle" | "working" | "blocked" | "completed";
  currentTask?: string;
  startedAt: number;
  completedAt?: number;
  filesOwned: Set<string>;
}

export interface SharedContext {
  apiContracts?: Record<string, unknown>;
  databaseSchemas?: Record<string, unknown>;
  testSpecs?: Record<string, unknown>;
  decisions?: SharedDecision[];
  checkpoints?: SharedCheckpoint[];
}

export interface SharedDecision {
  id: string;
  agentId: string;
  description: string;
  rationale: string;
  timestamp: number;
  approved?: boolean;
}

export interface SharedCheckpoint {
  id: string;
  agentId: string;
  label: string;
  timestamp: number;
  files: string[];
}

export interface Conflict {
  id: string;
  filePath: string;
  agents: string[];
  type: "edit" | "delete" | "rename";
  timestamp: number;
  resolved: boolean;
  resolution?: "sequential" | "merge" | "abandon" | "manual";
}

export interface WorkspaceStats {
  totalAgents: number;
  activeAgents: number;
  completedAgents: number;
  sharedContextSize: number;
  conflictsDetected: number;
  conflictsResolved: number;
}

export interface WorkspaceConfig {
  bankDir?: string;
  capacityBytes?: number;
  enableConflictDetection?: boolean;
  enableSharedContext?: boolean;
  enableCrossAgentReview?: boolean;
  conflictResolution?: "sequential" | "merge" | "abandon" | "manual";
}

export type ConflictHandler = (conflict: Conflict) => void;
export type AgentEventHandler = (agent: Agent, event: string) => void;
export type ContextUpdateHandler = (context: SharedContext) => void;

const DEFAULT_WORKSPACE_CONFIG: Required<WorkspaceConfig> = {
  bankDir: ".overcoat/collaborative-workspace",
  capacityBytes: ONE_GIB,
  enableConflictDetection: true,
  enableSharedContext: true,
  enableCrossAgentReview: true,
  conflictResolution: "sequential",
};

const AGENT_PREFIX = "workspace:agent:";
const CONTEXT_PREFIX = "workspace:context:";
const CONFLICT_PREFIX = "workspace:conflict:";

export class CollaborativeWorkspace {
  private config: Required<WorkspaceConfig>;
  private agents: Map<string, Agent> = new Map();
  private sharedContext: SharedContext;
  private memoryBank: DiskMemoryBank;
  private conflicts: Conflict[] = [];
  private conflictHandlers: ConflictHandler[] = [];
  private agentEventHandlers: AgentEventHandler[] = [];
  private contextUpdateHandlers: ContextUpdateHandler[] = [];
  private workspaceSprint: MarathonSprint;
  private coordinatorAgent: Agent | null = null;

  constructor(config?: WorkspaceConfig) {
    this.config = { ...DEFAULT_WORKSPACE_CONFIG, ...config };
    this.sharedContext = {
      decisions: [],
      checkpoints: [],
    };

    this.memoryBank = new DiskMemoryBank({
      bankDir: this.config.bankDir,
      capacityBytes: this.config.capacityBytes,
    });
    this.memoryBank.open();

    this.workspaceSprint = new MarathonSprint({
      bankDir: this.config.bankDir + "/sprint",
      capacityBytes: this.config.capacityBytes,
      sessionConfig: { name: "workspace-session" },
    });
    this.workspaceSprint.open();
    this.workspaceSprint.startSession("workspace");

    this._loadState();
  }

  private _loadState(): void {
    const entries = this.memoryBank.listEntries();
    for (const entry of entries) {
      if (entry.key.startsWith(AGENT_PREFIX)) {
        const data = this.memoryBank.read(entry.key);
        if (data) {
          try {
            const agentData = JSON.parse(data);
            const marathonConfig = {
              marathon: {
                bankDir: `${this.config.bankDir}/agent-${agentData.id}`,
                capacityBytes: Math.floor(this.config.capacityBytes / 10),
              },
              autonomous: { enableAutoBreaks: false },
            };
            const { sprint, integration } = createMarathonAgent(marathonConfig);
            integration.stop();

            const agent: Agent = {
              ...agentData,
              marathon: integration,
              filesOwned: new Set(agentData.filesOwned || []),
            };
            this.agents.set(agent.id, agent);
          } catch {
            continue;
          }
        }
      }
    }
  }

  private _saveAgent(agent: Agent): void {
    const data = {
      ...agent,
      filesOwned: Array.from(agent.filesOwned),
    };
    const key = `${AGENT_PREFIX}${agent.id}`;
    this.memoryBank.write(key, JSON.stringify(data), {
      summary: `Agent: ${agent.name}`,
      tags: ["agent", agent.role || "developer"],
    });
  }

  spawnAgent(config: AgentConfig): Agent {
    const id = config.id || `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const marathonConfig = {
      marathon: {
        bankDir: `${this.config.bankDir}/agent-${id}`,
        capacityBytes: Math.floor(this.config.capacityBytes / 10),
        sessionConfig: { name: config.name },
      },
      autonomous: {
        enableAutoBreaks: false,
        enableAutoCheckpoints: this.config.enableCrossAgentReview,
        enableContextMonitoring: this.config.enableConflictDetection,
      },
    };

    const { sprint, integration } = createMarathonAgent(marathonConfig);

    const agent: Agent = {
      id,
      name: config.name,
      role: config.role || "developer",
      expertise: config.expertise || [],
      marathon: integration,
      status: "idle",
      startedAt: Date.now(),
      filesOwned: new Set(),
    };

    this.agents.set(id, agent);
    this._saveAgent(agent);

    this._emitAgentEvent(agent, "spawned");

    if (config.role === "coordinator" || this.agents.size === 1) {
      this.coordinatorAgent = agent;
    }

    return agent;
  }

  assignGoal(agentId: string, goalTitle: string, description?: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const sprint = (agent.marathon as any).sprint as MarathonSprint;
    const goal = sprint.setGoal(goalTitle, description || "", "high");
    sprint.startGoal(goal.id);

    agent.status = "working";
    agent.currentTask = goalTitle;
    this._saveAgent(agent);
    this._emitAgentEvent(agent, "goal_assigned");
  }

  completeGoal(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const sprint = (agent.marathon as any).sprint as MarathonSprint;
    const activeGoal = sprint.getActiveGoal();
    if (activeGoal) {
      sprint.completeGoal(activeGoal.id);
    }

    agent.status = "completed";
    agent.completedAt = Date.now();
    this._saveAgent(agent);
    this._emitAgentEvent(agent, "goal_completed");

    if (this.config.enableCrossAgentReview) {
      this._triggerCrossAgentReview(agent);
    }
  }

  private _triggerCrossAgentReview(agent: Agent): void {
    const otherAgents = Array.from(this.agents.values()).filter(
      a => a.id !== agent.id && a.role === "reviewer"
    );

    for (const reviewer of otherAgents) {
      const reviewerIntegration = reviewer.marathon;
      reviewerIntegration.recordActivity({
        type: "read",
        description: `Reviewing ${agent.name}'s work`,
        timestamp: Date.now(),
        riskLevel: "low",
      });
    }
  }

  claimFile(agentId: string, filePath: string): boolean {
    if (!this.config.enableConflictDetection) {
      return true;
    }

    for (const agent of this.agents.values()) {
      if (agent.id !== agentId && agent.filesOwned.has(filePath)) {
        const conflict: Conflict = {
          id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          filePath,
          agents: [agentId, agent.id],
          type: "edit",
          timestamp: Date.now(),
          resolved: false,
        };

        this.conflicts.push(conflict);
        this._saveConflict(conflict);

        for (const handler of this.conflictHandlers) {
          handler(conflict);
        }

        this._emitAgentEvent(agent, "conflict_detected");
        return false;
      }
    }

    const agent = this.agents.get(agentId);
    if (agent) {
      agent.filesOwned.add(filePath);
      this._saveAgent(agent);
    }

    return true;
  }

  releaseFile(agentId: string, filePath: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.filesOwned.delete(filePath);
      this._saveAgent(agent);
    }
  }

  private _saveConflict(conflict: Conflict): void {
    const key = `${CONFLICT_PREFIX}${conflict.id}`;
    this.memoryBank.write(key, JSON.stringify(conflict), {
      summary: `Conflict: ${conflict.filePath}`,
      tags: ["conflict", conflict.type],
    });
  }

  resolveConflict(conflictId: string, resolution: Conflict["resolution"]): boolean {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (!conflict) return false;

    conflict.resolved = true;
    conflict.resolution = resolution;
    this._saveConflict(conflict);

    if (resolution === "sequential") {
      const [first, second] = conflict.agents;
      const firstAgent = this.agents.get(first);
      if (firstAgent) {
        this._emitAgentEvent(firstAgent, "priority_granted");
      }
    } else if (resolution === "abandon") {
      for (const agentId of conflict.agents) {
        const agent = this.agents.get(agentId);
        if (agent) {
          agent.status = "blocked";
          this._saveAgent(agent);
        }
      }
    }

    return true;
  }

  shareContext(context: Partial<SharedContext>): void {
    if (context.apiContracts) {
      this.sharedContext.apiContracts = {
        ...this.sharedContext.apiContracts,
        ...context.apiContracts,
      };
    }
    if (context.databaseSchemas) {
      this.sharedContext.databaseSchemas = {
        ...this.sharedContext.databaseSchemas,
        ...context.databaseSchemas,
      };
    }
    if (context.testSpecs) {
      this.sharedContext.testSpecs = {
        ...this.sharedContext.testSpecs,
        ...context.testSpecs,
      };
    }

    this._saveSharedContext();
    this._emitContextUpdate();
  }

  private _saveSharedContext(): void {
    const key = `${CONTEXT_PREFIX}main`;
    this.memoryBank.write(key, JSON.stringify(this.sharedContext), {
      summary: "Shared workspace context",
      tags: ["context", "shared"],
    });
  }

  private _emitContextUpdate(): void {
    for (const handler of this.contextUpdateHandlers) {
      handler(this.sharedContext);
    }
  }

  addSharedDecision(agentId: string, description: string, rationale: string): SharedDecision {
    const decision: SharedDecision = {
      id: `decision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      agentId,
      description,
      rationale,
      timestamp: Date.now(),
    };

    this.sharedContext.decisions = this.sharedContext.decisions || [];
    this.sharedContext.decisions.push(decision);
    this._saveSharedContext();

    return decision;
  }

  approveDecision(decisionId: string): boolean {
    const decision = this.sharedContext.decisions?.find(d => d.id === decisionId);
    if (!decision) return false;

    decision.approved = true;
    this._saveSharedContext();

    const agent = this.agents.get(decision.agentId);
    if (agent) {
      this._emitAgentEvent(agent, "decision_approved");
    }

    return true;
  }

  createSharedCheckpoint(agentId: string, label: string, files: string[]): SharedCheckpoint {
    const checkpoint: SharedCheckpoint = {
      id: `checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      agentId,
      label,
      timestamp: Date.now(),
      files,
    };

    this.sharedContext.checkpoints = this.sharedContext.checkpoints || [];
    this.sharedContext.checkpoints.push(checkpoint);
    this._saveSharedContext();

    return checkpoint;
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getActiveAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(a => a.status === "working");
  }

  getSharedContext(): SharedContext {
    return { ...this.sharedContext };
  }

  getConflicts(): Conflict[] {
    return [...this.conflicts];
  }

  getUnresolvedConflicts(): Conflict[] {
    return this.conflicts.filter(c => !c.resolved);
  }

  getWorkspaceStats(): WorkspaceStats {
    const activeAgents = Array.from(this.agents.values()).filter(a => a.status === "working").length;
    const completedAgents = Array.from(this.agents.values()).filter(a => a.status === "completed").length;
    const resolvedConflicts = this.conflicts.filter(c => c.resolved).length;

    return {
      totalAgents: this.agents.size,
      activeAgents,
      completedAgents,
      sharedContextSize: JSON.stringify(this.sharedContext).length,
      conflictsDetected: this.conflicts.length,
      conflictsResolved: resolvedConflicts,
    };
  }

  onConflict(handler: ConflictHandler): void {
    this.conflictHandlers.push(handler);
  }

  onAgentEvent(handler: AgentEventHandler): void {
    this.agentEventHandlers.push(handler);
  }

  onContextUpdate(handler: ContextUpdateHandler): void {
    this.contextUpdateHandlers.push(handler);
  }

  private _emitAgentEvent(agent: Agent, event: string): void {
    for (const handler of this.agentEventHandlers) {
      handler(agent, event);
    }
  }

  terminateAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    agent.marathon.stop();
    this.agents.delete(agentId);
    this.memoryBank.delete(`${AGENT_PREFIX}${agentId}`);

    return true;
  }

  shutdown(): void {
    for (const agent of this.agents.values()) {
      agent.marathon.stop();
    }
    this.workspaceSprint.close();
    this.memoryBank.flush();
  }
}

export function createCollaborativeWorkspace(
  config?: WorkspaceConfig
): CollaborativeWorkspace {
  return new CollaborativeWorkspace(config);
}
