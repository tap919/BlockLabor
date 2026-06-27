/**
 * MemoryLayer - Persistent Context Storage
 * 
 * A first-class architectural feature that acts as a persistent memory layer
 * where agents store project rules, naming patterns, and build commands
 * to maintain context across different sessions.
 * 
 * Features:
 * - Persistent project context storage
 * - Rule and pattern management
 * - Session-to-session continuity
 * - Context versioning and history
 * - Staleness detection and refresh
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types and Interfaces
// ============================================

export interface ProjectContext {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  rules: ProjectRule[];
  patterns: NamingPattern[];
  commands: BuildCommand[];
  dependencies: Dependency[];
  environment: EnvironmentConfig;
  metadata: ContextMetadata;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  version: number;
  active: boolean;
}

export interface ProjectRule {
  id: string;
  name: string;
  description: string;
  category: 'coding' | 'architecture' | 'security' | 'testing' | 'deployment' | 'custom';
  content: string;
  priority: number;
  enabled: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NamingPattern {
  id: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'constant' | 'component';
  pattern: string;
  example: string;
  description: string;
  enforcement: 'strict' | 'recommended' | 'optional';
}

export interface BuildCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  category: 'build' | 'test' | 'deploy' | 'dev' | 'utility';
  timeout: number;
  environment: Record<string, string>;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer' | 'optional';
  purpose?: string;
}

export interface EnvironmentConfig {
  variables: Record<string, string>;
  secrets: string[]; // References to secrets manager
  profiles: EnvironmentProfile[];
}

export interface EnvironmentProfile {
  name: string;
  variables: Record<string, string>;
  default: boolean;
}

export interface ContextMetadata {
  framework?: string;
  language?: string;
  packageManager?: string;
  testFramework?: string;
  cicd?: string;
  customFields: Record<string, unknown>;
}

export interface MemoryEntry {
  id: string;
  contextId: string;
  type: 'observation' | 'decision' | 'learning' | 'error' | 'success' | 'note';
  content: string;
  metadata: Record<string, unknown>;
  importance: number; // 0-1
  createdAt: Date;
  expiresAt?: Date;
}

export interface ResearchTask {
  id: string;
  contextId: string;
  query: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  result?: string;
  priority: number;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================
// Memory Layer Class
// ============================================

export class MemoryLayer {
  private basePath: string;
  private contexts: Map<string, ProjectContext> = new Map();
  private memory: Map<string, MemoryEntry> = new Map();
  private research: Map<string, ResearchTask> = new Map();
  private initialized: boolean = false;

  constructor(basePath: string = '/home/z/my-project/memory') {
    this.basePath = basePath;
  }

  /**
   * Initialize memory layer
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.basePath, { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'contexts'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'memory'), { recursive: true });
      await fs.mkdir(path.join(this.basePath, 'research'), { recursive: true });

      await this.loadContexts();
      await this.loadMemory();
      await this.loadResearch();

      this.initialized = true;
      console.log('[MemoryLayer] Initialized successfully');
    } catch (error) {
      console.error('[MemoryLayer] Initialization failed:', error);
      throw error;
    }
  }

  // ============================================
  // Context Management
  // ============================================

  /**
   * Create a new project context
   */
  async createContext(params: {
    projectId: string;
    name: string;
    description?: string;
    framework?: string;
    language?: string;
    packageManager?: string;
  }): Promise<ProjectContext> {
    await this.ensureInitialized();

    const context: ProjectContext = {
      id: uuidv4(),
      projectId: params.projectId,
      name: params.name,
      description: params.description,
      rules: [],
      patterns: [],
      commands: [],
      dependencies: [],
      environment: {
        variables: {},
        secrets: [],
        profiles: [],
      },
      metadata: {
        framework: params.framework,
        language: params.language,
        packageManager: params.packageManager,
        customFields: {},
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      version: 1,
      active: true,
    };

    this.contexts.set(context.id, context);
    await this.persistContext(context);

    console.log(`[MemoryLayer] Created context: ${context.name} (${context.id})`);
    return context;
  }

  /**
   * Get context by ID
   */
  async getContext(contextId: string): Promise<ProjectContext | null> {
    await this.ensureInitialized();

    const context = this.contexts.get(contextId);
    if (context) {
      context.lastAccessedAt = new Date();
      return context;
    }
    return null;
  }

  /**
   * Get context by project ID
   */
  async getContextByProject(projectId: string): Promise<ProjectContext | null> {
    await this.ensureInitialized();

    for (const context of this.contexts.values()) {
      if (context.projectId === projectId) {
        context.lastAccessedAt = new Date();
        return context;
      }
    }
    return null;
  }

  /**
   * Update context
   */
  async updateContext(contextId: string, updates: Partial<ProjectContext>): Promise<ProjectContext | null> {
    await this.ensureInitialized();

    const context = this.contexts.get(contextId);
    if (!context) return null;

    Object.assign(context, updates, {
      updatedAt: new Date(),
      version: context.version + 1,
    });

    await this.persistContext(context);
    return context;
  }

  /**
   * Add rule to context
   */
  async addRule(contextId: string, rule: Omit<ProjectRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectRule | null> {
    const context = this.contexts.get(contextId);
    if (!context) return null;

    const newRule: ProjectRule = {
      ...rule,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    context.rules.push(newRule);
    context.updatedAt = new Date();
    context.version++;

    await this.persistContext(context);
    return newRule;
  }

  /**
   * Add naming pattern to context
   */
  async addPattern(contextId: string, pattern: Omit<NamingPattern, 'id'>): Promise<NamingPattern | null> {
    const context = this.contexts.get(contextId);
    if (!context) return null;

    const newPattern: NamingPattern = {
      ...pattern,
      id: uuidv4(),
    };

    context.patterns.push(newPattern);
    context.updatedAt = new Date();

    await this.persistContext(context);
    return newPattern;
  }

  /**
   * Add build command to context
   */
  async addCommand(contextId: string, command: Omit<BuildCommand, 'id'>): Promise<BuildCommand | null> {
    const context = this.contexts.get(contextId);
    if (!context) return null;

    const newCommand: BuildCommand = {
      ...command,
      id: uuidv4(),
    };

    context.commands.push(newCommand);
    context.updatedAt = new Date();

    await this.persistContext(context);
    return newCommand;
  }

  /**
   * List all contexts
   */
  async listContexts(): Promise<ProjectContext[]> {
    await this.ensureInitialized();
    return Array.from(this.contexts.values());
  }

  /**
   * Get stale contexts (not accessed in threshold time)
   */
  async getStaleContexts(thresholdMs: number = 7 * 24 * 60 * 60 * 1000): Promise<ProjectContext[]> {
    await this.ensureInitialized();

    const now = Date.now();
    return Array.from(this.contexts.values()).filter(
      context => now - context.lastAccessedAt.getTime() > thresholdMs
    );
  }

  // ============================================
  // Memory Management
  // ============================================

  /**
   * Store a memory entry
   */
  async storeMemory(params: {
    contextId: string;
    type: MemoryEntry['type'];
    content: string;
    metadata?: Record<string, unknown>;
    importance?: number;
    expiresIn?: number;
  }): Promise<MemoryEntry> {
    await this.ensureInitialized();

    const entry: MemoryEntry = {
      id: uuidv4(),
      contextId: params.contextId,
      type: params.type,
      content: params.content,
      metadata: params.metadata || {},
      importance: params.importance ?? 0.5,
      createdAt: new Date(),
      expiresAt: params.expiresIn ? new Date(Date.now() + params.expiresIn) : undefined,
    };

    this.memory.set(entry.id, entry);
    await this.persistMemoryEntry(entry);

    return entry;
  }

  /**
   * Get memories for context
   */
  async getMemories(contextId: string, type?: MemoryEntry['type']): Promise<MemoryEntry[]> {
    await this.ensureInitialized();

    const now = new Date();
    return Array.from(this.memory.values()).filter(entry => {
      if (entry.contextId !== contextId) return false;
      if (type && entry.type !== type) return false;
      if (entry.expiresAt && entry.expiresAt < now) return false;
      return true;
    }).sort((a, b) => b.importance - a.importance);
  }

  /**
   * Search memories
   */
  async searchMemories(query: string, contextId?: string): Promise<MemoryEntry[]> {
    await this.ensureInitialized();

    const lowerQuery = query.toLowerCase();
    const now = new Date();

    return Array.from(this.memory.values()).filter(entry => {
      if (contextId && entry.contextId !== contextId) return false;
      if (entry.expiresAt && entry.expiresAt < now) return false;
      return entry.content.toLowerCase().includes(lowerQuery);
    }).sort((a, b) => b.importance - a.importance);
  }

  // ============================================
  // Research Management
  // ============================================

  /**
   * Create research task
   */
  async createResearch(params: {
    contextId: string;
    query: string;
    priority?: number;
  }): Promise<ResearchTask> {
    await this.ensureInitialized();

    const task: ResearchTask = {
      id: uuidv4(),
      contextId: params.contextId,
      query: params.query,
      status: 'pending',
      priority: params.priority ?? 5,
      createdAt: new Date(),
    };

    this.research.set(task.id, task);
    await this.persistResearchTask(task);

    return task;
  }

  /**
   * Get pending research
   */
  async getPendingResearch(): Promise<ResearchTask[]> {
    await this.ensureInitialized();

    return Array.from(this.research.values())
      .filter(task => task.status === 'pending')
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Complete research task
   */
  async completeResearch(taskId: string, result: string): Promise<ResearchTask | null> {
    const task = this.research.get(taskId);
    if (!task) return null;

    task.status = 'completed';
    task.result = result;
    task.completedAt = new Date();

    await this.persistResearchTask(task);
    return task;
  }

  // ============================================
  // Optimization and Maintenance
  // ============================================

  /**
   * Optimize memory layer
   */
  async optimize(): Promise<{
    memoriesRemoved: number;
    contextsOptimized: number;
    researchCompleted: number;
  }> {
    await this.ensureInitialized();

    const now = new Date();
    let memoriesRemoved = 0;
    let contextsOptimized = 0;
    let researchCompleted = 0;

    // Remove expired memories
    for (const [id, entry] of this.memory.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.memory.delete(id);
        memoriesRemoved++;
      }
    }

    // Optimize contexts
    for (const context of this.contexts.values()) {
      // Remove duplicate rules
      const seenRules = new Set<string>();
      const originalRules = context.rules.length;
      context.rules = context.rules.filter(rule => {
        const key = `${rule.category}:${rule.name}`;
        if (seenRules.has(key)) return false;
        seenRules.add(key);
        return true;
      });
      if (context.rules.length < originalRules) {
        contextsOptimized++;
        await this.persistContext(context);
      }
    }

    // Complete stale research
    for (const task of this.research.values()) {
      if (task.status === 'pending' && 
          now.getTime() - task.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
        task.status = 'cancelled';
        researchCompleted++;
      }
    }

    console.log(`[MemoryLayer] Optimization complete: ${memoriesRemoved} memories removed, ${contextsOptimized} contexts optimized`);

    return { memoriesRemoved, contextsOptimized, researchCompleted };
  }

  /**
   * Sync memory layer to disk
   */
  async sync(): Promise<void> {
    await this.ensureInitialized();

    for (const context of this.contexts.values()) {
      await this.persistContext(context);
    }

    for (const entry of this.memory.values()) {
      await this.persistMemoryEntry(entry);
    }

    console.log('[MemoryLayer] Sync complete');
  }

  /**
   * Cleanup old data
   */
  async cleanup(): Promise<{
    contextsRemoved: number;
    memoriesRemoved: number;
    researchRemoved: number;
  }> {
    const result = await this.optimize();

    // Remove inactive contexts older than 30 days
    const threshold = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let contextsRemoved = 0;

    for (const [id, context] of this.contexts.entries()) {
      if (!context.active && now - context.updatedAt.getTime() > threshold) {
        this.contexts.delete(id);
        contextsRemoved++;
      }
    }

    return {
      contextsRemoved,
      memoriesRemoved: result.memoriesRemoved,
      researchRemoved: result.researchCompleted,
    };
  }

  /**
   * Analyze context for proactive actions
   */
  async analyzeContext(trigger: string): Promise<{
    insights: string[];
    recommendations: string[];
    actions: string[];
  }> {
    await this.ensureInitialized();

    const insights: string[] = [];
    const recommendations: string[] = [];
    const actions: string[] = [];

    switch (trigger) {
      case 'stale_context':
        insights.push('Some contexts have not been accessed recently');
        recommendations.push('Consider archiving or refreshing stale contexts');
        actions.push('run_context_refresh');
        break;

      case 'pending_research':
        insights.push('Research tasks are pending completion');
        recommendations.push('Prioritize and complete pending research');
        actions.push('run_research_completion');
        break;

      case 'memory_pressure':
        insights.push('Memory usage is elevated');
        recommendations.push('Run optimization to clean up unused data');
        actions.push('run_memory_optimization');
        break;
    }

    return { insights, recommendations, actions };
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{
    status: string;
    contextCount: number;
    memoryCount: number;
    researchCount: number;
    initialized: boolean;
  }> {
    return {
      status: this.initialized ? 'healthy' : 'not_initialized',
      contextCount: this.contexts.size,
      memoryCount: this.memory.size,
      researchCount: this.research.size,
      initialized: this.initialized,
    };
  }

  // ============================================
  // Persistence
  // ============================================

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async loadContexts(): Promise<void> {
    try {
      const contextDir = path.join(this.basePath, 'contexts');
      const files = await fs.readdir(contextDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(contextDir, file), 'utf-8');
          const context = JSON.parse(content);
          // Convert date strings back to Date objects
          context.createdAt = new Date(context.createdAt);
          context.updatedAt = new Date(context.updatedAt);
          context.lastAccessedAt = new Date(context.lastAccessedAt);
          this.contexts.set(context.id, context);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty
    }
  }

  private async loadMemory(): Promise<void> {
    try {
      const memoryDir = path.join(this.basePath, 'memory');
      const files = await fs.readdir(memoryDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(memoryDir, file), 'utf-8');
          const entry = JSON.parse(content);
          entry.createdAt = new Date(entry.createdAt);
          if (entry.expiresAt) entry.expiresAt = new Date(entry.expiresAt);
          this.memory.set(entry.id, entry);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty
    }
  }

  private async loadResearch(): Promise<void> {
    try {
      const researchDir = path.join(this.basePath, 'research');
      const files = await fs.readdir(researchDir);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(researchDir, file), 'utf-8');
          const task = JSON.parse(content);
          task.createdAt = new Date(task.createdAt);
          if (task.completedAt) task.completedAt = new Date(task.completedAt);
          this.research.set(task.id, task);
        }
      }
    } catch (error) {
      // Directory doesn't exist or is empty
    }
  }

  private async persistContext(context: ProjectContext): Promise<void> {
    const contextPath = path.join(this.basePath, 'contexts', `${context.id}.json`);
    await fs.writeFile(contextPath, JSON.stringify(context, null, 2));
  }

  private async persistMemoryEntry(entry: MemoryEntry): Promise<void> {
    const entryPath = path.join(this.basePath, 'memory', `${entry.id}.json`);
    await fs.writeFile(entryPath, JSON.stringify(entry, null, 2));
  }

  private async persistResearchTask(task: ResearchTask): Promise<void> {
    const taskPath = path.join(this.basePath, 'research', `${task.id}.json`);
    await fs.writeFile(taskPath, JSON.stringify(task, null, 2));
  }
}

// ============================================
// Singleton Export
// ============================================

export const memoryLayer = new MemoryLayer();
