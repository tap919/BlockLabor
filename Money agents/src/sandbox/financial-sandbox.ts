/**
 * Financial Sandbox Core Architecture
 * 4-Layer System: Data Perception, Reasoning, Strategy, Execution
 * With control plane for approvals, limits, and audit logs
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const db = new PrismaClient();

// ============================================
// Types and Interfaces
// ============================================

// Environment Types
export type Environment = 'dev' | 'staging' | 'production';
export type SandboxMode = 'simulation' | 'draft' | 'live';

// Layer Types
export interface DataPerceptionLayer {
  id: string;
  type: 'data_perception';
  sources: DataSource[];
  normalizers: Normalizer[];
  accessControls: AccessControl[];
}

export interface ReasoningEngineLayer {
  id: string;
  type: 'reasoning';
  models: ModelConfig[];
  retrievalConfig: RetrievalConfig;
  scoringModels: ScoringModel[];
  toolRegistry: ToolRegistry;
}

export interface StrategyGenerationLayer {
  id: string;
  type: 'strategy';
  decisionTemplates: DecisionTemplate[];
  constraints: StrategyConstraint[];
  actionGenerators: ActionGenerator[];
}

export interface ExecutionControlLayer {
  id: string;
  type: 'execution';
  policies: ExecutionPolicy[];
  limits: ExecutionLimit[];
  approvals: ApprovalConfig[];
  killSwitches: KillSwitch[];
}

// Data Types
export interface DataSource {
  id: string;
  name: string;
  type: 'crm' | 'email' | 'invoice' | 'payment' | 'bank' | 'document' | 'web';
  config: Record<string, any>;
  credentials: string; // Encrypted reference
  syncInterval: number;
  lastSync: Date | null;
}

export interface Normalizer {
  id: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  transformations: Transformation[];
}

export interface Transformation {
  field: string;
  operation: 'map' | 'filter' | 'transform' | 'validate';
  config: Record<string, any>;
}

export interface AccessControl {
  id: string;
  resource: string;
  permissions: string[];
  roles: string[];
  conditions: Record<string, any>;
}

// Reasoning Types
export interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface RetrievalConfig {
  enabled: boolean;
  vectorStore: string;
  embeddingModel: string;
  chunkSize: number;
  topK: number;
}

export interface ScoringModel {
  id: string;
  name: string;
  type: 'classification' | 'regression' | 'ranking';
  features: string[];
  model: string;
}

export interface ToolRegistry {
  tools: ToolDefinition[];
  mcpServers: MCPServer[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returns: string;
  permissions: string[];
}

export interface MCPServer {
  name: string;
  endpoint: string;
  tools: string[];
}

// Strategy Types
export interface ApprovalRule {
  id: string;
  condition: string;
  approverRoles: string[];
  deadline: number; // in minutes
  escalationPath?: string[];
}

export interface DecisionTemplate {
  id: string;
  actionType: string;
  requiredFields: string[];
  optionalFields: string[];
  riskScoring: RiskScoringConfig;
  approvalRules: ApprovalRule[];
}

export interface RiskScoringConfig {
  factors: RiskFactor[];
  weights: Record<string, number>;
  thresholds: Record<string, number>;
}

export interface RiskFactor {
  name: string;
  type: 'amount' | 'frequency' | 'entity' | 'pattern' | 'policy';
  weight: number;
}

export interface StrategyConstraint {
  id: string;
  type: 'hard' | 'soft';
  condition: string;
  action: 'block' | 'warn' | 'require_approval';
  message: string;
}

export interface ActionGenerator {
  id: string;
  actionType: string;
  trigger: string;
  template: Record<string, any>;
  validation: string[];
}

// Execution Types
export interface ExecutionPolicy {
  id: string;
  name: string;
  actions: string[];
  mode: SandboxMode;
  requiresApproval: boolean;
  conditions: Record<string, any>;
}

export interface ExecutionLimit {
  id: string;
  type: 'rate' | 'amount' | 'count' | 'time';
  scope: 'global' | 'agent' | 'pipeline' | 'entity';
  limit: number;
  window: number;
  current: number;
}

export interface ApprovalConfig {
  id: string;
  actionType: string;
  thresholds: ApprovalThreshold[];
  escalationRules: EscalationRule[];
}

export interface ApprovalThreshold {
  condition: string;
  approverRoles: string[];
  deadline: number;
}

export interface EscalationRule {
  condition: string;
  escalateTo: string[];
  afterMinutes: number;
}

export interface KillSwitch {
  id: string;
  scope: 'global' | 'pipeline' | 'agent' | 'entity';
  target: string;
  enabled: boolean;
  triggeredAt: Date | null;
  reason: string | null;
}

// Decision Object
export interface DecisionObject {
  id: string;
  actionType: string;
  entity: {
    type: string;
    id: string;
    data: Record<string, any>;
  };
  reasoningSummary: string;
  evidenceRefs: EvidenceRef[];
  riskScore: number;
  confidenceScore: number;
  policyResult: PolicyResult;
  approvalRequired: boolean;
  approverRole: string | null;
  deadline: Date | null;
  executionPlan: ExecutionPlan;
  rollbackPlan: RollbackPlan | null;
  mode: SandboxMode;
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed' | 'rolled_back';
  createdAt: Date;
  executedAt: Date | null;
}

export interface EvidenceRef {
  source: string;
  recordId?: string;
  field?: string;
  value?: any;
  type?: 'input' | 'derived' | 'external';
  reference?: string; // Alternative simplified field
}

export interface PolicyResult {
  policyId: string;
  passed: boolean;
  violations: string[];
  warnings: string[];
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  dependencies?: string[];
  timeout?: number;
}

export interface ExecutionStep {
  order?: number;
  verb: string;
  target: string;
  params?: Record<string, any>;
  payload?: Record<string, any>; // Alternative simplified field
  rollback?: string | null;
}

export interface RollbackPlan {
  steps?: ExecutionStep[];
  conditions?: string[];
}

// Pipeline Types
export interface Pipeline {
  id: string;
  name: string;
  family: 'ingestion' | 'reasoning' | 'decision' | 'execution' | 'monitoring';
  environment: Environment;
  mode: SandboxMode;
  triggers: PipelineTrigger[];
  steps: PipelineStep[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineTrigger {
  type: 'webhook' | 'schedule' | 'event' | 'manual';
  config: Record<string, any>;
}

export interface PipelineStep {
  order: number;
  type: string;
  config: Record<string, any>;
  onError: 'continue' | 'stop' | 'retry';
  maxRetries: number;
}

// Data Zones
export type DataZone = 'raw' | 'normalized' | 'decision' | 'evidence';

export interface DataZoneConfig {
  zone: DataZone;
  path: string;
  retention: number;
  encryption: boolean;
  accessLog: boolean;
}

// ============================================
// Sandbox Manager Class
// ============================================

export class FinancialSandbox {
  private environment: Environment;
  private mode: SandboxMode;
  private layers: {
    data: DataPerceptionLayer | null;
    reasoning: ReasoningEngineLayer | null;
    strategy: StrategyGenerationLayer | null;
    execution: ExecutionControlLayer | null;
  };

  private dataZones: Map<DataZone, DataZoneConfig>;
  private pipelines: Map<string, Pipeline>;
  private decisions: Map<string, DecisionObject>;
  private killSwitches: Map<string, KillSwitch>;

  constructor(environment: Environment = 'dev', mode: SandboxMode = 'simulation') {
    this.environment = environment;
    this.mode = mode;
    this.layers = {
      data: null,
      reasoning: null,
      strategy: null,
      execution: null,
    };
    this.dataZones = new Map();
    this.pipelines = new Map();
    this.decisions = new Map();
    this.killSwitches = new Map();

    this.initializeDataZones();
  }

  /**
   * Initialize data zones
   */
  private initializeDataZones(): void {
    const zones: DataZoneConfig[] = [
      { zone: 'raw', path: '/home/z/my-project/sandbox-data/raw', retention: 7, encryption: false, accessLog: true },
      { zone: 'normalized', path: '/home/z/my-project/sandbox-data/normalized', retention: 30, encryption: true, accessLog: true },
      { zone: 'decision', path: '/home/z/my-project/sandbox-data/decision', retention: 365, encryption: true, accessLog: true },
      { zone: 'evidence', path: '/home/z/my-project/sandbox-data/evidence', retention: 365, encryption: true, accessLog: true },
    ];

    zones.forEach(config => this.dataZones.set(config.zone, config));
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Get current mode
   */
  getMode(): SandboxMode {
    return this.mode;
  }

  /**
   * Set mode
   */
  setMode(mode: SandboxMode): void {
    // Validate mode transition
    if (this.mode === 'simulation' && mode === 'live') {
      // Must pass through draft first
      throw new Error('Cannot transition directly from simulation to live');
    }
    this.mode = mode;
  }

  // ============================================
  // Layer Management
  // ============================================

  /**
   * Initialize data perception layer
   */
  initializeDataLayer(config: Partial<DataPerceptionLayer>): DataPerceptionLayer {
    const layer: DataPerceptionLayer = {
      id: uuidv4(),
      type: 'data_perception',
      sources: config.sources || [],
      normalizers: config.normalizers || [],
      accessControls: config.accessControls || [],
    };
    this.layers.data = layer;
    return layer;
  }

  /**
   * Initialize reasoning layer
   */
  initializeReasoningLayer(config: Partial<ReasoningEngineLayer>): ReasoningEngineLayer {
    const layer: ReasoningEngineLayer = {
      id: uuidv4(),
      type: 'reasoning',
      models: config.models || [],
      retrievalConfig: config.retrievalConfig || { enabled: false, vectorStore: '', embeddingModel: '', chunkSize: 1000, topK: 5 },
      scoringModels: config.scoringModels || [],
      toolRegistry: config.toolRegistry || { tools: [], mcpServers: [] },
    };
    this.layers.reasoning = layer;
    return layer;
  }

  /**
   * Initialize strategy layer
   */
  initializeStrategyLayer(config: Partial<StrategyGenerationLayer>): StrategyGenerationLayer {
    const layer: StrategyGenerationLayer = {
      id: uuidv4(),
      type: 'strategy',
      decisionTemplates: config.decisionTemplates || [],
      constraints: config.constraints || [],
      actionGenerators: config.actionGenerators || [],
    };
    this.layers.strategy = layer;
    return layer;
  }

  /**
   * Initialize execution layer
   */
  initializeExecutionLayer(config: Partial<ExecutionControlLayer>): ExecutionControlLayer {
    const layer: ExecutionControlLayer = {
      id: uuidv4(),
      type: 'execution',
      policies: config.policies || [],
      limits: config.limits || [],
      approvals: config.approvals || [],
      killSwitches: config.killSwitches || [],
    };
    this.layers.execution = layer;
    return layer;
  }

  // ============================================
  // Decision Flow
  // ============================================

  /**
   * Create a decision object
   */
  async createDecision(params: {
    actionType: string;
    entity: DecisionObject['entity'];
    reasoningSummary: string;
    evidenceRefs: EvidenceRef[];
    executionPlan: ExecutionPlan;
    rollbackPlan?: RollbackPlan;
  }): Promise<DecisionObject> {
    const decisionId = uuidv4();

    // Calculate risk score
    const riskScore = await this.calculateRiskScore(params);

    // Calculate confidence
    const confidenceScore = await this.calculateConfidence(params);

    // Check policies
    const policyResult = await this.checkPolicies(params);

    // Determine if approval required
    const { approvalRequired, approverRole, deadline } = this.determineApproval(
      params.actionType,
      riskScore,
      policyResult
    );

    const decision: DecisionObject = {
      id: decisionId,
      actionType: params.actionType,
      entity: params.entity,
      reasoningSummary: params.reasoningSummary,
      evidenceRefs: params.evidenceRefs,
      riskScore,
      confidenceScore,
      policyResult,
      approvalRequired,
      approverRole,
      deadline,
      executionPlan: params.executionPlan,
      rollbackPlan: params.rollbackPlan || null,
      mode: this.mode,
      status: approvalRequired ? 'pending' : 'approved',
      createdAt: new Date(),
      executedAt: null,
    };

    this.decisions.set(decisionId, decision);

    // Store in decision zone
    await this.storeDecision(decision);

    return decision;
  }

  /**
   * Calculate risk score
   */
  private async calculateRiskScore(params: any): Promise<number> {
    let score = 0;

    // Factor in action type
    const highRiskActions = ['refund', 'void', 'payment_extension', 'large_transfer'];
    if (highRiskActions.includes(params.actionType)) {
      score += 30;
    }

    // Factor in amount if present
    if (params.entity.data?.amount) {
      const amount = params.entity.data.amount;
      if (amount > 10000) score += 20;
      if (amount > 50000) score += 20;
      if (amount > 100000) score += 20;
    }

    // Factor in entity type
    if (params.entity.type === 'vendor' || params.entity.type === 'customer') {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Calculate confidence score
   */
  private async calculateConfidence(params: any): Promise<number> {
    let confidence = 70; // Base confidence

    // More evidence = higher confidence
    confidence += Math.min(params.evidenceRefs?.length * 5 || 0, 20);

    // Execution plan completeness
    if (params.executionPlan?.steps?.length > 0) {
      confidence += 10;
    }

    // Rollback plan existence
    if (params.rollbackPlan) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Check policies
   */
  private async checkPolicies(params: any): Promise<PolicyResult> {
    const violations: string[] = [];
    const warnings: string[] = [];
    let passed = true;

    // Check execution policies
    const execLayer = this.layers.execution;
    if (execLayer) {
      for (const policy of execLayer.policies) {
        if (policy.actions.includes(params.actionType)) {
          if (policy.mode === 'simulation' && this.mode !== 'simulation') {
            violations.push(`Action ${params.actionType} only allowed in simulation mode`);
            passed = false;
          }
        }
      }
    }

    return {
      policyId: uuidv4(),
      passed,
      violations,
      warnings,
    };
  }

  /**
   * Determine if approval is required
   */
  private determineApproval(
    actionType: string,
    riskScore: number,
    policyResult: PolicyResult
  ): { approvalRequired: boolean; approverRole: string | null; deadline: Date | null } {
    // High risk always requires approval
    if (riskScore >= 50) {
      return {
        approvalRequired: true,
        approverRole: 'manager',
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      };
    }

    // Policy violations require approval
    if (!policyResult.passed) {
      return {
        approvalRequired: true,
        approverRole: 'admin',
        deadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
      };
    }

    // Check approval config
    const execLayer = this.layers.execution;
    if (execLayer) {
      const approvalConfig = execLayer.approvals.find(a => a.actionType === actionType);
      if (approvalConfig && approvalConfig.thresholds.length > 0) {
        const threshold = approvalConfig.thresholds[0];
        return {
          approvalRequired: true,
          approverRole: threshold.approverRoles[0],
          deadline: new Date(Date.now() + threshold.deadline * 60 * 1000),
        };
      }
    }

    return {
      approvalRequired: false,
      approverRole: null,
      deadline: null,
    };
  }

  /**
   * Store decision in decision zone
   */
  private async storeDecision(decision: DecisionObject): Promise<void> {
    // In a real implementation, this would persist to database
    // For now, we store in memory and log
    console.log(`Decision ${decision.id} stored: ${decision.actionType} - ${decision.status}`);
  }

  /**
   * Execute a decision
   */
  async executeDecision(decisionId: string): Promise<DecisionObject> {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status !== 'approved') {
      throw new Error('Decision not approved for execution');
    }

    if (this.mode === 'simulation') {
      // In simulation, don't actually execute
      decision.status = 'executed';
      decision.executedAt = new Date();
      return decision;
    }

    // Execute each step in the plan
    try {
      for (const step of decision.executionPlan.steps) {
        await this.executeStep(step);
      }
      decision.status = 'executed';
      decision.executedAt = new Date();
    } catch (error: any) {
      decision.status = 'failed';
      // Attempt rollback if available
      if (decision.rollbackPlan) {
        await this.executeRollback(decision);
      }
    }

    return decision;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: ExecutionStep): Promise<void> {
    // This would connect to the execution bus
    console.log(`Executing step: ${step.verb} on ${step.target}`);
  }

  /**
   * Execute rollback
   */
  private async executeRollback(decision: DecisionObject): Promise<void> {
    if (!decision.rollbackPlan || !decision.rollbackPlan.steps) return;

    for (const step of decision.rollbackPlan.steps) {
      await this.executeStep(step);
    }
    decision.status = 'rolled_back';
  }

  // ============================================
  // Kill Switch Management
  // ============================================

  /**
   * Activate kill switch
   */
  activateKillSwitch(scope: KillSwitch['scope'], target: string, reason: string): void {
    const killSwitchId = `${scope}:${target}`;
    const killSwitch: KillSwitch = {
      id: killSwitchId,
      scope,
      target,
      enabled: true,
      triggeredAt: new Date(),
      reason,
    };
    this.killSwitches.set(killSwitchId, killSwitch);

    // If global, stop all operations
    if (scope === 'global') {
      this.stopAllOperations();
    }
  }

  /**
   * Deactivate kill switch
   */
  deactivateKillSwitch(scope: KillSwitch['scope'], target: string): void {
    const killSwitchId = `${scope}:${target}`;
    this.killSwitches.delete(killSwitchId);
  }

  /**
   * Check if operation is blocked by kill switch
   */
  isBlocked(scope: KillSwitch['scope'], target: string): boolean {
    const killSwitchId = `${scope}:${target}`;
    const killSwitch = this.killSwitches.get(killSwitchId);
    return killSwitch?.enabled || this.killSwitches.has('global:*');
  }

  /**
   * Stop all operations
   */
  private stopAllOperations(): void {
    // Pause all pipelines
    this.pipelines.forEach(pipeline => {
      pipeline.enabled = false;
    });
  }

  // ============================================
  // Pipeline Management
  // ============================================

  /**
   * Create a pipeline
   */
  createPipeline(config: Partial<Pipeline>): Pipeline {
    const pipelineId = uuidv4();
    const pipeline: Pipeline = {
      id: pipelineId,
      name: config.name || 'Unnamed Pipeline',
      family: config.family || 'ingestion',
      environment: this.environment,
      mode: this.mode,
      triggers: config.triggers || [],
      steps: config.steps || [],
      enabled: config.enabled ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.pipelines.set(pipelineId, pipeline);
    return pipeline;
  }

  /**
   * Run a pipeline
   */
  async runPipeline(pipelineId: string, input: any): Promise<any> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error('Pipeline not found');
    }

    if (!pipeline.enabled) {
      throw new Error('Pipeline is disabled');
    }

    // Check kill switches
    if (this.isBlocked('pipeline', pipelineId)) {
      throw new Error('Pipeline is blocked by kill switch');
    }

    const results: any[] = [];

    for (const step of pipeline.steps) {
      const result = await this.executePipelineStep(step, input, results);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute a pipeline step
   */
  private async executePipelineStep(step: PipelineStep, input: any, previousResults: any[]): Promise<any> {
    // Placeholder for step execution
    return { step: step.type, completed: true };
  }

  // ============================================
  // Control Plane
  // ============================================

  /**
   * Validate action against control plane
   */
  validateAction(action: {
    type: string;
    entity?: any;
    amount?: number;
  }): {
    allowed: boolean;
    reason?: string;
    requiresApproval: boolean;
  } {
    // Check kill switches
    if (this.isBlocked('global', '*')) {
      return { allowed: false, reason: 'Global kill switch active', requiresApproval: false };
    }

    // Check execution limits
    const execLayer = this.layers.execution;
    if (execLayer) {
      for (const limit of execLayer.limits) {
        if (limit.current >= limit.limit) {
          return { allowed: false, reason: `Limit exceeded: ${limit.type}`, requiresApproval: false };
        }
      }
    }

    // Check policies
    if (execLayer) {
      for (const policy of execLayer.policies) {
        if (policy.actions.includes(action.type)) {
          if (policy.requiresApproval) {
            return { allowed: true, requiresApproval: true };
          }
        }
      }
    }

    return { allowed: true, requiresApproval: false };
  }

  /**
   * Answer the five control questions
   */
  evaluateControlQuestions(action: {
    type: string;
    actor: string;
    data: any;
    limit?: number;
  }): {
    isAllowed: boolean;
    authority: string | null;
    dataScope: string[];
    withinLimit: boolean;
    auditTrail: string;
  } {
    const validation = this.validateAction(action);

    return {
      isAllowed: validation.allowed,
      authority: validation.allowed ? action.actor : null,
      dataScope: Object.keys(action.data),
      withinLimit: action.limit ? action.limit < 10000 : true, // Simplified
      auditTrail: `action:${action.type}:actor:${action.actor}:time:${new Date().toISOString()}`,
    };
  }
}

// ============================================
// Singleton Export
// ============================================

export const financialSandbox = new FinancialSandbox();
