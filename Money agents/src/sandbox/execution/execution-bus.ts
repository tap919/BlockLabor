/**
 * Execution Bus
 * Central execution layer that controls all external system interactions
 * Implements approved verbs and policy enforcement
 */

import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types
// ============================================

export type ApprovedVerb =
  | 'create_crm_lead'
  | 'update_crm_record'
  | 'send_email_draft'
  | 'send_email_live'
  | 'create_stripe_invoice'
  | 'capture_stripe_payment'
  | 'refund_stripe_payment'
  | 'sync_quickbooks_customer'
  | 'post_quickbooks_invoice'
  | 'open_slack_approval'
  | 'pause_pipeline'
  | 'resume_pipeline'
  | 'mark_exception'
  | 'book_calendar_event'
  | 'create_task'
  | 'webhook_trigger';

export interface ExecutionRequest {
  id: string;
  verb: ApprovedVerb;
  target: string;
  payload: Record<string, any>;
  mode: 'simulation' | 'draft' | 'live';
  decisionId: string;
  approvedBy?: string;
  timestamp: Date;
}

export interface ExecutionResult {
  id: string;
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
  externalId?: string;
  duration: number;
  timestamp: Date;
}

export interface VerbConfig {
  verb: ApprovedVerb;
  description: string;
  requiresApproval: boolean;
  approvalThresholds: Record<string, number>;
  maxRetries: number;
  timeout: number;
  rateLimit: {
    max: number;
    windowMs: number;
  };
  allowedModes: ('simulation' | 'draft' | 'live')[];
}

// ============================================
// Execution Bus Class
// ============================================

export class ExecutionBus {
  private verbConfigs: Map<ApprovedVerb, VerbConfig>;
  private rateLimiters: Map<string, { count: number; resetAt: number }>;
  private requestLog: Map<string, ExecutionRequest>;
  private resultLog: Map<string, ExecutionResult>;

  constructor() {
    this.verbConfigs = this.initializeVerbConfigs();
    this.rateLimiters = new Map();
    this.requestLog = new Map();
    this.resultLog = new Map();
  }

  /**
   * Initialize approved verb configurations
   */
  private initializeVerbConfigs(): Map<ApprovedVerb, VerbConfig> {
    const configs: [ApprovedVerb, VerbConfig][] = [
      // CRM Operations
      ['create_crm_lead', {
        verb: 'create_crm_lead',
        description: 'Create a new lead record in CRM',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 3,
        timeout: 30000,
        rateLimit: { max: 100, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['update_crm_record', {
        verb: 'update_crm_record',
        description: 'Update an existing CRM record',
        requiresApproval: false,
        approvalThresholds: { stage_change_revenue: 10000 },
        maxRetries: 3,
        timeout: 30000,
        rateLimit: { max: 200, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],

      // Email Operations
      ['send_email_draft', {
        verb: 'send_email_draft',
        description: 'Create an email draft without sending',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 2,
        timeout: 15000,
        rateLimit: { max: 100, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['send_email_live', {
        verb: 'send_email_live',
        description: 'Send an email to recipients',
        requiresApproval: true,
        approvalThresholds: { recipients: 100, first_touch: 1 },
        maxRetries: 2,
        timeout: 30000,
        rateLimit: { max: 50, windowMs: 60000 },
        allowedModes: ['live'],
      }],

      // Stripe Operations
      ['create_stripe_invoice', {
        verb: 'create_stripe_invoice',
        description: 'Create a Stripe invoice',
        requiresApproval: false,
        approvalThresholds: { amount: 10000, discount_percent: 20 },
        maxRetries: 3,
        timeout: 30000,
        rateLimit: { max: 30, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['capture_stripe_payment', {
        verb: 'capture_stripe_payment',
        description: 'Capture a payment',
        requiresApproval: true,
        approvalThresholds: { amount: 5000 },
        maxRetries: 2,
        timeout: 45000,
        rateLimit: { max: 20, windowMs: 60000 },
        allowedModes: ['live'],
      }],
      ['refund_stripe_payment', {
        verb: 'refund_stripe_payment',
        description: 'Process a refund',
        requiresApproval: true,
        approvalThresholds: { amount: 0 }, // Always requires approval
        maxRetries: 2,
        timeout: 30000,
        rateLimit: { max: 10, windowMs: 60000 },
        allowedModes: ['live'],
      }],

      // QuickBooks Operations
      ['sync_quickbooks_customer', {
        verb: 'sync_quickbooks_customer',
        description: 'Sync customer data to QuickBooks',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 3,
        timeout: 30000,
        rateLimit: { max: 50, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['post_quickbooks_invoice', {
        verb: 'post_quickbooks_invoice',
        description: 'Post an invoice to QuickBooks',
        requiresApproval: false,
        approvalThresholds: { amount: 100000, novel_mapping: 1 },
        maxRetries: 3,
        timeout: 45000,
        rateLimit: { max: 30, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],

      // Communication Operations
      ['open_slack_approval', {
        verb: 'open_slack_approval',
        description: 'Create a Slack approval request',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 3,
        timeout: 15000,
        rateLimit: { max: 50, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['book_calendar_event', {
        verb: 'book_calendar_event',
        description: 'Create a calendar event',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 2,
        timeout: 15000,
        rateLimit: { max: 30, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['create_task', {
        verb: 'create_task',
        description: 'Create a task in task management system',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 2,
        timeout: 15000,
        rateLimit: { max: 100, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],

      // Pipeline Control
      ['pause_pipeline', {
        verb: 'pause_pipeline',
        description: 'Pause a running pipeline',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 1,
        timeout: 5000,
        rateLimit: { max: 20, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['resume_pipeline', {
        verb: 'resume_pipeline',
        description: 'Resume a paused pipeline',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 1,
        timeout: 5000,
        rateLimit: { max: 20, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],
      ['mark_exception', {
        verb: 'mark_exception',
        description: 'Mark a record for exception review',
        requiresApproval: false,
        approvalThresholds: {},
        maxRetries: 2,
        timeout: 10000,
        rateLimit: { max: 100, windowMs: 60000 },
        allowedModes: ['simulation', 'draft', 'live'],
      }],

      // Webhook
      ['webhook_trigger', {
        verb: 'webhook_trigger',
        description: 'Trigger an external webhook',
        requiresApproval: true,
        approvalThresholds: {},
        maxRetries: 3,
        timeout: 30000,
        rateLimit: { max: 30, windowMs: 60000 },
        allowedModes: ['live'],
      }],
    ];

    return new Map(configs);
  }

  /**
   * Execute an approved verb
   */
  async execute(request: Omit<ExecutionRequest, 'id' | 'timestamp'>): Promise<ExecutionResult> {
    const executionId = uuidv4();
    const startTime = Date.now();

    const fullRequest: ExecutionRequest = {
      ...request,
      id: uuidv4(),
      timestamp: new Date(),
    };

    // Log the request
    this.requestLog.set(fullRequest.id, fullRequest);

    try {
      // Validate verb is approved
      const config = this.verbConfigs.get(request.verb);
      if (!config) {
        throw new Error(`Verb ${request.verb} is not approved`);
      }

      // Check mode is allowed
      if (!config.allowedModes.includes(request.mode)) {
        throw new Error(`Verb ${request.verb} is not allowed in ${request.mode} mode`);
      }

      // Check rate limit
      if (!this.checkRateLimit(request.verb)) {
        throw new Error(`Rate limit exceeded for ${request.verb}`);
      }

      // Check if approval is required
      if (config.requiresApproval && !request.approvedBy) {
        throw new Error(`Verb ${request.verb} requires approval`);
      }

      // Check approval thresholds
      const thresholdCheck = this.checkThresholds(config, request.payload);
      if (thresholdCheck.exceeded && !request.approvedBy) {
        throw new Error(`Threshold exceeded: ${thresholdCheck.reason}. Approval required.`);
      }

      // Execute based on mode
      let result: any;
      switch (request.mode) {
        case 'simulation':
          result = await this.simulateExecution(request);
          break;
        case 'draft':
          result = await this.draftExecution(request);
          break;
        case 'live':
          result = await this.liveExecution(request);
          break;
      }

      const executionResult: ExecutionResult = {
        id: executionId,
        requestId: fullRequest.id,
        success: true,
        data: result,
        externalId: result?.id,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      this.resultLog.set(executionId, executionResult);
      return executionResult;

    } catch (error: any) {
      const executionResult: ExecutionResult = {
        id: executionId,
        requestId: fullRequest.id,
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      this.resultLog.set(executionId, executionResult);
      return executionResult;
    }
  }

  /**
   * Check rate limit for a verb
   */
  private checkRateLimit(verb: ApprovedVerb): boolean {
    const config = this.verbConfigs.get(verb);
    if (!config) return false;

    const now = Date.now();
    const key = `${verb}:${Math.floor(now / config.rateLimit.windowMs)}`;
    const limiter = this.rateLimiters.get(key) || { count: 0, resetAt: now + config.rateLimit.windowMs };

    if (now > limiter.resetAt) {
      limiter.count = 0;
      limiter.resetAt = now + config.rateLimit.windowMs;
    }

    if (limiter.count >= config.rateLimit.max) {
      return false;
    }

    limiter.count++;
    this.rateLimiters.set(key, limiter);
    return true;
  }

  /**
   * Check if thresholds are exceeded
   */
  private checkThresholds(config: VerbConfig, payload: Record<string, any>): {
    exceeded: boolean;
    reason?: string;
  } {
    for (const [threshold, value] of Object.entries(config.approvalThresholds)) {
      const payloadValue = payload[threshold];
      if (payloadValue !== undefined && payloadValue > value) {
        return {
          exceeded: true,
          reason: `${threshold} (${payloadValue}) exceeds threshold (${value})`,
        };
      }
    }
    return { exceeded: false };
  }

  /**
   * Simulate execution (no side effects)
   */
  private async simulateExecution(request: Omit<ExecutionRequest, 'id' | 'timestamp'>): Promise<any> {
    // Return simulated response
    return {
      simulated: true,
      verb: request.verb,
      target: request.target,
      wouldExecute: true,
      mockId: `sim_${uuidv4().substring(0, 8)}`,
    };
  }

  /**
   * Draft execution (creates but doesn't finalize)
   */
  private async draftExecution(request: Omit<ExecutionRequest, 'id' | 'timestamp'>): Promise<any> {
    // Create draft but don't finalize
    return {
      draft: true,
      verb: request.verb,
      target: request.target,
      draftId: `draft_${uuidv4().substring(0, 8)}`,
      status: 'awaiting_review',
    };
  }

  /**
   * Live execution (actual API calls)
   */
  private async liveExecution(request: Omit<ExecutionRequest, 'id' | 'timestamp'>): Promise<any> {
    // This would connect to actual external services
    // For now, return a mock response
    return {
      live: true,
      verb: request.verb,
      target: request.target,
      executedAt: new Date().toISOString(),
      id: `live_${uuidv4().substring(0, 8)}`,
    };
  }

  /**
   * Get approved verbs
   */
  getApprovedVerbs(): VerbConfig[] {
    return Array.from(this.verbConfigs.values());
  }

  /**
   * Get execution logs
   */
  getExecutionLogs(limit: number = 100): ExecutionResult[] {
    return Array.from(this.resultLog.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get request logs
   */
  getRequestLogs(limit: number = 100): ExecutionRequest[] {
    return Array.from(this.requestLog.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }
}

// ============================================
// Singleton Export
// ============================================

export const executionBus = new ExecutionBus();
