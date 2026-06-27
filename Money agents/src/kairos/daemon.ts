/**
 * KAIROS - Persistent Autonomous Daemon Mode
 * 
 * An always-on background agent system that proactively performs tasks,
 * memory consolidation, and system maintenance even when the user is idle.
 * 
 * Features:
 * - Persistent daemon process with heartbeat
 * - Proactive task scheduling
 * - Background memory consolidation (autoDream integration)
 * - Resource-aware execution
 * - Graceful shutdown handling
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types and Interfaces
// ============================================

export type DaemonState = 'initializing' | 'running' | 'paused' | 'idle' | 'shutdown';
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';
export type TaskTrigger = 'scheduled' | 'proactive' | 'event' | 'user' | 'system';

export interface DaemonTask {
  id: string;
  name: string;
  type: TaskType;
  priority: TaskPriority;
  trigger: TaskTrigger;
  payload: Record<string, unknown>;
  scheduledAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: unknown;
  error?: string;
  retryCount: number;
  maxRetries: number;
  dependencies: string[];
  timeout: number;
}

export type TaskType = 
  | 'memory_consolidation'
  | 'context_optimization'
  | 'proactive_analysis'
  | 'background_research'
  | 'health_check'
  | 'cleanup'
  | 'sync'
  | 'notification'
  | 'custom';

export interface DaemonConfig {
  enabled: boolean;
  heartbeatInterval: number;
  idleThreshold: number;
  maxConcurrentTasks: number;
  taskRetention: number;
  proactiveMode: boolean;
  resourceLimits: {
    maxMemoryMB: number;
    maxCpuPercent: number;
  };
  schedules: ScheduleConfig[];
}

export interface ScheduleConfig {
  id: string;
  name: string;
  taskType: TaskType;
  cron: string;
  enabled: boolean;
  payload: Record<string, unknown>;
  lastRun?: Date;
  nextRun?: Date;
}

export interface DaemonMetrics {
  uptime: number;
  tasksCompleted: number;
  tasksFailed: number;
  currentLoad: number;
  lastHeartbeat: Date;
  idleTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface ProactiveAction {
  id: string;
  trigger: string;
  action: string;
  reasoning: string;
  priority: TaskPriority;
  estimatedDuration: number;
  requiresApproval: boolean;
}

// ============================================
// KAIROS Daemon Class
// ============================================

export class KairosDaemon extends EventEmitter {
  private state: DaemonState = 'initializing';
  private config: DaemonConfig;
  private taskQueue: Map<string, DaemonTask> = new Map();
  private runningTasks: Map<string, DaemonTask> = new Map();
  private completedTasks: DaemonTask[] = [];
  private schedules: Map<string, ScheduleConfig> = new Map();
  private heartbeatTimer?: NodeJS.Timeout;
  private schedulerTimer?: NodeJS.Timeout;
  private startTime: Date;
  private lastActivity: Date;
  private metrics: DaemonMetrics;
  private isIdle: boolean = false;
  private shutdownRequested: boolean = false;

  // References to other systems (injected after creation)
  private memoryLayerRef?: any;
  private autoDreamRef?: any;
  private orchestratorRef?: any;

  constructor(config?: Partial<DaemonConfig>) {
    super();
    
    this.config = {
      enabled: true,
      heartbeatInterval: 5000,
      idleThreshold: 60000,
      maxConcurrentTasks: 3,
      taskRetention: 3600000,
      proactiveMode: true,
      resourceLimits: {
        maxMemoryMB: 512,
        maxCpuPercent: 50,
      },
      schedules: [],
      ...config,
    };

    this.startTime = new Date();
    this.lastActivity = new Date();
    this.metrics = {
      uptime: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      currentLoad: 0,
      lastHeartbeat: new Date(),
      idleTime: 0,
      memoryUsage: 0,
      cpuUsage: 0,
    };

    this.initializeSchedules();
  }

  /**
   * Set references to other systems
   */
  setSystems(memoryLayer: any, autoDream: any, orchestrator: any): void {
    this.memoryLayerRef = memoryLayer;
    this.autoDreamRef = autoDream;
    this.orchestratorRef = orchestrator;
  }

  /**
   * Initialize default schedules
   */
  private initializeSchedules(): void {
    const defaultSchedules: ScheduleConfig[] = [
      {
        id: 'memory-consolidation',
        name: 'Memory Consolidation',
        taskType: 'memory_consolidation',
        cron: '0 */4 * * *',
        enabled: true,
        payload: { deepScan: false },
      },
      {
        id: 'context-optimization',
        name: 'Context Optimization',
        taskType: 'context_optimization',
        cron: '0 */6 * * *',
        enabled: true,
        payload: {},
      },
      {
        id: 'health-check',
        name: 'System Health Check',
        taskType: 'health_check',
        cron: '*/15 * * * *',
        enabled: true,
        payload: {},
      },
      {
        id: 'cleanup',
        name: 'Task Cleanup',
        taskType: 'cleanup',
        cron: '0 0 * * *',
        enabled: true,
        payload: {},
      },
    ];

    defaultSchedules.forEach(schedule => {
      this.schedules.set(schedule.id, schedule);
    });

    this.config.schedules.forEach(schedule => {
      this.schedules.set(schedule.id, schedule);
    });
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.state !== 'initializing' && this.state !== 'shutdown') {
      console.log('[KAIROS] Daemon already running');
      return;
    }

    console.log('[KAIROS] Starting daemon...');
    this.state = 'running';
    this.startTime = new Date();
    this.lastActivity = new Date();

    this.heartbeatTimer = setInterval(() => this.heartbeat(), this.config.heartbeatInterval);
    this.schedulerTimer = setInterval(() => this.checkSchedules(), 30000);

    await this.enqueueTask({
      name: 'Startup Health Check',
      type: 'health_check',
      priority: 'high',
      trigger: 'system',
      payload: { startup: true },
    });

    if (this.config.proactiveMode && this.autoDreamRef) {
      this.autoDreamRef.start();
    }

    this.emit('started', { timestamp: new Date() });
    console.log('[KAIROS] Daemon started successfully');
  }

  /**
   * Stop the daemon gracefully
   */
  async stop(reason: string = 'Manual shutdown'): Promise<void> {
    console.log(`[KAIROS] Stopping daemon: ${reason}`);
    this.shutdownRequested = true;
    this.state = 'shutdown';

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.schedulerTimer) clearInterval(this.schedulerTimer);

    const shutdownTimeout = 30000;
    const startTime = Date.now();
    
    while (this.runningTasks.size > 0 && Date.now() - startTime < shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    for (const [id, task] of this.runningTasks.entries()) {
      task.status = 'cancelled';
      task.error = 'Daemon shutdown';
      this.runningTasks.delete(id);
    }

    if (this.autoDreamRef) this.autoDreamRef.stop();

    this.emit('stopped', { reason, timestamp: new Date() });
    console.log('[KAIROS] Daemon stopped');
  }

  /**
   * Pause daemon
   */
  pause(): void {
    if (this.state === 'running') {
      this.state = 'paused';
      console.log('[KAIROS] Daemon paused');
      this.emit('paused', { timestamp: new Date() });
    }
  }

  /**
   * Resume daemon
   */
  resume(): void {
    if (this.state === 'paused') {
      this.state = 'running';
      console.log('[KAIROS] Daemon resumed');
      this.emit('resumed', { timestamp: new Date() });
    }
  }

  /**
   * Heartbeat
   */
  private async heartbeat(): Promise<void> {
    this.metrics.lastHeartbeat = new Date();
    this.metrics.uptime = Date.now() - this.startTime.getTime();
    
    const timeSinceActivity = Date.now() - this.lastActivity.getTime();
    const wasIdle = this.isIdle;
    this.isIdle = timeSinceActivity > this.config.idleThreshold;

    if (this.isIdle && !wasIdle) {
      console.log('[KAIROS] System entered idle state');
      this.emit('idle', { timestamp: new Date() });
      await this.onIdleEnter();
    } else if (!this.isIdle && wasIdle) {
      console.log('[KAIROS] System exited idle state');
      this.emit('active', { timestamp: new Date() });
    }

    this.updateMetrics();

    if (this.state === 'running') {
      await this.processQueue();
    }

    this.emit('heartbeat', { metrics: this.metrics, state: this.state });
  }

  /**
   * Handle idle state entry
   */
  private async onIdleEnter(): Promise<void> {
    if (this.config.proactiveMode) {
      await this.enqueueTask({
        name: 'Idle Memory Consolidation',
        type: 'memory_consolidation',
        priority: 'background',
        trigger: 'proactive',
        payload: { deepScan: true, idleMode: true },
      });

      const proactiveActions = await this.generateProactiveActions();
      for (const action of proactiveActions) {
        if (!action.requiresApproval) {
          await this.enqueueTask({
            name: action.action,
            type: 'proactive_analysis',
            priority: action.priority,
            trigger: 'proactive',
            payload: { action },
          });
        }
      }
    }
  }

  /**
   * Generate proactive actions
   */
  private async generateProactiveActions(): Promise<ProactiveAction[]> {
    const actions: ProactiveAction[] = [];

    if (this.memoryLayerRef) {
      const staleContexts = await this.memoryLayerRef.getStaleContexts();
      if (staleContexts.length > 0) {
        actions.push({
          id: uuidv4(),
          trigger: 'stale_context',
          action: 'Refresh stale project contexts',
          reasoning: `${staleContexts.length} contexts need refresh`,
          priority: 'low',
          estimatedDuration: 60000,
          requiresApproval: false,
        });
      }

      const pendingResearch = await this.memoryLayerRef.getPendingResearch();
      if (pendingResearch.length > 0) {
        actions.push({
          id: uuidv4(),
          trigger: 'pending_research',
          action: 'Continue background research',
          reasoning: `${pendingResearch.length} research items pending`,
          priority: 'normal',
          estimatedDuration: 120000,
          requiresApproval: false,
        });
      }
    }

    return actions;
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    const memUsage = process.memoryUsage();
    this.metrics.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
    this.metrics.currentLoad = this.runningTasks.size / this.config.maxConcurrentTasks;
    
    if (this.isIdle) {
      this.metrics.idleTime += this.config.heartbeatInterval;
    }
  }

  /**
   * Check schedules
   */
  private checkSchedules(): void {
    if (this.state !== 'running') return;

    const now = new Date();
    
    for (const [id, schedule] of this.schedules.entries()) {
      if (!schedule.enabled) continue;

      const nextRun = this.getNextRunTime(schedule.cron);
      schedule.nextRun = nextRun;

      if (nextRun && nextRun <= now) {
        if (schedule.lastRun) {
          const timeSinceLastRun = now.getTime() - schedule.lastRun.getTime();
          if (timeSinceLastRun < 60000) continue;
        }

        this.enqueueTask({
          name: schedule.name,
          type: schedule.taskType,
          priority: 'normal',
          trigger: 'scheduled',
          payload: schedule.payload,
        });

        schedule.lastRun = now;
      }
    }
  }

  /**
   * Get next run time
   */
  private getNextRunTime(cron: string): Date | null {
    const parts = cron.split(' ');
    if (parts.length !== 5) return null;

    const [minute] = parts;
    const now = new Date();

    if (minute.startsWith('*/')) {
      const interval = parseInt(minute.substring(2));
      const nextMinute = Math.ceil(now.getMinutes() / interval) * interval;
      const next = new Date(now);
      next.setMinutes(nextMinute, 0, 0);
      if (next <= now) {
        next.setMinutes(next.getMinutes() + interval);
      }
      return next;
    }

    const next = new Date(now);
    next.setHours(next.getHours() + 1, 0, 0, 0);
    return next;
  }

  /**
   * Enqueue task
   */
  async enqueueTask(params: {
    name: string;
    type: TaskType;
    priority: TaskPriority;
    trigger: TaskTrigger;
    payload: Record<string, unknown>;
    dependencies?: string[];
    timeout?: number;
    maxRetries?: number;
  }): Promise<DaemonTask> {
    const task: DaemonTask = {
      id: uuidv4(),
      name: params.name,
      type: params.type,
      priority: params.priority,
      trigger: params.trigger,
      payload: params.payload,
      scheduledAt: new Date(),
      status: 'pending',
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      dependencies: params.dependencies || [],
      timeout: params.timeout ?? 300000,
    };

    this.taskQueue.set(task.id, task);
    this.emit('task:queued', { task });
    
    console.log(`[KAIROS] Task queued: ${task.name} (${task.id})`);
    
    return task;
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    if (this.runningTasks.size >= this.config.maxConcurrentTasks) return;

    const nextTask = this.getNextTask();
    if (!nextTask) return;

    const pendingDeps = nextTask.dependencies.filter(
      depId => this.taskQueue.has(depId) || this.runningTasks.has(depId)
    );
    
    if (pendingDeps.length > 0) return;

    await this.executeTask(nextTask);
  }

  /**
   * Get next task
   */
  private getNextTask(): DaemonTask | null {
    const priorityOrder: TaskPriority[] = ['critical', 'high', 'normal', 'low', 'background'];
    
    for (const priority of priorityOrder) {
      for (const task of this.taskQueue.values()) {
        if (task.status === 'pending' && task.priority === priority) {
          return task;
        }
      }
    }
    
    return null;
  }

  /**
   * Execute task
   */
  private async executeTask(task: DaemonTask): Promise<void> {
    this.taskQueue.delete(task.id);
    task.status = 'running';
    task.startedAt = new Date();
    this.runningTasks.set(task.id, task);
    
    console.log(`[KAIROS] Executing task: ${task.name}`);
    this.emit('task:started', { task });

    try {
      let result: unknown;
      
      switch (task.type) {
        case 'memory_consolidation':
          result = await this.executeMemoryConsolidation(task);
          break;
        case 'context_optimization':
          result = await this.executeContextOptimization(task);
          break;
        case 'health_check':
          result = await this.executeHealthCheck(task);
          break;
        case 'cleanup':
          result = await this.executeCleanup(task);
          break;
        case 'proactive_analysis':
          result = await this.executeProactiveAnalysis(task);
          break;
        case 'background_research':
          result = await this.executeBackgroundResearch(task);
          break;
        case 'sync':
          result = await this.executeSync(task);
          break;
        case 'notification':
          result = await this.executeNotification(task);
          break;
        case 'custom':
          result = await this.executeCustom(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      task.result = result;
      task.status = 'completed';
      task.completedAt = new Date();
      this.metrics.tasksCompleted++;
      
      console.log(`[KAIROS] Task completed: ${task.name}`);
      this.emit('task:completed', { task, result });

    } catch (error: any) {
      task.error = error.message;
      task.retryCount++;

      if (task.retryCount < task.maxRetries) {
        task.status = 'pending';
        this.taskQueue.set(task.id, task);
        console.log(`[KAIROS] Task retry: ${task.name} (${task.retryCount}/${task.maxRetries})`);
      } else {
        task.status = 'failed';
        task.completedAt = new Date();
        this.metrics.tasksFailed++;
        console.error(`[KAIROS] Task failed: ${task.name} - ${error.message}`);
        this.emit('task:failed', { task, error });
      }
    } finally {
      this.runningTasks.delete(task.id);
      this.completedTasks.push(task);
      this.lastActivity = new Date();
    }
  }

  // ============================================
  // Task Executors
  // ============================================

  private async executeMemoryConsolidation(task: DaemonTask): Promise<unknown> {
    const payload = task.payload as { deepScan?: boolean; idleMode?: boolean };
    console.log(`[KAIROS] Running memory consolidation (deep: ${payload.deepScan})`);
    
    if (this.autoDreamRef) {
      return await this.autoDreamRef.runConsolidation({
        deepScan: payload.deepScan || false,
        optimizeMemory: payload.idleMode,
      });
    }
    
    return { status: 'skipped', reason: 'autoDream not initialized' };
  }

  private async executeContextOptimization(task: DaemonTask): Promise<unknown> {
    console.log('[KAIROS] Running context optimization');
    if (this.memoryLayerRef) {
      return await this.memoryLayerRef.optimize();
    }
    return { status: 'skipped', reason: 'memoryLayer not initialized' };
  }

  private async executeHealthCheck(task: DaemonTask): Promise<unknown> {
    const payload = task.payload as { startup?: boolean };
    
    const health = {
      daemonState: this.state,
      uptime: this.metrics.uptime,
      queueSize: this.taskQueue.size,
      runningTasks: this.runningTasks.size,
      memoryUsageMB: this.metrics.memoryUsage,
      lastHeartbeat: this.metrics.lastHeartbeat,
      isIdle: this.isIdle,
      autoDreamStatus: this.autoDreamRef?.getStatus?.() || 'not initialized',
      memoryLayerStatus: await this.memoryLayerRef?.getHealth?.() || 'not initialized',
      orchestratorStatus: this.orchestratorRef?.getStatus?.() || 'not initialized',
    };

    return health;
  }

  private async executeCleanup(task: DaemonTask): Promise<unknown> {
    console.log('[KAIROS] Running cleanup');
    
    const now = Date.now();
    const retention = this.config.taskRetention;
    
    const beforeCount = this.completedTasks.length;
    this.completedTasks = this.completedTasks.filter(
      t => t.completedAt && now - t.completedAt.getTime() < retention
    );
    
    const memoryCleanup = this.memoryLayerRef ? await this.memoryLayerRef.cleanup() : null;

    return {
      tasksRemoved: beforeCount - this.completedTasks.length,
      memoryCleanup,
    };
  }

  private async executeProactiveAnalysis(task: DaemonTask): Promise<unknown> {
    const payload = task.payload as { action: ProactiveAction };
    console.log(`[KAIROS] Running proactive analysis: ${payload.action.action}`);
    
    if (this.memoryLayerRef) {
      return await this.memoryLayerRef.analyzeContext(payload.action.trigger);
    }
    return { status: 'skipped', reason: 'memoryLayer not initialized' };
  }

  private async executeBackgroundResearch(task: DaemonTask): Promise<unknown> {
    console.log('[KAIROS] Running background research');
    return { status: 'completed', message: 'Background research placeholder' };
  }

  private async executeSync(task: DaemonTask): Promise<unknown> {
    console.log('[KAIROS] Running sync');
    if (this.memoryLayerRef) {
      return await this.memoryLayerRef.sync();
    }
    return { status: 'skipped' };
  }

  private async executeNotification(task: DaemonTask): Promise<unknown> {
    const payload = task.payload as { message: string; type: string };
    console.log(`[KAIROS] Notification: ${payload.message}`);
    this.emit('notification', payload);
    return { delivered: true };
  }

  private async executeCustom(task: DaemonTask): Promise<unknown> {
    console.log(`[KAIROS] Running custom task: ${task.name}`);
    this.emit('custom:task', task);
    return { status: 'emitted' };
  }

  // ============================================
  // Public API
  // ============================================

  getState(): DaemonState {
    return this.state;
  }

  getMetrics(): DaemonMetrics {
    return { ...this.metrics };
  }

  getTask(taskId: string): DaemonTask | undefined {
    return this.taskQueue.get(taskId) || 
           this.runningTasks.get(taskId) ||
           this.completedTasks.find(t => t.id === taskId);
  }

  getAllTasks(): { queued: DaemonTask[]; running: DaemonTask[]; completed: DaemonTask[] } {
    return {
      queued: Array.from(this.taskQueue.values()),
      running: Array.from(this.runningTasks.values()),
      completed: this.completedTasks.slice(-100),
    };
  }

  cancelTask(taskId: string): boolean {
    const task = this.taskQueue.get(taskId);
    if (task && task.status === 'pending') {
      task.status = 'cancelled';
      this.taskQueue.delete(taskId);
      this.emit('task:cancelled', { task });
      return true;
    }
    return false;
  }

  registerSchedule(schedule: ScheduleConfig): void {
    this.schedules.set(schedule.id, schedule);
    console.log(`[KAIROS] Schedule registered: ${schedule.name}`);
  }

  unregisterSchedule(scheduleId: string): boolean {
    return this.schedules.delete(scheduleId);
  }

  recordActivity(): void {
    this.lastActivity = new Date();
  }

  isIdleState(): boolean {
    return this.isIdle;
  }

  getSchedules(): ScheduleConfig[] {
    return Array.from(this.schedules.values());
  }
}

// ============================================
// Singleton Export
// ============================================

export const kairosDaemon = new KairosDaemon();
