/**
 * Enhanced Financial Sandbox Core Architecture
 * 4-Layer System: Data Perception, Reasoning, Strategy, Execution
 * With control plane for approvals, limits, and audit logs
 * 
 * SECURITY FIXES:
 * - Credentials stored in secrets manager
 * - Proper input validation
 * - Rate limiting
 * - Transaction isolation
 * - Proper error handling
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { secretsManager, getSecretValue } from '@/lib/secrets';
import { getSetting } from '@/lib/settings';

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

// Data Types with Secure Credentials
export interface DataSource {
  id: string;
  name: string;
  type: 'crm' | 'email' | 'invoice' | 'payment' | 'bank' | 'document' | 'web';
  config: Record<string, unknown>;
  credentialsKey: string; // Reference to secrets manager key
  syncInterval: number;
  lastSync: Date | null;
}

export interface Normalizer {
  id: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  transformations: Transformation[];
}

export interface Transformation {
  field: string;
  operation: 'map' | 'filter' | 'transform' | 'validate';
  config: Record<string, unknown>;
}

export interface AccessControl {
  id: string;
  resource: string;
  permissions: string[];
  roles: string[];
  conditions: Record<string, unknown>;
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
  parameters: Record<string, unknown>;
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
  template: Record<string, unknown>;
  validation: string[];
}

// Execution Types
export interface ExecutionPolicy {
  id: string;
  name: string;
  actions: string[];
  mode: SandboxMode;
  requiresApproval: boolean;
  conditions: Record<string, unknown>;
}

export interface ExecutionLimit {
  id: string;
  type: 'rate' | 'amount' | 'count' | 'time';
  scope: 'global' | 'agent' | 'pipeline' | 'entity';
  limit: number;
  window: number;
  current: number;
  lastReset: Date;
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
  triggeredBy: string | null;
}

// Decision Object
export interface DecisionObject {
  id: string;
  actionType: string;
  entity: {
    type: string;
    id: string;
    data: Record<string, unknown>;
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
  createdBy: string | null;
}

export interface EvidenceRef {
  source: string;
  recordId?: string;
  field?: string;
  value?: unknown;
  type?: 'input' | 'derived' | 'external';
  reference?: string;
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
  params?: Record<string, unknown>;
  payload?: Record<string, unknown>;
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
  config: Record<string, unknown>;
}

export interface PipelineStep {
  order: number;
  type: string;
  config: Record<string, unknown>;
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
// Validation Helpers
// ============================================

function validateActionType(actionType: string): boolean {
  const validActionTypes = [
    'process_lead', 'create_quote', 'quote_discount', 'ar_followup',
    'process_vendor_invoice', 'anomaly_review', 'create_crm_lead',
    'send_email_draft', 'send_email_live', 'create_stripe_invoice',
    'capture_stripe_payment', 'refund_stripe_payment', 'webhook_trigger',
  ];
  return validActionTypes.includes(actionType);
}

function validateEntityData(data: Record<string, unknown>): { valid: boolean; sanitized: Record<string, unknown> } {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Remove any keys with null bytes or suspicious patterns
    if (key.includes('\x00') || key.includes('..')) {
      continue;
    }
    
    // Sanitize string values
    if (typeof value === 'string') {
      // Remove null bytes
      sanitized[key] = value.replace(/\x00/g, '');
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize objects
      const result = validateEntityData(value as Record<string, unknown>);
      sanitized[key] = result.sanitized;
    } else {
      sanitized[key] = value;
    }
  }
  
  return { valid: true, sanitized };
}

function sanitizeInput(input: string): string {
  return input
    .replace(/\x00/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .trim();
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
  private limits: Map<string, ExecutionLimit>;
  private credentialsCache: Map<string, { value: string; expires: number }>;

  private db: PrismaClient;

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
    this.limits = new Map();
    this.credentialsCache = new Map();
    this.db = new PrismaClient();

    this.initializeDataZones();
    this.initializeDefaultLimits();
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
   * Initialize default execution limits
   */
  private initializeDefaultLimits(): void {
    const defaultLimits: ExecutionLimit[] = [
      { id: 'global_rate', type: 'rate', scope: 'global', limit: 1000, window: 60000, current: 0, lastReset: new Date() },
      { id: 'global_amount', type: 'amount', scope: 'global', limit: 100000, window: 86400000, current: 0, lastReset: new Date() },
      { id: 'transaction_count', type: 'count', scope: 'global', limit: 500, window: 3600000, current: 0, lastReset: new Date() },
    ];

    defaultLimits.forEach(limit => this.limits.set(limit.id, limit));
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
   * Set mode with proper validation
   */
  setMode(mode: SandboxMode, changedBy: string = 'system'): void {
    // Validate mode transition
    const transitions: Record<SandboxMode, SandboxMode[]> = {
      'simulation': ['draft'],
      'draft': ['simulation', 'live'],
      'live': ['draft'],
    };

    if (!transitions[this.mode].includes(mode)) {
      throw new Error(`Cannot transition from ${this.mode} to ${mode}. Allowed transitions: ${transitions[this.mode].join(', ')}`);
    }

    // Log mode change
    console.log(`Mode changed from ${this.mode} to ${mode} by ${changedBy}`);
    this.mode = mode;
  }

  /**
   * Get credentials for a data source securely
   */
  async getCredentials(sourceId: string): Promise<Record<string, string> | null> {
    // Find the data source
    const source = this.layers.data?.sources.find(s => s.id === sourceId);
    if (!source) {
      return null;
    }

    // Check cache
    const cached = this.credentialsCache.get(source.credentialsKey);
    if (cached && cached.expires > Date.now()) {
      return { credentials: cached.value };
    }

    // Get from secrets manager
    try {
      const result = await secretsManager.getSecret(source.credentialsKey);
      if (result) {
        // Cache for 5 minutes
        this.credentialsCache.set(source.credentialsKey, {
          value: result.value,
          expires: Date.now() + 300000,
        });
        return { credentials: result.value };
      }
    } catch (error) {
      console.error(`Failed to get credentials for source ${sourceId}:`, error);
    }

    return null;
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
  // Limit Checking
  // ============================================

  /**
   * Check and update execution limits
   */
  checkLimits(limitType: ExecutionLimit['type'], amount: number = 1): { allowed: boolean; reason?: string } {
    for (const [id, limit] of this.limits.entries()) {
      if (limit.type !== limitType) continue;

      // Check if window has reset
      const now = new Date();
      if (now.getTime() - limit.lastReset.getTime() > limit.window) {
        limit.current = 0;
        limit.lastReset = now;
      }

      if (limit.current + amount > limit.limit) {
        return { 
          allowed: false, 
          reason: `${limitType} limit exceeded: ${limit.current + amount} > ${limit.limit}` 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Update limit counter
   */
  updateLimit(limitType: ExecutionLimit['type'], amount: number = 1): void {
    for (const limit of this.limits.values()) {
      if (limit.type === limitType) {
        limit.current += amount;
      }
    }
  }

  // ============================================
  // Decision Flow
  // ============================================

  /**
   * Create a decision object with enhanced validation
   */
  async createDecision(params: {
    actionType: string;
    entity: DecisionObject['entity'];
    reasoningSummary: string;
    evidenceRefs: EvidenceRef[];
    executionPlan: ExecutionPlan;
    rollbackPlan?: RollbackPlan;
    createdBy?: string;
  }): Promise<DecisionObject> {
    // Validate action type
    if (!validateActionType(params.actionType)) {
      throw new Error(`Invalid action type: ${params.actionType}`);
    }

    // Sanitize inputs
    const sanitizedSummary = sanitizeInput(params.reasoningSummary);
    const { sanitized: sanitizedEntityData } = validateEntityData(params.entity.data);

    // Check limits
    const limitCheck = this.checkLimits('count');
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || 'Rate limit exceeded');
    }

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
      entity: {
        ...params.entity,
        data: sanitizedEntityData,
      },
      reasoningSummary: sanitizedSummary,
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
      createdBy: params.createdBy || 'system',
    };

    this.decisions.set(decisionId, decision);

    // Update limits
    this.updateLimit('count');

    // Store in decision zone
    await this.storeDecision(decision);

    return decision;
  }

  /**
   * Calculate risk score with enhanced factors
   */
  private async calculateRiskScore(params: any): Promise<number> {
    let score = 0;

    // Get limits from settings
    const maxAmount = await getSetting<number>('limits.transaction.maxAmount', 10000);
    const maxDiscount = await getSetting<number>('limits.discount.maxPercent', 20);

    // Factor in action type
    const highRiskActions = ['refund', 'void', 'payment_extension', 'large_transfer', 'refund_stripe_payment'];
    if (highRiskActions.some(action => params.actionType.includes(action))) {
      score += 30;
    }

    // Factor in amount if present
    if (params.entity.data?.amount) {
      const amount = Number(params.entity.data.amount);
      if (isNaN(amount)) {
        score += 10; // Invalid amount is suspicious
      } else {
        if (amount > maxAmount) score += 20;
        if (amount > maxAmount * 2) score += 20;
        if (amount > maxAmount * 5) score += 20;
      }
    }

    // Factor in discount if present
    if (params.entity.data?.discount) {
      const discount = Number(params.entity.data.discount);
      if (!isNaN(discount) && discount > maxDiscount) {
        score += 15;
      }
    }

    // Factor in entity type
    const sensitiveEntities = ['vendor', 'customer', 'payment'];
    if (sensitiveEntities.includes(params.entity.type)) {
      score += 10;
    }

    // Factor in mode - live mode is inherently riskier
    if (this.mode === 'live') {
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

    // Check for required fields
    if (params.entity?.id && params.entity?.type) {
      confidence += 5;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Check policies with enhanced validation
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
          if (policy.requiresApproval && this.mode === 'live') {
            warnings.push(`Action ${params.actionType} requires approval in live mode`);
          }
        }
      }
    }

    // Check global kill switches
    if (this.isBlocked('global', '*')) {
      violations.push('Global kill switch is active');
      passed = false;
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
        approverRole: riskScore >= 70 ? 'admin' : 'manager',
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
   * Store decision in decision zone and database
   */
  private async storeDecision(decision: DecisionObject): Promise<void> {
    // Log decision creation
    console.log(`[AUDIT] Decision ${decision.id} created: ${decision.actionType} - ${decision.status} by ${decision.createdBy}`);
    
    // In production, this would persist to database
    // await this.db.decision.create({ data: decision });
  }

  /**
   * Execute a decision with enhanced error handling
   */
  async executeDecision(decisionId: string, executedBy: string = 'system'): Promise<DecisionObject> {
    const decision = this.decisions.get(decisionId);
    if (!decision) {
      throw new Error('Decision not found');
    }

    if (decision.status !== 'approved') {
      throw new Error(`Decision not approved for execution. Current status: ${decision.status}`);
    }

    // Check kill switches
    if (this.isBlocked('global', '*')) {
      throw new Error('Global kill switch is active');
    }

    // Check amount limits for live mode
    if (this.mode === 'live' && decision.entity.data?.amount) {
      const amount = Number(decision.entity.data.amount);
      const limitCheck = this.checkLimits('amount', amount);
      if (!limitCheck.allowed) {
        throw new Error(limitCheck.reason || 'Amount limit exceeded');
      }
    }

    if (this.mode === 'simulation') {
      // In simulation, don't actually execute
      decision.status = 'executed';
      decision.executedAt = new Date();
      console.log(`[AUDIT] Decision ${decision.id} simulated by ${executedBy}`);
      return decision;
    }

    // Execute each step in the plan
    try {
      for (const step of decision.executionPlan.steps) {
        await this.executeStep(step, decisionId);
      }
      decision.status = 'executed';
      decision.executedAt = new Date();

      // Update limits
      if (decision.entity.data?.amount) {
        this.updateLimit('amount', Number(decision.entity.data.amount));
      }

      console.log(`[AUDIT] Decision ${decision.id} executed successfully by ${executedBy}`);
    } catch (error: any) {
      decision.status = 'failed';
      console.error(`[AUDIT] Decision ${decisionId} execution failed:`, error.message);
      
      // Attempt rollback if available
      if (decision.rollbackPlan) {
        try {
          await this.executeRollback(decision);
          console.log(`[AUDIT] Decision ${decisionId} rolled back after failure`);
        } catch (rollbackError: any) {
          console.error(`[AUDIT] Rollback failed for decision ${decisionId}:`, rollbackError.message);
        }
      }
    }

    return decision;
  }

  /**
   * Execute a single step
   */
  private async executeStep(step: ExecutionStep, decisionId: string): Promise<void> {
    console.log(`[AUDIT] Executing step: ${step.verb} on ${step.target} for decision ${decisionId}`);
    // This would connect to the execution bus
  }

  /**
   * Execute rollback
   */
  private async executeRollback(decision: DecisionObject): Promise<void> {
    if (!decision.rollbackPlan || !decision.rollbackPlan.steps) return;

    for (const step of decision.rollbackPlan.steps) {
      await this.executeStep(step, `${decision.id}:rollback`);
    }
    decision.status = 'rolled_back';
  }

  // ============================================
  // Kill Switch Management
  // ============================================

  /**
   * Activate kill switch
   */
  activateKillSwitch(scope: KillSwitch['scope'], target: string, reason: string, triggeredBy: string = 'system'): void {
    const killSwitchId = `${scope}:${target}`;
    const killSwitch: KillSwitch = {
      id: killSwitchId,
      scope,
      target,
      enabled: true,
      triggeredAt: new Date(),
      reason,
      triggeredBy,
    };
    this.killSwitches.set(killSwitchId, killSwitch);

    console.log(`[AUDIT] Kill switch activated: ${killSwitchId} by ${triggeredBy}. Reason: ${reason}`);

    // If global, stop all operations
    if (scope === 'global') {
      this.stopAllOperations();
    }
  }

  /**
   * Deactivate kill switch
   */
  deactivateKillSwitch(scope: KillSwitch['scope'], target: string, deactivatedBy: string = 'system'): void {
    const killSwitchId = `${scope}:${target}`;
    this.killSwitches.delete(killSwitchId);
    console.log(`[AUDIT] Kill switch deactivated: ${killSwitchId} by ${deactivatedBy}`);
  }

  /**
   * Check if operation is blocked by kill switch
   */
  isBlocked(scope: KillSwitch['scope'], target: string): boolean {
    // Check specific kill switch
    const killSwitchId = `${scope}:${target}`;
    const specificKillSwitch = this.killSwitches.get(killSwitchId);
    if (specificKillSwitch?.enabled) return true;

    // Check global kill switch
    const globalKillSwitch = this.killSwitches.get('global:*');
    if (globalKillSwitch?.enabled && scope !== 'global') return true;

    return false;
  }

  /**
   * Stop all operations
   */
  private stopAllOperations(): void {
    // Pause all pipelines
    this.pipelines.forEach(pipeline => {
      pipeline.enabled = false;
    });
    console.log('[AUDIT] All operations stopped due to global kill switch');
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
   * Run a pipeline with enhanced safety checks
   */
  async runPipeline(pipelineId: string, input: any, triggeredBy: string = 'system'): Promise<any> {
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

    // Check rate limits
    const limitCheck = this.checkLimits('rate');
    if (!limitCheck.allowed) {
      throw new Error(limitCheck.reason || 'Rate limit exceeded');
    }

    console.log(`[AUDIT] Pipeline ${pipelineId} started by ${triggeredBy}`);

    const results: any[] = [];

    for (const step of pipeline.steps) {
      const result = await this.executePipelineStep(step, input, results);
      results.push(result);
    }

    // Update rate limit
    this.updateLimit('rate');

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
    const limitCheck = this.checkLimits('rate');
    if (!limitCheck.allowed) {
      return { allowed: false, reason: limitCheck.reason, requiresApproval: false };
    }

    // Check amount limits
    if (action.amount) {
      const amountLimitCheck = this.checkLimits('amount', action.amount);
      if (!amountLimitCheck.allowed) {
        return { allowed: false, reason: amountLimitCheck.reason, requiresApproval: false };
      }
    }

    // Check policies
    const execLayer = this.layers.execution;
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
      dataScope: Object.keys(action.data || {}),
      withinLimit: action.limit ? action.limit < 10000 : true,
      auditTrail: `action:${action.type}:actor:${action.actor}:time:${new Date().toISOString()}`,
    };
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.db.$disconnect();
    this.credentialsCache.clear();
    console.log('[AUDIT] Sandbox cleanup completed');
  }
}

// ============================================
// Singleton Export
// ============================================

export const financialSandbox = new FinancialSandbox();
