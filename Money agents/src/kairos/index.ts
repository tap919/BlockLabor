/**
 * KAIROS - Autonomous Agent System Integration
 * 
 * This module integrates all KAIROS components:
 * - KAIROS Daemon: Persistent always-on background agent
 * - ULTRAPLAN: Complex multi-step planning engine
 * - Multi-Agent Orchestrator: Parallel agent coordination
 * - autoDream: Background memory consolidation
 * - MemoryLayer: Persistent context storage
 */

export { KairosDaemon, kairosDaemon } from './daemon';
export type { 
  DaemonState, 
  DaemonTask, 
  DaemonConfig, 
  DaemonMetrics,
  TaskType,
  TaskPriority,
  TaskTrigger,
  ScheduleConfig,
  ProactiveAction
} from './daemon';

export { UltraPlanEngine, ultraPlanEngine } from './ultraplan';
export type {
  Plan,
  PlanStep,
  PlanState,
  PlanType,
  PlanPriority,
  PlanConstraint,
  PlanRisk,
  PlanMetrics,
  PlanValidationResult,
  PlanningSession,
  PlanningArtifact
} from './ultraplan';

export { Orchestrator, orchestrator } from './orchestrator';
export type {
  AgentInstance,
  AgentConfig,
  AgentState,
  AgentType,
  TaskDefinition,
  TaskState,
  TaskResult,
  WorkflowDefinition,
  WorkflowResult,
  AgentMessage,
  OrchestratorState
} from './orchestrator';

export { AutoDream, autoDream } from './autodream';
export type {
  DreamPhase,
  DreamConfig,
  DreamInsight,
  ConsolidationResult,
  MemoryPattern,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph
} from './autodream';

export { MemoryLayer, memoryLayer } from './memory-layer';
export type {
  ProjectContext,
  ProjectRule,
  NamingPattern,
  BuildCommand,
  Dependency,
  EnvironmentConfig,
  ContextMetadata,
  MemoryEntry,
  ResearchTask
} from './memory-layer';

// ============================================
// System Initialization
// ============================================

import { kairosDaemon } from './daemon';
import { memoryLayer } from './memory-layer';
import { autoDream } from './autodream';
import { orchestrator } from './orchestrator';

/**
 * Initialize all KAIROS systems
 */
export async function initializeKairos(config?: {
  enableDaemon?: boolean;
  enableAutoDream?: boolean;
  enableOrchestrator?: boolean;
  daemonConfig?: Partial<import('./daemon').DaemonConfig>;
}): Promise<void> {
  console.log('[KAIROS] Initializing system...');

  // Initialize memory layer first
  await memoryLayer.initialize();

  // Set up cross-references
  autoDream.setMemoryLayer(memoryLayer);
  kairosDaemon.setSystems(memoryLayer, autoDream, orchestrator);

  // Start daemon if enabled
  if (config?.enableDaemon !== false) {
    await kairosDaemon.start();
  }

  console.log('[KAIROS] System initialized successfully');
}

/**
 * Shutdown all KAIROS systems
 */
export async function shutdownKairos(): Promise<void> {
  console.log('[KAIROS] Shutting down system...');

  await kairosDaemon.stop('System shutdown');

  console.log('[KAIROS] System shutdown complete');
}

/**
 * Get system status
 */
export async function getSystemStatus(): Promise<{
  daemon: ReturnType<typeof kairosDaemon.getState>;
  daemonMetrics: ReturnType<typeof kairosDaemon.getMetrics>;
  memoryLayer: Awaited<ReturnType<typeof memoryLayer.getHealth>>;
  autoDream: ReturnType<typeof autoDream.getStatus>;
  orchestrator: ReturnType<typeof orchestrator.getStatus>;
}> {
  return {
    daemon: kairosDaemon.getState(),
    daemonMetrics: kairosDaemon.getMetrics(),
    memoryLayer: await memoryLayer.getHealth(),
    autoDream: autoDream.getStatus(),
    orchestrator: orchestrator.getStatus(),
  };
}
