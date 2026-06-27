import { describe, it, expect } from 'vitest';
import { judgeExecution } from './lib/judge';

describe('judgeExecution', () => {
  it('should allow neutral text', () => {
    const result = judgeExecution('Hello how are you', 100, false);
    expect(result.valid).toBe(true);
    expect(result.receipt).toBeUndefined();
  });

  it('should block if killSwitch is on', () => {
    const result = judgeExecution('Send email', 100, true);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Kill-switch');
  });

  it('should block if budget is zero', () => {
    const result = judgeExecution('[EXECUTE: Send n8n]', 0, false);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Budget exhausted');
  });

  it('should flag destructive actions', () => {
    const result = judgeExecution('[EXECUTE: Delete all records]', 100, false);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('destructive');
    expect(result.receipt?.status).toBe('Flagged');
  });

  it('should validate safe n8n actions', () => {
    const result = judgeExecution('[EXECUTE: trigger n8n outreach]', 100, false);
    expect(result.valid).toBe(true);
    expect(result.receipt?.status).toBe('Validated');
    expect(result.receipt?.agent).toBe('Automation Builder');
  });
});
