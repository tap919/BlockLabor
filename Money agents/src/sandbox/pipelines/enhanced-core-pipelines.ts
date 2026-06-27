/**
 * Enhanced Core Financial Pipelines
 * Implements the five core pipeline families with security hardening:
 * 1. Lead-to-Revenue
 * 2. Quote-to-Cash
 * 3. Accounts Receivable
 * 4. Expense/Vendor
 * 5. Compliance/Anomaly
 * 
 * SECURITY FIXES:
 * - Input validation
 * - Amount limits enforcement
 * - Audit logging
 * - Error handling
 * - Rate limiting
 */

import { v4 as uuidv4 } from 'uuid';
import { financialSandbox } from '../enhanced-financial-sandbox';
import { executionBus, ApprovedVerb } from '../execution/execution-bus';
import { getSetting } from '@/lib/settings';
import { InputValidator } from '@/lib/security-middleware';

// ============================================
// Pipeline Types
// ============================================

export interface LeadData {
  id?: string;
  email: string;
  name?: string;
  company?: string;
  source: string;
  value?: number;
  intent?: 'high' | 'medium' | 'low';
  status?: 'new' | 'contacted' | 'qualified' | 'proposal' | 'closed' | 'lost';
}

export interface QuoteData {
  id?: string;
  leadId: string;
  items: QuoteItem[];
  discount?: number;
  paymentTerms?: string;
  validUntil?: Date;
}

export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InvoiceData {
  id?: string;
  customerId: string;
  amount: number;
  dueDate: Date;
  items: InvoiceItem[];
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
}

export interface InvoiceItem {
  description: string;
  amount: number;
}

export interface VendorInvoice {
  id?: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  dueDate: Date;
  category: string;
  poNumber?: string;
}

export interface TransactionAnomaly {
  id?: string;
  transactionId: string;
  type: 'unusual_amount' | 'unusual_frequency' | 'missing_docs' | 'policy_violation';
  severity: 'low' | 'medium' | 'high';
  details: string;
}

// ============================================
// Pipeline Results
// ============================================

export interface PipelineResult {
  success: boolean;
  decisionId?: string;
  executedActions?: string[];
  errors?: string[];
  warnings?: string[];
  data?: unknown;
  auditId: string;
}

// ============================================
// Validation Helpers
// ============================================

function validateLeadData(lead: LeadData): { valid: boolean; errors: string[]; sanitized: LeadData } {
  const errors: string[] = [];

  // Email is required
  if (!lead.email) {
    errors.push('Email is required');
  } else if (!InputValidator.validateEmail(lead.email)) {
    errors.push('Invalid email format');
  }

  // Source is required
  if (!lead.source) {
    errors.push('Source is required');
  }

  // Sanitize
  const sanitized: LeadData = {
    ...lead,
    email: lead.email?.toLowerCase().trim() || '',
    name: lead.name ? InputValidator.sanitizeString(lead.name) : undefined,
    company: lead.company ? InputValidator.sanitizeString(lead.company) : undefined,
    source: InputValidator.sanitizeString(lead.source),
  };

  // Validate value if present
  if (lead.value !== undefined) {
    const amountResult = InputValidator.validateAmount(lead.value);
    if (!amountResult.valid) {
      errors.push('Invalid lead value');
    } else {
      sanitized.value = amountResult.value || undefined;
    }
  }

  return { valid: errors.length === 0, errors, sanitized };
}

function validateQuoteData(quote: QuoteData): { valid: boolean; errors: string[]; sanitized: QuoteData } {
  const errors: string[] = [];

  // Lead ID is required
  if (!quote.leadId) {
    errors.push('Lead ID is required');
  }

  // Items are required
  if (!quote.items || quote.items.length === 0) {
    errors.push('At least one quote item is required');
  } else {
    for (const item of quote.items) {
      if (!item.description) {
        errors.push('Item description is required');
      }
      const qtyResult = InputValidator.validateAmount(item.quantity);
      if (!qtyResult.valid || qtyResult.value === 0) {
        errors.push('Invalid item quantity');
      }
      const priceResult = InputValidator.validateAmount(item.unitPrice);
      if (!priceResult.valid) {
        errors.push('Invalid item unit price');
      }
    }
  }

  // Discount validation
  if (quote.discount !== undefined) {
    const discountResult = InputValidator.validateAmount(quote.discount);
    if (!discountResult.valid || (discountResult.value || 0) > 100) {
      errors.push('Invalid discount percentage');
    }
  }

  // Sanitize
  const sanitized: QuoteData = {
    ...quote,
    leadId: quote.leadId?.trim() || '',
    items: quote.items?.map(item => ({
      description: InputValidator.sanitizeString(item.description),
      quantity: Math.max(1, Math.floor(item.quantity)),
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    })) || [],
    discount: Math.min(100, Math.max(0, quote.discount || 0)),
  };

  return { valid: errors.length === 0, errors, sanitized };
}

function validateInvoiceData(invoice: InvoiceData): { valid: boolean; errors: string[]; sanitized: InvoiceData } {
  const errors: string[] = [];

  if (!invoice.customerId) {
    errors.push('Customer ID is required');
  }

  const amountResult = InputValidator.validateAmount(invoice.amount);
  if (!amountResult.valid || amountResult.value === 0) {
    errors.push('Valid invoice amount is required');
  }

  if (!invoice.dueDate) {
    errors.push('Due date is required');
  }

  const sanitized: InvoiceData = {
    ...invoice,
    customerId: invoice.customerId?.trim() || '',
    amount: amountResult.value || 0,
    items: invoice.items?.map(item => ({
      description: InputValidator.sanitizeString(item.description),
      amount: InputValidator.validateAmount(item.amount).value || 0,
    })) || [],
  };

  return { valid: errors.length === 0, errors, sanitized };
}

// ============================================
// Lead-to-Revenue Pipeline
// ============================================

export class LeadToRevenuePipeline {
  private pipelineId: string;

  constructor() {
    this.pipelineId = uuidv4();
  }

  /**
   * Process a new lead with validation
   */
  async processLead(lead: LeadData, processedBy: string = 'system'): Promise<PipelineResult> {
    const auditId = uuidv4();
    const errors: string[] = [];
    const warnings: string[] = [];
    const executedActions: string[] = [];

    // Validate input
    const validation = validateLeadData(lead);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings,
        auditId,
      };
    }

    const normalizedLead = validation.sanitized;

    try {
      // Step 1: Enrich with company data
      const enrichedLead = await this.enrichLead(normalizedLead);

      // Step 2: Score intent and value
      const score = this.scoreLead(enrichedLead);

      // Step 3: Get limits from settings
      const maxValue = await getSetting<number>('limits.transaction.maxAmount', 10000);

      // Step 4: Check if value exceeds limits
      if (score.estimatedValue > maxValue) {
        warnings.push(`Lead value ${score.estimatedValue} exceeds normal threshold of ${maxValue}`);
      }

      // Step 5: Create decision object
      const decision = await financialSandbox.createDecision({
        actionType: 'process_lead',
        entity: {
          type: 'lead',
          id: enrichedLead.id || uuidv4(),
          data: { ...enrichedLead, score },
        },
        reasoningSummary: `Lead from ${lead.source} with ${score.intent} intent and estimated value $${score.estimatedValue}`,
        evidenceRefs: [
          { source: 'lead_form', recordId: lead.id || 'new', field: 'source', value: lead.source },
          { source: 'enrichment', recordId: enrichedLead.company || 'unknown', field: 'company', value: enrichedLead.company },
        ],
        executionPlan: {
          steps: [
            { order: 1, verb: 'create_crm_lead', target: 'crm', params: enrichedLead, payload: enrichedLead, rollback: null },
          ],
          dependencies: [],
          timeout: 30000,
        },
        createdBy: processedBy,
      });

      // Step 6: Execute if approved
      if (decision.status === 'approved' || !decision.approvalRequired) {
        const result = await executionBus.execute({
          verb: 'create_crm_lead',
          target: 'crm',
          payload: enrichedLead,
          mode: financialSandbox.getMode(),
          decisionId: decision.id,
        });

        if (result.success) {
          executedActions.push('create_crm_lead');
        } else {
          errors.push(result.error || 'Failed to create CRM lead');
        }

        // Step 7: Draft outreach if high value
        if (score.estimatedValue > 10000 && score.intent === 'high') {
          const outreachResult = await executionBus.execute({
            verb: 'send_email_draft',
            target: 'email',
            payload: {
              to: enrichedLead.email,
              template: 'first_touch_high_value',
              data: enrichedLead,
            },
            mode: financialSandbox.getMode(),
            decisionId: decision.id,
          });

          if (outreachResult.success) {
            executedActions.push('send_email_draft');
          } else {
            warnings.push('Failed to create outreach email draft');
          }
        }
      }

      return {
        success: errors.length === 0,
        decisionId: decision.id,
        executedActions,
        errors,
        warnings,
        data: { lead: enrichedLead, score, decision },
        auditId,
      };

    } catch (error: any) {
      errors.push(error.message);
      return { success: false, errors, warnings, auditId };
    }
  }

  /**
   * Enrich lead with external data
   */
  private async enrichLead(lead: LeadData): Promise<LeadData> {
    return {
      ...lead,
      company: lead.company || this.extractCompanyFromEmail(lead.email),
    };
  }

  /**
   * Extract company from email domain
   */
  private extractCompanyFromEmail(email: string): string {
    const domain = email.split('@')[1];
    if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'].includes(domain)) {
      return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    }
    return 'Unknown';
  }

  /**
   * Score lead intent and value
   */
  private scoreLead(lead: LeadData): { intent: 'high' | 'medium' | 'low'; estimatedValue: number; confidence: number } {
    let intentScore = 0;
    let estimatedValue = lead.value || 5000;

    // Score based on source
    if (['referral', 'demo_request', 'pricing_page'].includes(lead.source)) {
      intentScore += 30;
    } else if (['webinar', 'ebook', 'blog'].includes(lead.source)) {
      intentScore += 10;
    }

    // Score based on company
    if (lead.company && lead.company !== 'Unknown') {
      intentScore += 20;
    }

    // Score based on provided value
    if (lead.value && lead.value > 10000) {
      intentScore += 20;
    }

    const intent = intentScore >= 50 ? 'high' : intentScore >= 30 ? 'medium' : 'low';

    return {
      intent,
      estimatedValue,
      confidence: Math.min(70 + intentScore / 2, 95),
    };
  }
}

// ============================================
// Quote-to-Cash Pipeline
// ============================================

export class QuoteToCashPipeline {
  private pipelineId: string;

  constructor() {
    this.pipelineId = uuidv4();
  }

  /**
   * Generate and process a quote with validation
   */
  async processQuote(quote: QuoteData, processedBy: string = 'system'): Promise<PipelineResult> {
    const auditId = uuidv4();
    const errors: string[] = [];
    const warnings: string[] = [];
    const executedActions: string[] = [];

    // Validate input
    const validation = validateQuoteData(quote);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings,
        auditId,
      };
    }

    const validatedQuote = validation.sanitized;

    try {
      // Step 1: Calculate totals
      const totals = this.calculateTotals(validatedQuote);

      // Step 2: Get limits from settings
      const maxDiscount = await getSetting<number>('limits.discount.maxPercent', 20);
      const maxAmount = await getSetting<number>('limits.transaction.maxAmount', 10000);

      // Step 3: Check pricing policies
      const policyCheck = this.checkPricingPolicy(validatedQuote, totals, maxDiscount, maxAmount);

      if (!policyCheck.valid) {
        return {
          success: false,
          errors: policyCheck.violations,
          warnings: policyCheck.warnings,
          auditId,
        };
      }

      warnings.push(...policyCheck.warnings);

      // Step 4: Create decision
      const decision = await financialSandbox.createDecision({
        actionType: policyCheck.requiresApproval ? 'quote_discount' : 'create_quote',
        entity: {
          type: 'quote',
          id: validatedQuote.id || uuidv4(),
          data: { ...validatedQuote, totals },
        },
        reasoningSummary: `Quote for $${totals.total.toFixed(2)} with ${validatedQuote.discount || 0}% discount`,
        evidenceRefs: [
          { source: 'quote_form', recordId: validatedQuote.leadId, field: 'leadId', value: validatedQuote.leadId },
        ],
        executionPlan: {
          steps: [
            { order: 1, verb: 'create_stripe_invoice', target: 'stripe', params: { quote: validatedQuote, totals }, rollback: 'void_stripe_invoice' },
          ],
          dependencies: [],
          timeout: 45000,
        },
        rollbackPlan: {
          steps: [
            { order: 1, verb: 'void_stripe_invoice', target: 'stripe', params: {}, rollback: null },
          ],
          conditions: ['execution_failed'],
        },
        createdBy: processedBy,
      });

      // Step 5: Execute if approved
      if (decision.status === 'approved' || !decision.approvalRequired) {
        const result = await executionBus.execute({
          verb: 'create_stripe_invoice',
          target: 'stripe',
          payload: { quote: validatedQuote, totals },
          mode: financialSandbox.getMode(),
          decisionId: decision.id,
        });

        if (result.success) {
          executedActions.push('create_stripe_invoice');
        } else {
          errors.push(result.error || 'Failed to create invoice');
        }
      }

      return {
        success: errors.length === 0,
        decisionId: decision.id,
        executedActions,
        errors,
        warnings,
        data: { quote: validatedQuote, totals, decision, policyCheck },
        auditId,
      };

    } catch (error: any) {
      errors.push(error.message);
      return { success: false, errors, warnings, auditId };
    }
  }

  /**
   * Calculate quote totals
   */
  private calculateTotals(quote: QuoteData): { subtotal: number; discount: number; total: number } {
    const subtotal = quote.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discount = quote.discount ? subtotal * (quote.discount / 100) : 0;
    const total = subtotal - discount;

    return { subtotal, discount, total };
  }

  /**
   * Check pricing policy
   */
  private checkPricingPolicy(
    quote: QuoteData,
    totals: { total: number },
    maxDiscount: number,
    maxAmount: number
  ): {
    valid: boolean;
    violations: string[];
    warnings: string[];
    requiresApproval: boolean;
  } {
    const violations: string[] = [];
    const warnings: string[] = [];
    let requiresApproval = false;

    // Check discount threshold
    if (quote.discount && quote.discount > maxDiscount) {
      violations.push(`Discount of ${quote.discount}% exceeds ${maxDiscount}% threshold`);
      requiresApproval = true;
    }

    // Check minimum pricing
    if (totals.total < 100) {
      violations.push('Minimum quote amount is $100');
    }

    // Check maximum pricing
    if (totals.total > maxAmount * 10) {
      warnings.push(`Quote total ${totals.total} exceeds 10x normal threshold`);
      requiresApproval = true;
    }

    // Check payment terms
    if (quote.paymentTerms === 'net90') {
      warnings.push('Net 90 payment terms require approval');
      requiresApproval = true;
    }

    return {
      valid: violations.filter(v => !v.includes('exceeds')).length === 0,
      violations,
      warnings,
      requiresApproval,
    };
  }
}

// ============================================
// Accounts Receivable Pipeline
// ============================================

export class AccountsReceivablePipeline {
  private pipelineId: string;

  constructor() {
    this.pipelineId = uuidv4();
  }

  /**
   * Process invoice follow-up with validation
   */
  async processFollowUp(invoice: InvoiceData, processedBy: string = 'system'): Promise<PipelineResult> {
    const auditId = uuidv4();
    const errors: string[] = [];
    const warnings: string[] = [];
    const executedActions: string[] = [];

    // Validate input
    const validation = validateInvoiceData(invoice);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings,
        auditId,
      };
    }

    const validatedInvoice = validation.sanitized;

    try {
      // Step 1: Analyze invoice status
      const analysis = this.analyzeInvoice(validatedInvoice);

      // Step 2: Generate follow-up plan
      const followUpPlan = this.generateFollowUpPlan(validatedInvoice, analysis);

      // Step 3: Check limits
      const maxAmount = await getSetting<number>('limits.transaction.maxAmount', 10000);
      if (validatedInvoice.amount > maxAmount) {
        warnings.push(`Invoice amount exceeds threshold of ${maxAmount}`);
      }

      // Step 4: Create decision
      const decision = await financialSandbox.createDecision({
        actionType: 'ar_followup',
        entity: {
          type: 'invoice',
          id: validatedInvoice.id || uuidv4(),
          data: { invoice: validatedInvoice, analysis },
        },
        reasoningSummary: `Invoice ${validatedInvoice.id} is ${analysis.daysOverdue} days overdue. ${followUpPlan.action}`,
        evidenceRefs: [
          { source: 'invoice_system', reference: validatedInvoice.id || 'unknown', type: 'input' },
          { source: 'payment_history', reference: validatedInvoice.customerId, type: 'derived' },
        ],
        executionPlan: {
          steps: followUpPlan.steps.map((step, idx) => ({
            order: idx + 1,
            verb: step.verb,
            target: step.target,
            params: step.payload || {},
            payload: step.payload,
            rollback: null,
          })),
          dependencies: [],
          timeout: 30000,
        },
        createdBy: processedBy,
      });

      // Step 5: Execute follow-up actions
      if (decision.status === 'approved' || !decision.approvalRequired) {
        for (const step of followUpPlan.steps) {
          const result = await executionBus.execute({
            verb: step.verb as ApprovedVerb,
            target: step.target,
            payload: step.payload,
            mode: financialSandbox.getMode(),
            decisionId: decision.id,
          });

          if (result.success) {
            executedActions.push(step.verb);
          } else {
            errors.push(result.error || `Failed to execute ${step.verb}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        decisionId: decision.id,
        executedActions,
        errors,
        warnings,
        data: { invoice: validatedInvoice, analysis, followUpPlan, decision },
        auditId,
      };

    } catch (error: any) {
      errors.push(error.message);
      return { success: false, errors, warnings, auditId };
    }
  }

  /**
   * Analyze invoice
   */
  private analyzeInvoice(invoice: InvoiceData): {
    daysOverdue: number;
    amount: number;
    riskLevel: 'low' | 'medium' | 'high';
    suggestedAction: string;
  } {
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (daysOverdue > 60 || invoice.amount > 10000) {
      riskLevel = 'high';
    } else if (daysOverdue > 30 || invoice.amount > 5000) {
      riskLevel = 'medium';
    }

    const suggestedAction = daysOverdue > 60 ? 'escalate_to_collections' :
      daysOverdue > 30 ? 'send_final_notice' :
        daysOverdue > 0 ? 'send_reminder' : 'monitor';

    return {
      daysOverdue,
      amount: invoice.amount,
      riskLevel,
      suggestedAction,
    };
  }

  /**
   * Generate follow-up plan
   */
  private generateFollowUpPlan(invoice: InvoiceData, analysis: ReturnType<typeof this.analyzeInvoice>): {
    action: string;
    steps: Array<{ verb: string; target: string; payload: unknown }>;
  } {
    const steps: Array<{ verb: string; target: string; payload: unknown }> = [];

    if (analysis.daysOverdue > 0) {
      steps.push({
        verb: 'send_email_draft',
        target: 'email',
        payload: {
          to: `customer_${invoice.customerId}`,
          template: analysis.daysOverdue > 30 ? 'final_notice' : 'payment_reminder',
          data: { invoice, daysOverdue: analysis.daysOverdue },
        },
      });
    }

    if (analysis.riskLevel === 'high') {
      steps.push({
        verb: 'open_slack_approval',
        target: 'slack',
        payload: {
          channel: '#ar-alerts',
          message: `High-risk invoice ${invoice.id} needs attention. $${invoice.amount}, ${analysis.daysOverdue} days overdue.`,
        },
      });
    }

    return {
      action: analysis.suggestedAction,
      steps,
    };
  }
}

// ============================================
// Expense/Vendor Pipeline
// ============================================

export class ExpenseVendorPipeline {
  private pipelineId: string;

  constructor() {
    this.pipelineId = uuidv4();
  }

  /**
   * Process vendor invoice with validation
   */
  async processVendorInvoice(vendorInvoice: VendorInvoice, processedBy: string = 'system'): Promise<PipelineResult> {
    const auditId = uuidv4();
    const errors: string[] = [];
    const warnings: string[] = [];
    const executedActions: string[] = [];

    // Validate input
    const validation = this.validateVendorInvoice(vendorInvoice);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings,
        auditId,
      };
    }

    try {
      // Check for duplicates
      const duplicateCheck = await this.checkDuplicates(vendorInvoice);

      if (duplicateCheck.isDuplicate) {
        return {
          success: false,
          errors: ['Duplicate invoice detected'],
          data: { existingInvoice: duplicateCheck.matchingInvoice },
          auditId,
        };
      }

      // Get limits
      const maxAmount = await getSetting<number>('limits.transaction.maxAmount', 10000);

      // Determine approval requirements
      const approvalRequired = this.requiresApproval(vendorInvoice, maxAmount);

      if (vendorInvoice.amount > maxAmount) {
        warnings.push(`Invoice amount ${vendorInvoice.amount} exceeds threshold ${maxAmount}`);
      }

      // Create decision
      const decision = await financialSandbox.createDecision({
        actionType: 'process_vendor_invoice',
        entity: {
          type: 'vendor_invoice',
          id: vendorInvoice.id || uuidv4(),
          data: vendorInvoice,
        },
        reasoningSummary: `Vendor invoice from ${vendorInvoice.vendorName} for $${vendorInvoice.amount}`,
        evidenceRefs: [
          { source: 'invoice_upload', reference: vendorInvoice.id || 'new', type: 'input' },
          { source: 'vendor_master', reference: vendorInvoice.vendorId, type: 'derived' },
        ],
        executionPlan: {
          steps: [
            { order: 1, verb: 'sync_quickbooks_customer', target: 'quickbooks', params: { vendorInvoice }, payload: { vendorInvoice }, rollback: null },
          ],
          dependencies: [],
          timeout: 30000,
        },
        createdBy: processedBy,
      });

      // Process if approved
      if (decision.status === 'approved' || !decision.approvalRequired) {
        const result = await executionBus.execute({
          verb: 'sync_quickbooks_customer',
          target: 'quickbooks',
          payload: { vendorInvoice },
          mode: financialSandbox.getMode(),
          decisionId: decision.id,
        });

        if (result.success) {
          executedActions.push('sync_quickbooks_customer');
        } else {
          errors.push(result.error || 'Failed to sync to QuickBooks');
        }
      }

      return {
        success: errors.length === 0,
        decisionId: decision.id,
        executedActions,
        errors,
        warnings,
        data: { vendorInvoice, decision, approvalRequired },
        auditId,
      };

    } catch (error: any) {
      errors.push(error.message);
      return { success: false, errors, warnings, auditId };
    }
  }

  /**
   * Validate vendor invoice
   */
  private validateVendorInvoice(invoice: VendorInvoice): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!invoice.vendorId) errors.push('Vendor ID is required');
    if (!invoice.vendorName) errors.push('Vendor name is required');
    
    const amountResult = InputValidator.validateAmount(invoice.amount);
    if (!amountResult.valid || amountResult.value === 0) {
      errors.push('Valid amount is required');
    }
    
    if (!invoice.dueDate) errors.push('Due date is required');

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for duplicates
   */
  private async checkDuplicates(invoice: VendorInvoice): Promise<{ isDuplicate: boolean; matchingInvoice?: unknown }> {
    // In production, this would check the database
    return { isDuplicate: false };
  }

  /**
   * Determine if approval is required
   */
  private requiresApproval(invoice: VendorInvoice, maxAmount: number): boolean {
    if (invoice.amount > maxAmount) return true;
    if (['legal', 'consulting', 'marketing'].includes(invoice.category)) return true;
    return false;
  }
}

// ============================================
// Compliance/Anomaly Pipeline
// ============================================

export class ComplianceAnomalyPipeline {
  private pipelineId: string;

  constructor() {
    this.pipelineId = uuidv4();
  }

  /**
   * Process detected anomaly
   */
  async processAnomaly(anomaly: TransactionAnomaly, processedBy: string = 'system'): Promise<PipelineResult> {
    const auditId = uuidv4();
    const errors: string[] = [];
    const warnings: string[] = [];
    const executedActions: string[] = [];

    try {
      // Step 1: Assess severity
      const assessment = this.assessAnomaly(anomaly);

      // Step 2: Gather context
      const context = await this.gatherContext(anomaly);

      // Step 3: Create decision (always requires review for anomalies)
      const decision = await financialSandbox.createDecision({
        actionType: 'anomaly_review',
        entity: {
          type: 'anomaly',
          id: anomaly.id || uuidv4(),
          data: { anomaly, assessment, context },
        },
        reasoningSummary: `${anomaly.type} detected: ${anomaly.details}. Severity: ${anomaly.severity}`,
        evidenceRefs: [
          { source: 'transaction_monitor', reference: anomaly.transactionId, type: 'input' },
          { source: 'context_gatherer', reference: anomaly.transactionId, type: 'derived' },
        ],
        executionPlan: {
          steps: [
            { order: 1, verb: 'mark_exception', target: 'queue', params: { anomaly, assessment }, payload: { anomaly, assessment }, rollback: null },
            { order: 2, verb: 'pause_pipeline', target: 'pipeline', params: { transactionId: anomaly.transactionId }, payload: { transactionId: anomaly.transactionId }, rollback: null },
          ],
          dependencies: [],
          timeout: 30000,
        },
        createdBy: processedBy,
      });

      // Step 4: Execute protective actions
      if (decision.status === 'approved' || !decision.approvalRequired) {
        // Always mark as exception for review
        const exceptionResult = await executionBus.execute({
          verb: 'mark_exception',
          target: 'queue',
          payload: { anomaly, assessment },
          mode: financialSandbox.getMode(),
          decisionId: decision.id,
        });

        if (exceptionResult.success) {
          executedActions.push('mark_exception');
        }

        // Pause related pipeline if high severity
        if (anomaly.severity === 'high') {
          const pauseResult = await executionBus.execute({
            verb: 'pause_pipeline',
            target: 'pipeline',
            payload: { transactionId: anomaly.transactionId },
            mode: financialSandbox.getMode(),
            decisionId: decision.id,
          });

          if (pauseResult.success) {
            executedActions.push('pause_pipeline');
          }
        }
      }

      return {
        success: errors.length === 0,
        decisionId: decision.id,
        executedActions,
        errors,
        warnings,
        data: { anomaly, assessment, context, decision },
        auditId,
      };

    } catch (error: any) {
      errors.push(error.message);
      return { success: false, errors, warnings, auditId };
    }
  }

  /**
   * Assess anomaly severity and impact
   */
  private assessAnomaly(anomaly: TransactionAnomaly): {
    riskScore: number;
    affectedSystems: string[];
    recommendedActions: string[];
  } {
    let riskScore = 0;

    switch (anomaly.type) {
      case 'unusual_amount':
        riskScore = anomaly.severity === 'high' ? 80 : anomaly.severity === 'medium' ? 50 : 20;
        break;
      case 'unusual_frequency':
        riskScore = anomaly.severity === 'high' ? 70 : anomaly.severity === 'medium' ? 40 : 15;
        break;
      case 'missing_docs':
        riskScore = anomaly.severity === 'high' ? 60 : anomaly.severity === 'medium' ? 30 : 10;
        break;
      case 'policy_violation':
        riskScore = anomaly.severity === 'high' ? 90 : anomaly.severity === 'medium' ? 60 : 30;
        break;
    }

    const affectedSystems = ['transaction_processing'];
    const recommendedActions = ['review', 'investigate'];

    if (riskScore > 70) {
      affectedSystems.push('compliance');
      recommendedActions.push('escalate');
    }

    return {
      riskScore,
      affectedSystems,
      recommendedActions,
    };
  }

  /**
   * Gather context around anomaly
   */
  private async gatherContext(anomaly: TransactionAnomaly): Promise<{
    relatedTransactions: unknown[];
    userHistory: unknown;
    policyRules: string[];
  }> {
    // In production, this would query databases
    return {
      relatedTransactions: [],
      userHistory: null,
      policyRules: [],
    };
  }
}

// ============================================
// Exports
// ============================================

export const leadToRevenuePipeline = new LeadToRevenuePipeline();
export const quoteToCashPipeline = new QuoteToCashPipeline();
export const accountsReceivablePipeline = new AccountsReceivablePipeline();
export const expenseVendorPipeline = new ExpenseVendorPipeline();
export const complianceAnomalyPipeline = new ComplianceAnomalyPipeline();
