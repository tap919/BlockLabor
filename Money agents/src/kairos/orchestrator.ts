/**
 * Multi-Agent Orchestrator
 * 
 * Orchestrator logic that allows for spawning and managing parallel
 * worker agents to solve different parts of a problem simultaneously.
 * 
 * Features:
 * - Agent spawning and lifecycle management
 * - Parallel task execution
 * - Inter-agent communication
 * - Task distribution and load balancing
 * - Result aggregation
 * - Failure handling and recovery
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types and Interfaces
// ============================================

export type AgentState = 'spawning' | 'initializing' | 'idle' | 'working' | 'paused' | 'error' | 'terminated';
export type TaskState = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';
export type OrchestratorState = 'initializing' | 'running' | 'paused' | 'shutting_down' | 'shutdown';

export interface AgentConfig {
  id: string;
  name: string;
  type: AgentType;
  capabilities: string[];
  maxConcurrentTasks: number;
  priority: number;
  timeout: number;
  autoRestart: boolean;
  maxRestarts: number;
  metadata: Record<string, unknown>;
}

export type AgentType = 'worker' | 'specialist' | 'coordinator' | 'observer' | 'hybrid';

export interface AgentInstance {
  id: string;
  config: AgentConfig;
  state: AgentState;
  currentTasks: string[];
  completedTasks: number;
  failedTasks: number;
  lastHeartbeat: Date;
  createdAt: Date;
  restartCount: number;
  metadata: Record<string, unknown>;
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  type: string;
  priority: number;
  payload: Record<string, unknown>;
  requiredCapabilities: string[];
  dependencies: string[];
  timeout: number;
  maxRetries: number;
  retryCount: number;
  state: TaskState;
  assignedAgent?: string;
  result?: unknown;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskResult {
  taskId: string;
  agentId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration: number;
}

export interface OrchestratorConfig {
  maxAgents: number;
  defaultAgentTimeout: number;
  taskQueueSize: number;
  heartbeatInterval: number;
  agentTimeout: number;
  enableAutoScaling: boolean;
  minIdleAgents: number;
  maxIdleAgents: number;
}

export interface AgentMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  type: 'task' | 'result' | 'status' | 'error' | 'control';
  payload: Record<string, unknown>;
  timestamp: Date;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tasks: TaskDefinition[];
  dependencies: Record<string, string[]>;
  parallelGroups: string[][];
  onFailure: 'abort' | 'continue' | 'rollback';
}

export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  taskResults: TaskResult[];
  errors: string[];
  startTime: Date;
  endTime: Date;
}

// ============================================
// Orchestrator Class
// ============================================

export class Orchestrator extends EventEmitter {
  private state: OrchestratorState = 'initializing';
  private config: OrchestratorConfig;
  private agents: Map<string, AgentInstance> = new Map();
  private tasks: Map<string, TaskDefinition> = new Map();
  private taskQueue: string[] = [];
  private runningWorkflows: Map<string, WorkflowDefinition> = new Map();
  private messageBus: AgentMessage[] = [];
  private heartbeatTimer?: NodeJS.Timeout;
  private startTime?: Date;

  constructor(config?: Partial<OrchestratorConfig>) {
    super();

    this.config = {
      maxAgents: 20,
      defaultAgentTimeout: 300000,
      taskQueueSize: 1000,
      heartbeatInterval: 10000,
      agentTimeout: 60000,
      enableAutoScaling: true,
      minIdleAgents: 2,
      maxIdleAgents: 5,
      ...config,
    };
  }

  /**
   * Start the orchestrator
   */
  async start(): Promise<void> {
    if (this.state === 'running') {
      console.log('[Orchestrator] Already running');
      return;
    }

    console.log('[Orchestrator] Starting...');
    this.state = 'running';
    this.startTime = new Date();

    // Start heartbeat
    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.config.heartbeatInterval);

    // Spawn minimum agents
    if (this.config.enableAutoScaling) {
      await this.ensureMinimumAgents();
    }

    this.emit('started', { timestamp: new Date() });
    console.log('[Orchestrator] Started successfully');
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    console.log('[Orchestrator] Stopping...');
    this.state = 'shutting_down';

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    // Terminate all agents
    for (const agentId of this.agents.keys()) {
      await this.terminateAgent(agentId);
    }

    this.state = 'shutdown';
    this.emit('stopped', { timestamp: new Date() });
    console.log('[Orchestrator] Stopped');
  }

  /**
   * Pause the orchestrator
   */
  pause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      console.log('[Orchestrator] Paused');
      this.emit('paused', { timestamp: new Date() });
    }
  }

  /**
   * Resume the orchestrator
   */
  resume(): void {
    if (this.state === 'paused') {
      this.state = 'running';
      console.log('[Orchestrator] Resumed');
      this.emit('resumed', { timestamp: new Date() });
    }
  }

  // ============================================
  // Agent Management
  // ============================================

  /**
   * Spawn a new agent
   */
  async spawnAgent(config: Omit<AgentConfig, 'id'>): Promise<AgentInstance> {
    if (this.agents.size >= this.config.maxAgents) {
      throw new Error('Maximum agent limit reached');
    }

    const agentId = uuidv4();
    const agent: AgentInstance = {
      id: agentId,
      config: {
        ...config,
        id: agentId,
      },
      state: 'spawning',
      currentTasks: [],
      completedTasks: 0,
      failedTasks: 0,
      lastHeartbeat: new Date(),
      createdAt: new Date(),
      restartCount: 0,
      metadata: {},
    };

    this.agents.set(agentId, agent);

    // Initialize agent
    agent.state = 'initializing';
    // Simulated initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    agent.state = 'idle';

    console.log(`[Orchestrator] Spawned agent: ${config.name} (${agentId})`);
    this.emit('agent:spawned', { agent });

    return agent;
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    // Wait for current tasks to complete or timeout
    const timeout = this.config.defaultAgentTimeout;
    const start = Date.now();

    while (agent.currentTasks.length > 0 && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    agent.state = 'terminated';
    this.agents.delete(agentId);

    console.log(`[Orchestrator] Terminated agent: ${agent.config.name} (${agentId})`);
    this.emit('agent:terminated', { agentId });

    return true;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all agents
   */
  listAgents(): AgentInstance[] {
    return Array.from(this.agents.values());
  }

  /**
   * Find available agent for task
   */
  private findAvailableAgent(task: TaskDefinition): AgentInstance | null {
    let bestAgent: AgentInstance | null = null;
    let bestScore = -1;

    for (const agent of this.agents.values()) {
      // Check if agent is available
      if (agent.state !== 'idle' && agent.state !== 'working') continue;
      if (agent.currentTasks.length >= agent.config.maxConcurrentTasks) continue;

      // Check capabilities
      const hasCapabilities = task.requiredCapabilities.every(
        cap => agent.config.capabilities.includes(cap)
      );
      if (!hasCapabilities) continue;

      // Score based on load and priority
      const loadScore = 1 - (agent.currentTasks.length / agent.config.maxConcurrentTasks);
      const priorityScore = agent.config.priority / 10;
      const successRate = agent.completedTasks / (agent.completedTasks + agent.failedTasks + 1);
      const score = loadScore * 0.4 + priorityScore * 0.3 + successRate * 0.3;

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }

    return bestAgent;
  }

  /**
   * Ensure minimum agents are available
   */
  private async ensureMinimumAgents(): Promise<void> {
    const idleCount = Array.from(this.agents.values())
      .filter(a => a.state === 'idle').length;

    if (idleCount < this.config.minIdleAgents) {
      const toSpawn = this.config.minIdleAgents - idleCount;
      for (let i = 0; i < toSpawn && this.agents.size < this.config.maxAgents; i++) {
        await this.spawnAgent({
          name: `auto-worker-${Date.now()}-${i}`,
          type: 'worker',
          capabilities: ['general', 'analysis', 'execution'],
          maxConcurrentTasks: 3,
          priority: 5,
          timeout: this.config.defaultAgentTimeout,
          autoRestart: true,
          maxRestarts: 3,
          metadata: { autoSpawned: true },
        });
      }
    }
  }

  // ============================================
  // Task Management
  // ============================================

  /**
   * Submit a task
   */
  async submitTask(task: Omit<TaskDefinition, 'id' | 'state' | 'retryCount' | 'createdAt'>): Promise<TaskDefinition> {
    if (this.taskQueue.length >= this.config.taskQueueSize) {
      throw new Error('Task queue is full');
    }

    const fullTask: TaskDefinition = {
      ...task,
      id: uuidv4(),
      state: 'pending',
      retryCount: 0,
      createdAt: new Date(),
    };

    this.tasks.set(fullTask.id, fullTask);
    this.taskQueue.push(fullTask.id);

    console.log(`[Orchestrator] Task submitted: ${task.name} (${fullTask.id})`);
    this.emit('task:submitted', { task: fullTask });

    return fullTask;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): TaskDefinition | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.state === 'running' && task.assignedAgent) {
      // Send cancel message to agent
      this.sendMessage({
        from: 'orchestrator',
        to: task.assignedAgent,
        type: 'control',
        payload: { action: 'cancel', taskId },
      });
    }

    task.state = 'cancelled';
    this.emit('task:cancelled', { taskId });

    return true;
  }

  /**
   * Distribute tasks to agents
   */
  private async distributeTasks(): Promise<void> {
    if (this.state !== 'running') return;

    // Process queue in priority order
    const sortedQueue = this.taskQueue
      .map(id => this.tasks.get(id))
      .filter((t): t is TaskDefinition => t?.state === 'pending')
      .sort((a, b) => b.priority - a.priority);

    for (const task of sortedQueue) {
      // Check dependencies
      const pendingDeps = task.dependencies.filter(
        depId => this.tasks.get(depId)?.state !== 'completed'
      );
      if (pendingDeps.length > 0) continue;

      // Find available agent
      const agent = this.findAvailableAgent(task);
      if (!agent) continue;

      // Assign task
      await this.assignTask(task, agent);
    }
  }

  /**
   * Assign task to agent
   */
  private async assignTask(task: TaskDefinition, agent: AgentInstance): Promise<void> {
    task.state = 'assigned';
    task.assignedAgent = agent.id;
    task.startedAt = new Date();

    agent.currentTasks.push(task.id);
    agent.state = 'working';

    this.sendMessage({
      from: 'orchestrator',
      to: agent.id,
      type: 'task',
      payload: { task },
    });

    console.log(`[Orchestrator] Assigned task ${task.name} to agent ${agent.config.name}`);
    this.emit('task:assigned', { taskId: task.id, agentId: agent.id });

    // Simulate task execution
    this.executeTask(task, agent);
  }

  /**
   * Execute task (simulated)
   */
  private async executeTask(task: TaskDefinition, agent: AgentInstance): Promise<void> {
    task.state = 'running';

    try {
      // Simulate execution based on task type
      const duration = Math.random() * 5000 + 1000;
      await new Promise(resolve => setTimeout(resolve, duration));

      task.result = { completed: true, duration };
      task.state = 'completed';
      task.completedAt = new Date();
      agent.completedTasks++;

      console.log(`[Orchestrator] Task completed: ${task.name}`);
      this.emit('task:completed', { taskId: task.id, result: task.result });

    } catch (error: any) {
      task.error = error.message;
      task.retryCount++;

      if (task.retryCount < task.maxRetries) {
        task.state = 'pending';
        task.assignedAgent = undefined;
        this.taskQueue.push(task.id);
      } else {
        task.state = 'failed';
        task.completedAt = new Date();
        agent.failedTasks++;
        this.emit('task:failed', { taskId: task.id, error: task.error });
      }
    } finally {
      agent.currentTasks = agent.currentTasks.filter(id => id !== task.id);
      if (agent.currentTasks.length === 0) {
        agent.state = 'idle';
      }
    }
  }

  // ============================================
  // Workflow Management
  // ============================================

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflow: WorkflowDefinition): Promise<WorkflowResult> {
    const result: WorkflowResult = {
      workflowId: workflow.id,
      success: true,
      taskResults: [],
      errors: [],
      startTime: new Date(),
      endTime: new Date(),
    };

    this.runningWorkflows.set(workflow.id, workflow);
    console.log(`[Orchestrator] Starting workflow: ${workflow.name}`);

    try {
      // Execute parallel groups in order
      for (const group of workflow.parallelGroups) {
        const groupPromises = group.map(taskId => {
          const task = workflow.tasks.find(t => t.id === taskId);
          if (!task) return Promise.resolve(null);
          return this.submitTask(task);
        });

        const groupResults = await Promise.all(groupPromises);
        
        for (const taskResult of groupResults) {
          if (taskResult) {
            result.taskResults.push({
              taskId: taskResult.id,
              agentId: taskResult.assignedAgent || 'unknown',
              success: taskResult.state === 'completed',
              result: taskResult.result,
              duration: taskResult.completedAt && taskResult.startedAt ?
                taskResult.completedAt.getTime() - taskResult.startedAt.getTime() : 0,
            });
          }
        }

        // Check for failures
        const failed = result.taskResults.filter(r => !r.success);
        if (failed.length > 0 && workflow.onFailure === 'abort') {
          result.success = false;
          result.errors.push('Workflow aborted due to task failure');
          break;
        }
      }

    } catch (error: any) {
      result.success = false;
      result.errors.push(error.message);
    } finally {
      result.endTime = new Date();
      this.runningWorkflows.delete(workflow.id);
    }

    console.log(`[Orchestrator] Workflow completed: ${workflow.name} (success: ${result.success})`);
    return result;
  }

  // ============================================
  // Messaging
  // ============================================

  /**
   * Send message between agents
   */
  sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): void {
    const fullMessage: AgentMessage = {
      ...message,
      id: uuidv4(),
      timestamp: new Date(),
    };

    this.messageBus.push(fullMessage);

    // Keep message bus bounded
    if (this.messageBus.length > 1000) {
      this.messageBus.shift();
    }

    this.emit('message', fullMessage);

    if (message.to === 'broadcast') {
      this.emit('broadcast', fullMessage);
    } else {
      this.emit(`message:${message.to}`, fullMessage);
    }
  }

  /**
   * Get messages for agent
   */
  getMessages(agentId: string): AgentMessage[] {
    return this.messageBus.filter(
      m => m.to === agentId || m.to === 'broadcast'
    );
  }

  // ============================================
  // Heartbeat and Monitoring
  // ============================================

  /**
   * Heartbeat
   */
  private async heartbeat(): Promise<void> {
    const now = Date.now();

    // Check agent health
    for (const agent of this.agents.values()) {
      const timeSinceHeartbeat = now - agent.lastHeartbeat.getTime();
      
      if (timeSinceHeartbeat > this.config.agentTimeout) {
        console.warn(`[Orchestrator] Agent timeout: ${agent.config.name}`);
        
        if (agent.config.autoRestart && agent.restartCount < agent.config.maxRestarts) {
          agent.state = 'error';
          // Would restart agent here
          agent.restartCount++;
          agent.state = 'idle';
          agent.lastHeartbeat = new Date();
          console.log(`[Orchestrator] Restarted agent: ${agent.config.name}`);
        } else {
          this.terminateAgent(agent.id);
        }
      }
    }

    // Distribute tasks
    if (this.state === 'running') {
      await this.distributeTasks();
    }

    // Auto-scale agents
    if (this.config.enableAutoScaling) {
      await this.ensureMinimumAgents();
    }

    this.emit('heartbeat', {
      timestamp: new Date(),
      agentCount: this.agents.size,
      taskQueueLength: this.taskQueue.length,
      runningWorkflows: this.runningWorkflows.size,
    });
  }

  // ============================================
  // Status and Metrics
  // ============================================

  /**
   * Get orchestrator status
   */
  getStatus(): {
    state: OrchestratorState;
    uptime: number;
    agentCount: number;
    activeAgents: number;
    taskQueueLength: number;
    runningWorkflows: number;
  } {
    return {
      state: this.state,
      uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
      agentCount: this.agents.size,
      activeAgents: Array.from(this.agents.values()).filter(a => a.state === 'working').length,
      taskQueueLength: this.taskQueue.length,
      runningWorkflows: this.runningWorkflows.size,
    };
  }

  /**
   * Get metrics
   */
  getMetrics(): {
    totalAgents: number;
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDuration: number;
    agentUtilization: number;
  } {
    const tasks = Array.from(this.tasks.values());
    const completed = tasks.filter(t => t.state === 'completed');
    const failed = tasks.filter(t => t.state === 'failed');

    const avgDuration = completed.length > 0 ?
      completed.reduce((sum, t) => {
        const duration = t.completedAt && t.startedAt ?
          t.completedAt.getTime() - t.startedAt.getTime() : 0;
        return sum + duration;
      }, 0) / completed.length : 0;

    const totalCapacity = Array.from(this.agents.values())
      .reduce((sum, a) => sum + a.config.maxConcurrentTasks, 0);
    const usedCapacity = Array.from(this.agents.values())
      .reduce((sum, a) => sum + a.currentTasks.length, 0);

    return {
      totalAgents: this.agents.size,
      totalTasks: tasks.length,
      completedTasks: completed.length,
      failedTasks: failed.length,
      averageTaskDuration: avgDuration,
      agentUtilization: totalCapacity > 0 ? usedCapacity / totalCapacity : 0,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const orchestrator = new Orchestrator();
