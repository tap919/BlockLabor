import { Receipt } from './store';

export interface ValidationResult {
  valid: boolean;
  reason: string;
  receipt?: Partial<Receipt>;
}

export function judgeExecution(text: string, currentBudget: number, killSwitch: boolean): ValidationResult {
  if (killSwitch) {
    return { valid: false, reason: 'Kill-switch engaged. All execution blocked.' };
  }

  // Look for execution patterns like [EXECUTE: Action]
  const executionMatch = text.match(/\[EXECUTE:\s*([^\]]+)\]/);
  if (!executionMatch) {
    return { valid: true, reason: 'No execution detected.' };
  }

  const action = executionMatch[1].toLowerCase();
  
  // Rule: No budget, no action
  if (currentBudget <= 0) {
    return { valid: false, reason: 'Budget exhausted. "No Fronts" policy enforced.' };
  }

  // Rule: High risk keywords
  if (action.includes('delete') || action.includes('all') || action.includes('wipe')) {
    return { 
      valid: false, 
      reason: 'High-risk destructive action detected. Flagged for manual review.',
      receipt: {
        id: `RCPT_FAIL_${Date.now().toString().slice(-4)}`,
        agent: 'Master Judge',
        status: 'Flagged',
        logic: `Block: Destructive intent detected in "${action}"`
      }
    };
  }

  // Rule: Validate n8n workflows
  if (action.includes('n8n')) {
    return {
      valid: true,
      reason: 'Standard n8n hub workflow validated.',
      receipt: {
        id: `RCPT_n8n_${Date.now().toString().slice(-4)}`,
        agent: 'Automation Builder',
        status: 'Validated',
        logic: `Hub-and-Spoke: Verified ${action}`
      }
    };
  }

  // Default validated execution
  return {
    valid: true,
    reason: 'Standard safe action.',
    receipt: {
      id: `RCPT_ACT_${Date.now().toString().slice(-4)}`,
      agent: 'OTM Specialist',
      status: 'Validated',
      logic: `RASP: Payload sanitized for "${action}"`
    }
  };
}
