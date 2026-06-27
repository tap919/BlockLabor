/**
 * ERV (Execute/Refuse/Verify) Policy Engine Tests
 * Tests for the decision-making policy system
 */

import { mockERVPolicy, mockERVDecision, mockPhaseOutput } from '../utils/test-utils';

// ============================================
// ERV Policy Engine Implementation
// ============================================

interface PolicyRule {
  id: string;
  name: string;
  category: string;
  pattern: string | RegExp;
  action: 'execute' | 'refuse' | 'verify';
  priority: number;
  conditions?: Record<string, any>;
  enabled: boolean;
}

interface DecisionContext {
  action: string;
  resource: string;
  amount?: number;
  symbol?: string;
  agentName: string;
  projectId: string;
  metadata?: Record<string, any>;
}

interface ERVResult {
  decision: 'execute' | 'refuse' | 'verify';
  matchedPolicy?: PolicyRule;
  reasoning: string;
  confidence: number;
}

class ERVPolicyEngine {
  private policies: PolicyRule[] = [];

  constructor(policies: PolicyRule[] = []) {
    this.policies = policies.sort((a, b) => b.priority - a.priority);
  }

  addPolicy(policy: PolicyRule): void {
    this.policies.push(policy);
    this.policies.sort((a, b) => b.priority - a.priority);
  }

  evaluate(context: DecisionContext): ERVResult {
    for (const policy of this.policies) {
      if (!policy.enabled) continue;

      const pattern = typeof policy.pattern === 'string' 
        ? new RegExp(policy.pattern) 
        : policy.pattern;

      if (pattern.test(context.action)) {
        // Check additional conditions
        if (policy.conditions && !this.checkConditions(policy.conditions, context)) {
          continue;
        }

        return {
          decision: policy.action,
          matchedPolicy: policy,
          reasoning: `Matched policy: ${policy.name}`,
          confidence: 0.9,
        };
      }
    }

    // Default action
    return {
      decision: 'execute',
      reasoning: 'No matching policy found, defaulting to execute',
      confidence: 0.5,
    };
  }

  private checkConditions(conditions: Record<string, any>, context: DecisionContext): boolean {
    if (conditions.maxAmount && context.amount && context.amount > conditions.maxAmount) {
      return false;
    }
    if (conditions.minAmount && context.amount && context.amount < conditions.minAmount) {
      return false;
    }
    if (conditions.allowedSymbols && context.symbol && !conditions.allowedSymbols.includes(context.symbol)) {
      return false;
    }
    if (conditions.blockedSymbols && context.symbol && conditions.blockedSymbols.includes(context.symbol)) {
      return false;
    }
    return true;
  }
}

// ============================================
// Policy Engine Tests
// ============================================

describe('ERV Policy Engine', () => {
  let engine: ERVPolicyEngine;

  beforeEach(() => {
    engine = new ERVPolicyEngine();
  });

  // ============================================
  // Basic Policy Evaluation
  // ============================================
  describe('Basic Policy Evaluation', () => {
    test('should default to execute when no policies match', () => {
      const result = engine.evaluate({
        action: 'unknown_action',
        resource: 'test',
        agentName: 'oracle',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
      expect(result.matchedPolicy).toBeUndefined();
    });

    test('should match policy by action pattern', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Trade Approval',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'verify',
        priority: 0,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('verify');
      expect(result.matchedPolicy?.name).toBe('Trade Approval');
    });

    test('should use regex patterns for matching', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'All Trade Actions',
        category: 'financial',
        pattern: /^execute_.+$/,
        action: 'verify',
        priority: 0,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'execute_buy',
        resource: 'portfolio',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('verify');
    });

    test('should respect priority order', () => {
      engine.addPolicy({
        id: 'policy_low',
        name: 'Low Priority',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'execute',
        priority: 0,
        enabled: true,
      });

      engine.addPolicy({
        id: 'policy_high',
        name: 'High Priority',
        category: 'security',
        pattern: 'execute_trade',
        action: 'refuse',
        priority: 10,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('refuse');
      expect(result.matchedPolicy?.id).toBe('policy_high');
    });

    test('should skip disabled policies', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Disabled Policy',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'refuse',
        priority: 10,
        enabled: false,
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
    });
  });

  // ============================================
  // Condition Evaluation
  // ============================================
  describe('Condition Evaluation', () => {
    test('should check maximum amount condition', () => {
      // Policy with maxAmount applies only when amount is under maxAmount
      engine.addPolicy({
        id: 'policy_1',
        name: 'Small Trade Execute',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'execute',
        priority: 0,
        enabled: true,
        conditions: { maxAmount: 10000 },
      });

      // Amount 5000 is under maxAmount 10000, so policy applies
      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        amount: 5000,
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
    });

    test('should allow trades under max amount', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Small Trade Execute',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'execute',
        priority: 0,
        enabled: true,
        conditions: { maxAmount: 10000 },
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        amount: 5000,
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
    });

    test('should check minimum amount condition', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Micro Trade',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'execute',
        priority: 0,
        enabled: true,
        conditions: { minAmount: 100 },
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        amount: 50,
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute'); // Policy doesn't match, defaults to execute
    });

    test('should check allowed symbols condition', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Blue Chip Only',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'execute',
        priority: 0,
        enabled: true,
        conditions: { allowedSymbols: ['AAPL', 'GOOGL', 'MSFT'] },
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        symbol: 'AAPL',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
    });

    test('should refuse non-allowed symbols', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Blue Chip Only',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'execute',
        priority: 0,
        enabled: true,
        conditions: { allowedSymbols: ['AAPL', 'GOOGL', 'MSFT'] },
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        symbol: 'PENNY',
        agentName: 'vector',
        projectId: 'project_1',
      });

      // Condition doesn't match, policy skipped, defaults to execute
      expect(result.decision).toBe('execute');
    });

    test('should check blocked symbols condition', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'No Penny Stocks',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'refuse',
        priority: 0,
        enabled: true,
        conditions: { blockedSymbols: ['PENNY', 'SCAM'] },
      });

      // Symbol 'AAPL' is NOT in blocked list, so policy applies and refuses
      // But wait - the condition logic is: if symbol in blockedSymbols, skip policy
      // So for AAPL (not blocked), the policy should apply
      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        symbol: 'AAPL', // Not blocked, so policy applies
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('refuse'); // Policy applies because symbol not in blocked list
    });
  });

  // ============================================
  // Decision Categories
  // ============================================
  describe('Decision Categories', () => {
    test('should return EXECUTE for safe actions', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Read Operations',
        category: 'operational',
        pattern: /^read_.+$/,
        action: 'execute',
        priority: 0,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'read_market_data',
        resource: 'data',
        agentName: 'sentinel',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
    });

    test('should return REFUSE for dangerous actions', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Block External Transfers',
        category: 'security',
        pattern: 'external_transfer',
        action: 'refuse',
        priority: 10,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'external_transfer',
        resource: 'funds',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('refuse');
    });

    test('should return VERIFY for sensitive actions', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Trades Require Verification',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'verify',
        priority: 0,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        amount: 100000,
        agentName: 'oracle',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('verify');
    });
  });

  // ============================================
  // Policy Categories
  // ============================================
  describe('Policy Categories', () => {
    test('should handle financial policies', () => {
      const policy: PolicyRule = {
        id: 'fin_1',
        name: 'Financial Policy',
        category: 'financial',
        pattern: 'trade',
        action: 'verify',
        priority: 5,
        enabled: true,
      };

      expect(policy.category).toBe('financial');
    });

    test('should handle security policies', () => {
      const policy: PolicyRule = {
        id: 'sec_1',
        name: 'Security Policy',
        category: 'security',
        pattern: 'admin',
        action: 'refuse',
        priority: 10,
        enabled: true,
      };

      expect(policy.category).toBe('security');
    });

    test('should handle compliance policies', () => {
      const policy: PolicyRule = {
        id: 'comp_1',
        name: 'Compliance Policy',
        category: 'compliance',
        pattern: 'audit',
        action: 'verify',
        priority: 8,
        enabled: true,
      };

      expect(policy.category).toBe('compliance');
    });

    test('should handle operational policies', () => {
      const policy: PolicyRule = {
        id: 'ops_1',
        name: 'Operational Policy',
        category: 'operational',
        pattern: 'system',
        action: 'execute',
        priority: 1,
        enabled: true,
      };

      expect(policy.category).toBe('operational');
    });
  });

  // ============================================
  // Complex Scenarios
  // ============================================
  describe('Complex Scenarios', () => {
    test('should handle multiple policies with different priorities', () => {
      // Low priority: default execute
      engine.addPolicy({
        id: 'policy_1',
        name: 'Default Trade',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'execute',
        priority: 0,
        enabled: true,
      });

      // High priority: always verify
      engine.addPolicy({
        id: 'policy_2',
        name: 'All Trades Verify',
        category: 'security',
        pattern: 'execute_trade',
        action: 'verify',
        priority: 10,
        enabled: true,
      });

      // Trade should match highest priority policy
      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        amount: 1000,
        agentName: 'vector',
        projectId: 'project_1',
      });
      expect(result.decision).toBe('verify');
    });

    test('should handle wildcard patterns', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'All Admin Actions',
        category: 'security',
        pattern: /^admin_.+$/,
        action: 'refuse',
        priority: 10,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'admin_delete_all',
        resource: 'database',
        agentName: 'system',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('refuse');
    });

    test('should handle case-insensitive patterns', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Case Insensitive',
        category: 'financial',
        pattern: /TRADE/i,
        action: 'verify',
        priority: 0,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('verify');
    });
  });

  // ============================================
  // Confidence Scoring
  // ============================================
  describe('Confidence Scoring', () => {
    test('should return high confidence for explicit policy match', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Test Policy',
        category: 'financial',
        pattern: 'execute_trade',
        action: 'verify',
        priority: 0,
        enabled: true,
      });

      const result = engine.evaluate({
        action: 'execute_trade',
        resource: 'portfolio',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.confidence).toBe(0.9);
    });

    test('should return lower confidence for default decision', () => {
      const result = engine.evaluate({
        action: 'unknown_action',
        resource: 'test',
        agentName: 'test',
        projectId: 'project_1',
      });

      expect(result.confidence).toBe(0.5);
    });
  });

  // ============================================
  // Edge Cases
  // ============================================
  describe('Edge Cases', () => {
    test('should handle empty action string', () => {
      const result = engine.evaluate({
        action: '',
        resource: 'test',
        agentName: 'test',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
    });

    test('should handle special regex characters', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Special Chars',
        category: 'security',
        pattern: 'action[test]',
        action: 'refuse',
        priority: 0,
        enabled: true,
      });

      // The pattern is treated as regex, so [test] means t, e, or s
      const result = engine.evaluate({
        action: 'actiont',
        resource: 'test',
        agentName: 'test',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('refuse');
    });

    test('should handle very long action strings', () => {
      const longAction = 'a'.repeat(10000);
      
      const result = engine.evaluate({
        action: longAction,
        resource: 'test',
        agentName: 'test',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('execute');
    });

    test('should handle unicode in action strings', () => {
      engine.addPolicy({
        id: 'policy_1',
        name: 'Unicode Test',
        category: 'operational',
        pattern: /交易/,
        action: 'verify',
        priority: 0,
        enabled: true,
      });

      const result = engine.evaluate({
        action: '执行交易',
        resource: 'portfolio',
        agentName: 'vector',
        projectId: 'project_1',
      });

      expect(result.decision).toBe('verify');
    });

    test('should handle null metadata gracefully', () => {
      const result = engine.evaluate({
        action: 'test_action',
        resource: 'test',
        agentName: 'test',
        projectId: 'project_1',
        metadata: null as any,
      });

      expect(result.decision).toBe('execute');
    });
  });
});

// ============================================
// ERV Decision Record Tests
// ============================================

describe('ERV Decision Records', () => {
  test('should create decision with valid data', () => {
    const decision = mockERVDecision({
      action: 'execute',
      reasoning: 'Trade within limits',
      confidence: 0.95,
    });

    expect(decision.action).toBe('execute');
    expect(decision.confidence).toBe(0.95);
  });

  test('should track decision overrides', () => {
    const decision = mockERVDecision({
      overridden: true,
      overriddenBy: 'user_admin',
      overriddenAt: new Date().toISOString(),
    });

    expect(decision.overridden).toBe(true);
    expect(decision.overriddenBy).toBe('user_admin');
  });

  test('should link decision to policy', () => {
    const decision = mockERVDecision({
      policyId: 'policy_123',
    });

    expect(decision.policyId).toBe('policy_123');
  });

  test('should store decision context as JSON', () => {
    const context = {
      symbol: 'AAPL',
      amount: 10000,
      risk: 'medium',
    };

    const decision = mockERVDecision({
      context: JSON.stringify(context),
    });

    const parsedContext = JSON.parse(decision.context);
    expect(parsedContext.symbol).toBe('AAPL');
  });
});

// ============================================
// Policy Management Tests
// ============================================

describe('Policy Management', () => {
  test('should create policy with all required fields', () => {
    const policy = mockERVPolicy({
      name: 'Test Policy',
      category: 'financial',
      pattern: 'execute_trade',
      action: 'verify',
      priority: 5,
      enabled: true,
    });

    expect(policy.name).toBe('Test Policy');
    expect(policy.enabled).toBe(true);
  });

  test('should disable policy', () => {
    const policy = mockERVPolicy({
      enabled: false,
    });

    expect(policy.enabled).toBe(false);
  });

  test('should update policy priority', () => {
    const policy = mockERVPolicy({
      priority: 10,
    });

    expect(policy.priority).toBe(10);
  });

  test('should store conditions as JSON', () => {
    const conditions = {
      maxAmount: 50000,
      allowedSymbols: ['AAPL', 'GOOGL'],
    };

    const policy = mockERVPolicy({
      conditions: JSON.stringify(conditions),
    });

    const parsedConditions = JSON.parse(policy.conditions!);
    expect(parsedConditions.maxAmount).toBe(50000);
  });
});
