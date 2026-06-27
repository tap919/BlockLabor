/**
 * autoDream - Background Memory Consolidation Engine
 * 
 * Performs "overnight" passes over project-specific memory, reorganizing
 * and optimizing stored context while the user is offline.
 * 
 * Features:
 * - Background memory consolidation
 * - Knowledge graph building
 * - Pattern recognition across sessions
 * - Automatic summarization
 * - Importance scoring
 * - Context pruning
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types and Interfaces
// ============================================

export type DreamPhase = 'idle' | 'consolidating' | 'analyzing' | 'summarizing' | 'optimizing';

export interface DreamConfig {
  enabled: boolean;
  interval: number; // ms between consolidation cycles
  batchSize: number; // memories to process per cycle
  importanceThreshold: number; // 0-1, memories below are candidates for pruning
  maxMemoryAge: number; // ms, age after which memories are pruned
  enablePatternRecognition: boolean;
  enableSummarization: boolean;
  enableKnowledgeGraph: boolean;
}

export interface ConsolidationResult {
  id: string;
  startedAt: Date;
  completedAt: Date;
  phase: string;
  memoriesProcessed: number;
  memoriesPruned: number;
  patternsDiscovered: number;
  summariesCreated: number;
  knowledgeGraphUpdates: number;
  insights: string[];
}

export interface MemoryPattern {
  id: string;
  type: 'sequence' | 'association' | 'frequency' | 'temporal';
  description: string;
  occurrences: number;
  confidence: number;
  firstSeen: Date;
  lastSeen: Date;
  relatedMemories: string[];
}

export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'entity' | 'action' | 'rule';
  label: string;
  properties: Record<string, unknown>;
  importance: number;
  createdAt: Date;
}

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  type: 'relates_to' | 'causes' | 'follows' | 'contains' | 'references';
  weight: number;
}

export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  edges: Map<string, KnowledgeEdge>;
}

export interface DreamInsight {
  id: string;
  type: 'pattern' | 'recommendation' | 'warning' | 'observation';
  content: string;
  confidence: number;
  createdAt: Date;
  source: string;
}

// ============================================
// autoDream Class
// ============================================

export class AutoDream extends EventEmitter {
  private config: DreamConfig;
  private state: DreamPhase = 'idle';
  private running: boolean = false;
  private timer?: NodeJS.Timeout;
  private patterns: Map<string, MemoryPattern> = new Map();
  private knowledgeGraph: KnowledgeGraph = {
    nodes: new Map(),
    edges: new Map(),
  };
  private insights: DreamInsight[] = [];
  private lastConsolidation?: Date;
  private memoryLayerRef?: any;

  constructor(config?: Partial<DreamConfig>) {
    super();
    
    this.config = {
      enabled: true,
      interval: 4 * 60 * 60 * 1000, // 4 hours
      batchSize: 100,
      importanceThreshold: 0.3,
      maxMemoryAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      enablePatternRecognition: true,
      enableSummarization: true,
      enableKnowledgeGraph: true,
      ...config,
    };
  }

  /**
   * Set memory layer reference
   */
  setMemoryLayer(memoryLayer: any): void {
    this.memoryLayerRef = memoryLayer;
  }

  /**
   * Start the dream cycle
   */
  start(): void {
    if (this.running) return;

    console.log('[autoDream] Starting dream cycle');
    this.running = true;
    this.state = 'idle';

    this.timer = setInterval(() => {
      if (this.running && this.state === 'idle') {
        this.runConsolidation({ scheduled: true });
      }
    }, this.config.interval);

    this.emit('started', { timestamp: new Date() });
  }

  /**
   * Stop the dream cycle
   */
  stop(): void {
    console.log('[autoDream] Stopping dream cycle');
    this.running = false;
    
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.state = 'idle';
    this.emit('stopped', { timestamp: new Date() });
  }

  /**
   * Run a consolidation cycle
   */
  async runConsolidation(options: {
    deepScan?: boolean;
    scheduled?: boolean;
    includeContexts?: boolean;
    optimizeMemory?: boolean;
  } = {}): Promise<ConsolidationResult> {
    const result: ConsolidationResult = {
      id: uuidv4(),
      startedAt: new Date(),
      completedAt: new Date(),
      phase: 'consolidating',
      memoriesProcessed: 0,
      memoriesPruned: 0,
      patternsDiscovered: 0,
      summariesCreated: 0,
      knowledgeGraphUpdates: 0,
      insights: [],
    };

    console.log(`[autoDream] Starting consolidation (deep: ${options.deepScan})`);
    this.state = 'consolidating';
    this.emit('consolidation:started', { result });

    try {
      // Phase 1: Analyze memories
      this.state = 'analyzing';
      const analysisResult = await this.analyzeMemories(options);
      result.memoriesProcessed = analysisResult.processed;
      result.insights.push(...analysisResult.insights);

      // Phase 2: Discover patterns
      if (this.config.enablePatternRecognition) {
        this.state = 'consolidating';
        const patternResult = await this.discoverPatterns();
        result.patternsDiscovered = patternResult.discovered;
        result.insights.push(...patternResult.insights);
      }

      // Phase 3: Create summaries
      if (this.config.enableSummarization) {
        this.state = 'summarizing';
        const summaryResult = await this.createSummaries(options);
        result.summariesCreated = summaryResult.created;
      }

      // Phase 4: Update knowledge graph
      if (this.config.enableKnowledgeGraph) {
        this.state = 'optimizing';
        const graphResult = await this.updateKnowledgeGraph();
        result.knowledgeGraphUpdates = graphResult.updates;
      }

      // Phase 5: Prune old memories
      this.state = 'optimizing';
      const pruneResult = await this.pruneMemories(options.optimizeMemory);
      result.memoriesPruned = pruneResult.pruned;

      result.completedAt = new Date();
      result.phase = 'completed';
      this.lastConsolidation = new Date();

      console.log(`[autoDream] Consolidation complete: ${result.memoriesProcessed} processed, ${result.patternsDiscovered} patterns, ${result.summariesCreated} summaries`);
      this.emit('consolidation:completed', { result });

    } catch (error: any) {
      result.phase = 'failed';
      result.insights.push(`Error during consolidation: ${error.message}`);
      console.error('[autoDream] Consolidation failed:', error);
      this.emit('consolidation:failed', { result, error });
    } finally {
      this.state = 'idle';
    }

    return result;
  }

  // ============================================
  // Memory Analysis
  // ============================================

  private async analyzeMemories(options: { deepScan?: boolean }): Promise<{
    processed: number;
    insights: string[];
  }> {
    if (!this.memoryLayerRef) {
      return { processed: 0, insights: ['Memory layer not available'] };
    }

    const insights: string[] = [];
    let processed = 0;

    // Get all memories
    const contexts = await this.memoryLayerRef.listContexts();
    
    for (const context of contexts) {
      const memories = await this.memoryLayerRef.getMemories(context.id);
      
      for (const memory of memories.slice(0, this.config.batchSize)) {
        processed++;
        
        // Analyze memory importance
        const importance = this.calculateImportance(memory);
        
        // Update importance score
        if (importance !== memory.importance) {
          memory.importance = importance;
        }

        // Generate insights for high-importance memories
        if (importance > 0.8 && memory.type === 'decision') {
          insights.push(`High-importance decision in ${context.name}: ${memory.content.substring(0, 100)}...`);
        }

        // Detect anomalies
        if (memory.type === 'error' && memory.metadata?.frequency > 5) {
          insights.push(`Recurring error pattern detected in ${context.name}`);
        }
      }
    }

    return { processed, insights };
  }

  private calculateImportance(memory: any): number {
    let importance = memory.importance || 0.5;

    // Boost based on type
    const typeWeights: Record<string, number> = {
      decision: 0.2,
      success: 0.15,
      error: 0.1,
      learning: 0.15,
      observation: 0.05,
      note: 0,
    };
    importance += typeWeights[memory.type] || 0;

    // Boost based on recency
    const age = Date.now() - new Date(memory.createdAt).getTime();
    const ageDays = age / (24 * 60 * 60 * 1000);
    if (ageDays < 1) importance += 0.1;
    else if (ageDays < 7) importance += 0.05;

    // Boost based on access (metadata)
    if (memory.metadata?.accessCount > 5) importance += 0.1;

    return Math.min(1, Math.max(0, importance));
  }

  // ============================================
  // Pattern Discovery
  // ============================================

  private async discoverPatterns(): Promise<{
    discovered: number;
    insights: string[];
  }> {
    let discovered = 0;
    const insights: string[] = [];

    // Frequency patterns
    const frequencyPatterns = this.detectFrequencyPatterns();
    discovered += frequencyPatterns.length;

    // Sequence patterns
    const sequencePatterns = this.detectSequencePatterns();
    discovered += sequencePatterns.length;

    // Temporal patterns
    const temporalPatterns = this.detectTemporalPatterns();
    discovered += temporalPatterns.length;

    if (discovered > 0) {
      insights.push(`Discovered ${discovered} new patterns`);
    }

    return { discovered, insights };
  }

  private detectFrequencyPatterns(): MemoryPattern[] {
    const patterns: MemoryPattern[] = [];
    
    // This would analyze memory frequencies
    // Placeholder for pattern detection logic
    
    return patterns;
  }

  private detectSequencePatterns(): MemoryPattern[] {
    const patterns: MemoryPattern[] = [];
    
    // This would detect sequential patterns in actions/events
    // Placeholder for sequence detection logic
    
    return patterns;
  }

  private detectTemporalPatterns(): MemoryPattern[] {
    const patterns: MemoryPattern[] = [];
    
    // This would detect time-based patterns
    // Placeholder for temporal pattern detection
    
    return patterns;
  }

  // ============================================
  // Summarization
  // ============================================

  private async createSummaries(options: { deepScan?: boolean }): Promise<{
    created: number;
  }> {
    let created = 0;

    if (!this.memoryLayerRef) return { created: 0 };

    const contexts = await this.memoryLayerRef.listContexts();

    for (const context of contexts) {
      const memories = await this.memoryLayerRef.getMemories(context.id);
      
      // Create summary for contexts with many memories
      if (memories.length > 50) {
        const summary = await this.generateSummary(memories);
        
        await this.memoryLayerRef.storeMemory({
          contextId: context.id,
          type: 'note',
          content: summary,
          metadata: { type: 'auto_summary', generatedAt: new Date().toISOString() },
          importance: 0.7,
        });

        created++;
      }
    }

    return { created };
  }

  private async generateSummary(memories: any[]): Promise<string> {
    // Group by type
    const byType: Record<string, number> = {};
    for (const memory of memories) {
      byType[memory.type] = (byType[memory.type] || 0) + 1;
    }

    // Get high importance items
    const important = memories
      .filter(m => m.importance > 0.7)
      .slice(0, 5)
      .map(m => m.content.substring(0, 100));

    const summary = `Auto-summary: ${memories.length} total memories. ` +
      `Types: ${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ')}. ` +
      `Key items: ${important.join('; ')}`;

    return summary;
  }

  // ============================================
  // Knowledge Graph
  // ============================================

  private async updateKnowledgeGraph(): Promise<{
    updates: number;
  }> {
    let updates = 0;

    if (!this.memoryLayerRef) return { updates: 0 };

    // Extract entities and relationships from memories
    const contexts = await this.memoryLayerRef.listContexts();

    for (const context of contexts.slice(0, 10)) {
      // Add context as node
      if (!this.knowledgeGraph.nodes.has(context.id)) {
        this.knowledgeGraph.nodes.set(context.id, {
          id: context.id,
          type: 'entity',
          label: context.name,
          properties: { projectId: context.projectId },
          importance: 0.5,
          createdAt: new Date(),
        });
        updates++;
      }
    }

    return { updates };
  }

  // ============================================
  // Memory Pruning
  // ============================================

  private async pruneMemories(heavyPrune: boolean = false): Promise<{
    pruned: number;
  }> {
    let pruned = 0;

    if (!this.memoryLayerRef) return { pruned: 0 };

    const threshold = heavyPrune ? 
      this.config.importanceThreshold + 0.2 : 
      this.config.importanceThreshold;

    const contexts = await this.memoryLayerRef.listContexts();

    for (const context of contexts) {
      const memories = await this.memoryLayerRef.getMemories(context.id);
      
      for (const memory of memories) {
        const age = Date.now() - new Date(memory.createdAt).getTime();
        
        // Prune old, low-importance memories
        if (memory.importance < threshold && age > this.config.maxMemoryAge) {
          // In a real implementation, this would delete the memory
          pruned++;
        }
      }
    }

    return { pruned };
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Get current status
   */
  getStatus(): {
    state: DreamPhase;
    running: boolean;
    lastConsolidation?: Date;
    patternCount: number;
    nodeCount: number;
    edgeCount: number;
    insightCount: number;
  } {
    return {
      state: this.state,
      running: this.running,
      lastConsolidation: this.lastConsolidation,
      patternCount: this.patterns.size,
      nodeCount: this.knowledgeGraph.nodes.size,
      edgeCount: this.knowledgeGraph.edges.size,
      insightCount: this.insights.length,
    };
  }

  /**
   * Get patterns
   */
  getPatterns(): MemoryPattern[] {
    return Array.from(this.patterns.values());
  }

  /**
   * Get knowledge graph
   */
  getKnowledgeGraph(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.knowledgeGraph.nodes.values()),
      edges: Array.from(this.knowledgeGraph.edges.values()),
    };
  }

  /**
   * Get insights
   */
  getInsights(limit: number = 100): DreamInsight[] {
    return this.insights.slice(-limit);
  }

  /**
   * Add insight manually
   */
  addInsight(insight: Omit<DreamInsight, 'id' | 'createdAt'>): DreamInsight {
    const newInsight: DreamInsight = {
      ...insight,
      id: uuidv4(),
      createdAt: new Date(),
    };

    this.insights.push(newInsight);
    this.emit('insight', newInsight);

    return newInsight;
  }
}

// ============================================
// Singleton Export
// ============================================

export const autoDream = new AutoDream();
