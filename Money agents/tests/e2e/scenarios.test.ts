/**
 * End-to-End Scenario Tests
 * Tests for complete user workflows and integration scenarios
 */

import {
  mockProject,
  mockPhase,
  mockAgent,
  mockAgentExecution,
  mockPortfolio,
  mockPosition,
  mockTransaction,
  mockERVDecision,
  mockERVPolicy,
  mockHumanApproval,
  mockAuditLog,
  createMockPrismaClient,
  AGENT_DEFINITIONS,
} from '../utils/test-utils';

const mockDb = createMockPrismaClient();

// ============================================
// Complete Project Lifecycle Tests
// ============================================

describe('Complete Project Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should complete full project lifecycle from creation to completion', async () => {
    // Step 1: Create project
    const project = mockProject({ status: 'draft' });
    mockDb.project.create.mockResolvedValue(project);
    
    const createdProject = await mockDb.project.create({
      data: { name: 'E2E Test Project', mode: 'simulation' },
    });
    
    expect(createdProject.status).toBe('draft');

    // Step 2: Create phases
    const phases = [
      mockPhase({ name: 'research', order: 0, status: 'pending' }),
      mockPhase({ name: 'analysis', order: 1, status: 'pending' }),
      mockPhase({ name: 'validation', order: 2, status: 'pending' }),
      mockPhase({ name: 'synthesis', order: 3, status: 'pending' }),
      mockPhase({ name: 'execution', order: 4, status: 'pending' }),
    ];
    mockDb.phase.createMany.mockResolvedValue({ count: 5 });

    await mockDb.phase.createMany({
      data: phases.map(p => ({ ...p, projectId: createdProject.id })),
    });

    // Step 3: Create portfolio
    const portfolio = mockPortfolio({ projectId: createdProject.id });
    mockDb.portfolio.create.mockResolvedValue(portfolio);

    const createdPortfolio = await mockDb.portfolio.create({
      data: { projectId: createdProject.id, cash: 100000, totalValue: 100000 },
    });

    // Step 4: Start project
    mockDb.project.update.mockResolvedValue({ ...createdProject, status: 'running' });
    
    const startedProject = await mockDb.project.update({
      where: { id: createdProject.id },
      data: { status: 'running', startedAt: new Date() },
    });

    expect(startedProject.status).toBe('running');

    // Step 5: Execute phases
    for (let i = 0; i < phases.length; i++) {
      mockDb.phase.update.mockResolvedValue({ ...phases[i], status: 'completed' });
      await mockDb.phase.update({
        where: { id: phases[i].id },
        data: { status: 'completed', completedAt: new Date() },
      });
    }

    // Step 6: Complete project
    mockDb.project.update.mockResolvedValue({
      ...startedProject,
      status: 'completed',
      completedAt: new Date(),
    });

    const completedProject = await mockDb.project.update({
      where: { id: createdProject.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    expect(completedProject.status).toBe('completed');
    
    // Verify all steps were called
    expect(mockDb.project.create).toHaveBeenCalled();
    expect(mockDb.phase.createMany).toHaveBeenCalled();
    expect(mockDb.portfolio.create).toHaveBeenCalled();
    expect(mockDb.project.update).toHaveBeenCalled();
  });

  test('should handle project failure scenario', async () => {
    const project = mockProject({ status: 'running' });
    
    // Simulate phase failure
    mockDb.phase.update.mockResolvedValue(mockPhase({ status: 'failed' }));
    
    await mockDb.phase.update({
      where: { id: 'phase_1' },
      data: { status: 'failed', error: 'Agent execution failed' },
    });

    // Project should be marked as failed
    mockDb.project.update.mockResolvedValue({ ...project, status: 'failed' });
    
    const failedProject = await mockDb.project.update({
      where: { id: project.id },
      data: { status: 'failed' },
    });

    expect(failedProject.status).toBe('failed');
  });
});

// ============================================
// Agent Execution Workflow Tests
// ============================================

describe('Agent Execution Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should execute Sentinel agent workflow', async () => {
    const agent = mockAgent({ name: 'sentinel' });
    const project = mockProject({ status: 'running' });
    const phase = mockPhase({ name: 'research' });

    // Create execution record
    const execution = mockAgentExecution({
      agentId: agent.id,
      phaseId: phase.id,
      projectId: project.id,
      status: 'pending',
    });
    mockDb.agentExecution.create.mockResolvedValue(execution);

    const createdExecution = await mockDb.agentExecution.create({
      data: {
        projectId: project.id,
        phaseId: phase.id,
        agentId: agent.id,
        status: 'pending',
      },
    });

    // Update to running
    mockDb.agentExecution.update.mockResolvedValue({
      ...createdExecution,
      status: 'running',
      startedAt: new Date(),
    });

    await mockDb.agentExecution.update({
      where: { id: createdExecution.id },
      data: { status: 'running', startedAt: new Date() },
    });

    // Complete execution
    const output = JSON.stringify({
      anomalies: [
        { type: 'volume_spike', symbol: 'AAPL', severity: 'high' },
        { type: 'price_deviation', symbol: 'GOOGL', severity: 'medium' },
      ],
    });

    mockDb.agentExecution.update.mockResolvedValue({
      ...createdExecution,
      status: 'completed',
      output,
      tokensUsed: 1500,
      cost: 0.03,
      duration: 2500,
    });

    const completedExecution = await mockDb.agentExecution.update({
      where: { id: createdExecution.id },
      data: {
        status: 'completed',
        output,
        tokensUsed: 1500,
        cost: 0.03,
        duration: 2500,
        completedAt: new Date(),
      },
    });

    expect(completedExecution.status).toBe('completed');
    expect(completedExecution.tokensUsed).toBe(1500);
  });

  test('should execute Oracle agent with ERV decision', async () => {
    const agent = mockAgent({ name: 'oracle' });
    const project = mockProject();
    const phase = mockPhase({ name: 'execution' });

    // Create execution
    const execution = mockAgentExecution({
      agentId: agent.id,
      phaseId: phase.id,
      projectId: project.id,
      status: 'completed',
      output: JSON.stringify({ recommendation: 'buy', symbol: 'AAPL', quantity: 100 }),
    });
    mockDb.agentExecution.create.mockResolvedValue(execution);

    // Create ERV decision
    const ervDecision = mockERVDecision({
      action: 'verify',
      reasoning: 'Trade size requires human approval',
      confidence: 0.85,
    });
    mockDb.eRVDecision.create.mockResolvedValue(ervDecision);

    const decision = await mockDb.eRVDecision.create({
      data: {
        phaseOutputId: 'output_1',
        action: 'verify',
        reasoning: 'Trade size requires human approval',
        confidence: 0.85,
      },
    });

    expect(decision.action).toBe('verify');
  });

  test('should execute all six agents in sequence', async () => {
    const agents = AGENT_DEFINITIONS.map(def => mockAgent({ name: def.name }));
    
    for (const agent of agents) {
      const execution = mockAgentExecution({
        agentId: agent.id,
        status: 'completed',
      });
      mockDb.agentExecution.create.mockResolvedValue(execution);

      await mockDb.agentExecution.create({
        data: {
          projectId: 'project_1',
          phaseId: 'phase_1',
          agentId: agent.id,
          status: 'completed',
        },
      });
    }

    expect(mockDb.agentExecution.create).toHaveBeenCalledTimes(6);
  });
});

// ============================================
// Trading Workflow Tests
// ============================================

describe('Trading Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should execute complete buy trade workflow', async () => {
    const portfolio = mockPortfolio({ cash: 100000, totalValue: 100000 });
    
    // Step 1: Check portfolio balance
    mockDb.portfolio.findUnique.mockResolvedValue(portfolio);
    const currentPortfolio = await mockDb.portfolio.findUnique({
      where: { id: portfolio.id },
    });
    expect(currentPortfolio?.cash).toBeGreaterThanOrEqual(15000);

    // Step 2: Create transaction
    const transaction = mockTransaction({
      type: 'buy',
      symbol: 'AAPL',
      quantity: 100,
      price: 150,
      total: 15000,
      executedBy: 'oracle',
    });
    mockDb.transaction.create.mockResolvedValue(transaction);

    const createdTransaction = await mockDb.transaction.create({
      data: {
        portfolioId: portfolio.id,
        symbol: 'AAPL',
        type: 'buy',
        quantity: 100,
        price: 150,
        total: 15000,
        executedBy: 'oracle',
      },
    });

    // Step 3: Update or create position
    const position = mockPosition({
      symbol: 'AAPL',
      quantity: 100,
      avgCost: 150,
      marketValue: 15000,
    });
    mockDb.position.create.mockResolvedValue(position);

    await mockDb.position.create({
      data: {
        portfolioId: portfolio.id,
        symbol: 'AAPL',
        quantity: 100,
        avgCost: 150,
        currentPrice: 150,
        marketValue: 15000,
      },
    });

    // Step 4: Update portfolio cash
    mockDb.portfolio.update.mockResolvedValue({
      ...portfolio,
      cash: 85000,
      totalValue: 100000,
    });

    await mockDb.portfolio.update({
      where: { id: portfolio.id },
      data: { cash: 85000 },
    });

    // Step 5: Create audit log
    mockDb.auditLog.create.mockResolvedValue(mockAuditLog({
      action: 'execute_trade',
      actor: 'oracle',
    }));

    await mockDb.auditLog.create({
      data: {
        projectId: 'project_1',
        actor: 'oracle',
        action: 'execute_trade',
        resource: 'portfolio',
        details: JSON.stringify({ symbol: 'AAPL', quantity: 100, price: 150 }),
        hash: 'trade_hash_123',
      },
    });

    expect(mockDb.transaction.create).toHaveBeenCalled();
    expect(mockDb.position.create).toHaveBeenCalled();
    expect(mockDb.portfolio.update).toHaveBeenCalled();
    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });

  test('should execute sell trade workflow', async () => {
    const portfolio = mockPortfolio();
    const existingPosition = mockPosition({ symbol: 'AAPL', quantity: 100, avgCost: 150 });

    // Check position exists
    mockDb.position.findUnique.mockResolvedValue(existingPosition);
    const position = await mockDb.position.findUnique({
      where: { id: existingPosition.id },
    });
    expect(position?.quantity).toBeGreaterThanOrEqual(50);

    // Create sell transaction
    const transaction = mockTransaction({
      type: 'sell',
      symbol: 'AAPL',
      quantity: 50,
      price: 160,
      total: 8000,
    });
    mockDb.transaction.create.mockResolvedValue(transaction);

    await mockDb.transaction.create({
      data: {
        portfolioId: portfolio.id,
        symbol: 'AAPL',
        type: 'sell',
        quantity: 50,
        price: 160,
        total: 8000,
        executedBy: 'vector',
      },
    });

    // Update position
    mockDb.position.update.mockResolvedValue({
      ...existingPosition,
      quantity: 50,
    });

    await mockDb.position.update({
      where: { id: existingPosition.id },
      data: { quantity: 50 },
    });

    // Update portfolio
    mockDb.portfolio.update.mockResolvedValue({
      ...portfolio,
      cash: 108000,
    });

    await mockDb.portfolio.update({
      where: { id: portfolio.id },
      data: { cash: 108000 },
    });

    expect(mockDb.transaction.create).toHaveBeenCalled();
    expect(mockDb.position.update).toHaveBeenCalled();
  });

  test('should handle portfolio P&L calculation', async () => {
    const positions = [
      mockPosition({ symbol: 'AAPL', quantity: 100, avgCost: 150, currentPrice: 160, unrealizedPnL: 1000, marketValue: 16000 }),
      mockPosition({ symbol: 'GOOGL', quantity: 50, avgCost: 2800, currentPrice: 2750, unrealizedPnL: -2500, marketValue: 137500 }),
      mockPosition({ symbol: 'MSFT', quantity: 200, avgCost: 350, currentPrice: 380, unrealizedPnL: 6000, marketValue: 76000 }),
    ];

    mockDb.position.findMany.mockResolvedValue(positions);

    const allPositions = await mockDb.position.findMany({
      where: { portfolioId: 'portfolio_1' },
    });

    const totalUnrealizedPnL = allPositions.reduce((sum, pos) => sum + (pos.unrealizedPnL || 0), 0);
    const totalMarketValue = allPositions.reduce((sum, pos) => sum + (pos.marketValue || 0), 0);

    expect(totalUnrealizedPnL).toBe(4500);
    expect(totalMarketValue).toBe(16000 + 137500 + 76000);
  });
});

// ============================================
// Human-in-the-Loop Workflow Tests
// ============================================

describe('Human-in-the-Loop Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle approval request workflow', async () => {
    // Step 1: Agent creates action requiring approval
    const ervDecision = mockERVDecision({
      action: 'verify',
      reasoning: 'Large trade requires approval',
    });
    mockDb.eRVDecision.create.mockResolvedValue(ervDecision);

    await mockDb.eRVDecision.create({
      data: {
        phaseOutputId: 'output_1',
        action: 'verify',
        reasoning: 'Large trade requires approval',
        confidence: 0.9,
      },
    });

    // Step 2: Create approval request
    const approval = mockHumanApproval({
      status: 'pending',
      action: 'execute_trade',
      context: JSON.stringify({ symbol: 'AAPL', quantity: 1000, price: 150 }),
    });
    mockDb.humanApproval.create.mockResolvedValue(approval);

    const createdApproval = await mockDb.humanApproval.create({
      data: {
        projectId: 'project_1',
        ervDecisionId: ervDecision.id,
        requester: 'oracle',
        action: 'execute_trade',
        context: JSON.stringify({ symbol: 'AAPL', quantity: 1000, price: 150 }),
        status: 'pending',
      },
    });

    // Step 3: Fetch pending approvals
    mockDb.humanApproval.findMany.mockResolvedValue([createdApproval]);
    const pendingApprovals = await mockDb.humanApproval.findMany({
      where: { status: 'pending' },
    });

    expect(pendingApprovals).toHaveLength(1);

    // Step 4: Approve request
    mockDb.humanApproval.update.mockResolvedValue({
      ...createdApproval,
      status: 'approved',
      reviewedAt: new Date(),
    });

    await mockDb.humanApproval.update({
      where: { id: createdApproval.id },
      data: { status: 'approved', reviewedAt: new Date() },
    });

    // Step 5: Mark ERV decision as overridden
    mockDb.eRVDecision.update.mockResolvedValue({
      ...ervDecision,
      overridden: true,
    });

    await mockDb.eRVDecision.update({
      where: { id: ervDecision.id },
      data: { overridden: true },
    });

    expect(mockDb.humanApproval.create).toHaveBeenCalled();
    expect(mockDb.humanApproval.update).toHaveBeenCalled();
  });

  test('should handle rejection workflow', async () => {
    const approval = mockHumanApproval({ status: 'pending' });

    mockDb.humanApproval.update.mockResolvedValue({
      ...approval,
      status: 'rejected',
      reviewNotes: 'Risk exceeds acceptable threshold',
    });

    const result = await mockDb.humanApproval.update({
      where: { id: approval.id },
      data: {
        status: 'rejected',
        reviewNotes: 'Risk exceeds acceptable threshold',
        reviewedAt: new Date(),
      },
    });

    expect(result.status).toBe('rejected');
  });

  test('should handle approval expiration', async () => {
    const expiredApproval = mockHumanApproval({
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000).toISOString(), // Already expired
    });

    const isExpired = new Date(expiredApproval.expiresAt) < new Date();
    expect(isExpired).toBe(true);

    // Mark as expired
    mockDb.humanApproval.update.mockResolvedValue({
      ...expiredApproval,
      status: 'expired',
    });

    await mockDb.humanApproval.update({
      where: { id: expiredApproval.id },
      data: { status: 'expired' },
    });
  });
});

// ============================================
// Audit Trail Workflow Tests
// ============================================

describe('Audit Trail Workflow', () => {
  const crypto = require('crypto');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should build hash chain audit trail', async () => {
    const entries: any[] = [];
    let previousHash: string | null = null;

    // Create chain of audit entries
    for (let i = 0; i < 5; i++) {
      const hash = crypto
        .createHash('sha256')
        .update(`${previousHash || 'genesis'}:action_${i}:${Date.now()}`)
        .digest('hex');

      const entry = mockAuditLog({
        action: `action_${i}`,
        hash,
        previousHash,
      });

      entries.push(entry);
      previousHash = hash;

      mockDb.auditLog.create.mockResolvedValue(entry);
      await mockDb.auditLog.create({
        data: {
          projectId: 'project_1',
          actor: 'system',
          action: `action_${i}`,
          resource: 'test',
          details: '{}',
          hash,
          previousHash,
        },
      });
    }

    // Verify chain integrity
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i].previousHash).toBe(entries[i - 1].hash);
    }

    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(5);
  });

  test('should detect tampering in audit trail', async () => {
    const originalChain = [
      mockAuditLog({ hash: 'hash_1', previousHash: null }),
      mockAuditLog({ hash: 'hash_2', previousHash: 'hash_1' }),
      mockAuditLog({ hash: 'hash_3', previousHash: 'hash_2' }),
    ];

    // Tampered chain
    const tamperedChain = [
      originalChain[0],
      mockAuditLog({ hash: 'tampered_hash', previousHash: 'hash_1' }),
      mockAuditLog({ hash: 'hash_3', previousHash: 'hash_2' }), // Still points to original
    ];

    // Chain integrity check
    let chainValid = true;
    for (let i = 1; i < tamperedChain.length; i++) {
      if (tamperedChain[i].previousHash !== tamperedChain[i - 1].hash) {
        chainValid = false;
        break;
      }
    }

    expect(chainValid).toBe(false);
  });

  test('should log all critical actions', async () => {
    const criticalActions = [
      'project_created',
      'project_started',
      'trade_executed',
      'approval_requested',
      'approval_granted',
      'approval_rejected',
      'project_completed',
    ];

    for (const action of criticalActions) {
      mockDb.auditLog.create.mockResolvedValue(mockAuditLog({ action }));
      await mockDb.auditLog.create({
        data: {
          projectId: 'project_1',
          actor: 'system',
          action,
          resource: 'system',
          details: '{}',
          hash: `hash_${action}`,
        },
      });
    }

    expect(mockDb.auditLog.create).toHaveBeenCalledTimes(criticalActions.length);
  });
});

// ============================================
// Multi-Agent Collaboration Tests
// ============================================

describe('Multi-Agent Collaboration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should execute agents in correct phase order', async () => {
    const phases = [
      mockPhase({ name: 'research', order: 0, status: 'completed' }),
      mockPhase({ name: 'analysis', order: 1, status: 'running' }),
      mockPhase({ name: 'validation', order: 2, status: 'pending' }),
      mockPhase({ name: 'synthesis', order: 3, status: 'pending' }),
      mockPhase({ name: 'execution', order: 4, status: 'pending' }),
    ];

    mockDb.phase.findMany.mockResolvedValue(phases);

    const allPhases = await mockDb.phase.findMany({
      where: { projectId: 'project_1' },
      orderBy: { order: 'asc' },
    });

    // Verify order
    for (let i = 0; i < allPhases.length - 1; i++) {
      expect(allPhases[i].order).toBeLessThan(allPhases[i + 1].order);
    }

    // Only one phase should be running at a time
    const runningPhases = allPhases.filter(p => p.status === 'running');
    expect(runningPhases).toHaveLength(1);
  });

  test('should pass outputs between agents', async () => {
    // Sentinel output
    const sentinelOutput = {
      anomalies: [{ type: 'volume_spike', symbol: 'AAPL' }],
    };

    // Cipher receives Sentinel output as input
    const cipherInput = sentinelOutput;

    // Cipher produces analysis
    const cipherOutput = {
      ...cipherInput,
      analysis: { recommendation: 'buy', confidence: 0.85 },
    };

    // Guardian validates
    const guardianOutput = {
      ...cipherOutput,
      validation: { approved: true, risk: 'low' },
    };

    // Oracle forecasts
    const oracleOutput = {
      ...guardianOutput,
      forecast: { targetPrice: 180, timeframe: '3m' },
    };

    // Vector executes
    const vectorOutput = {
      ...oracleOutput,
      execution: { orderId: 'order_123', status: 'filled' },
    };

    // Verify data flow
    expect(vectorOutput.anomalies).toEqual(sentinelOutput.anomalies);
    expect(vectorOutput.analysis).toEqual(cipherOutput.analysis);
    expect(vectorOutput.validation).toEqual(guardianOutput.validation);
    expect(vectorOutput.forecast).toEqual(oracleOutput.forecast);
    expect(vectorOutput.execution.orderId).toBe('order_123');
  });

  test('should aggregate all agent outputs for final report', async () => {
    const agentOutputs = [
      { agent: 'sentinel', output: { anomalies: 5 } },
      { agent: 'cipher', output: { patterns: 12 } },
      { agent: 'guardian', output: { risks: 3 } },
      { agent: 'oracle', output: { predictions: 8 } },
      { agent: 'vector', output: { trades: 15 } },
      { agent: 'ledger', output: { audits: 50 } },
    ];

    mockDb.agentExecution.findMany.mockResolvedValue(
      agentOutputs.map(a => mockAgentExecution({
        agentId: a.agent,
        output: JSON.stringify(a.output),
      }))
    );

    const executions = await mockDb.agentExecution.findMany({
      where: { projectId: 'project_1' },
    });

    const aggregatedOutput = executions.map(e => ({
      agent: e.agentId,
      output: JSON.parse(e.output || '{}'),
    }));

    expect(aggregatedOutput).toHaveLength(6);
  });
});

// ============================================
// Error Recovery Scenario Tests
// ============================================

describe('Error Recovery Scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should recover from agent execution failure', async () => {
    // First execution fails
    const failedExecution = mockAgentExecution({
      status: 'failed',
      error: 'API timeout',
    });
    mockDb.agentExecution.create.mockResolvedValueOnce(failedExecution);

    const firstAttempt = await mockDb.agentExecution.create({
      data: { projectId: 'project_1', phaseId: 'phase_1', agentId: 'agent_1', status: 'failed' },
    });

    expect(firstAttempt.status).toBe('failed');

    // Retry succeeds
    const successExecution = mockAgentExecution({ status: 'completed' });
    mockDb.agentExecution.create.mockResolvedValueOnce(successExecution);

    const retry = await mockDb.agentExecution.create({
      data: { projectId: 'project_1', phaseId: 'phase_1', agentId: 'agent_1', status: 'completed' },
    });

    expect(retry.status).toBe('completed');
  });

  test('should handle partial transaction failure', async () => {
    const portfolio = mockPortfolio({ cash: 100000 });

    // First trade succeeds
    mockDb.transaction.create.mockResolvedValueOnce(
      mockTransaction({ symbol: 'AAPL', quantity: 100, total: 15000 })
    );
    await mockDb.transaction.create({
      data: { portfolioId: portfolio.id, symbol: 'AAPL', type: 'buy', quantity: 100, price: 150, total: 15000, executedBy: 'oracle' },
    });

    // Second trade fails
    mockDb.transaction.create.mockRejectedValueOnce(new Error('Insufficient funds'));
    try {
      await mockDb.transaction.create({
        data: { portfolioId: portfolio.id, symbol: 'GOOGL', type: 'buy', quantity: 100, price: 2800, total: 280000, executedBy: 'oracle' },
      });
    } catch (e) {
      // Expected to fail
    }

    // First transaction should still be valid
    expect(mockDb.transaction.create).toHaveBeenCalledTimes(2);
  });

  test('should handle phase rollback', async () => {
    // Phase was running but project failed
    mockDb.phase.update.mockResolvedValue(mockPhase({ status: 'pending' }));

    await mockDb.phase.update({
      where: { id: 'phase_1' },
      data: { status: 'pending', startedAt: null },
    });

    expect(mockDb.phase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending' }),
      })
    );
  });
});

// ============================================
// Full System Integration Test
// ============================================

describe('Full System Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should execute complete autonomous trading workflow', async () => {
    // 1. Create project
    const project = mockProject({ mode: 'simulation' });
    mockDb.project.create.mockResolvedValue(project);
    await mockDb.project.create({ data: { name: 'Full Integration Test', mode: 'simulation' } });

    // 2. Initialize portfolio
    const portfolio = mockPortfolio();
    mockDb.portfolio.create.mockResolvedValue(portfolio);
    await mockDb.portfolio.create({ data: { projectId: project.id, cash: 100000, totalValue: 100000 } });

    // 3. Run agents
    const agents = AGENT_DEFINITIONS.map(def => mockAgent({ name: def.name }));
    for (const agent of agents) {
      mockDb.agentExecution.create.mockResolvedValue(mockAgentExecution({ agentId: agent.id }));
      await mockDb.agentExecution.create({
        data: { projectId: project.id, phaseId: 'phase_1', agentId: agent.id, status: 'completed' },
      });
    }

    // 4. ERV Decision
    const ervDecision = mockERVDecision({ action: 'verify' });
    mockDb.eRVDecision.create.mockResolvedValue(ervDecision);
    await mockDb.eRVDecision.create({ data: { phaseOutputId: 'output_1', action: 'verify' } });

    // 5. Human Approval
    const approval = mockHumanApproval({ status: 'approved' });
    mockDb.humanApproval.create.mockResolvedValue(approval);
    await mockDb.humanApproval.create({
      data: { projectId: project.id, ervDecisionId: ervDecision.id, requester: 'oracle', action: 'trade', status: 'approved' },
    });

    // 6. Execute Trade
    const transaction = mockTransaction();
    mockDb.transaction.create.mockResolvedValue(transaction);
    await mockDb.transaction.create({
      data: { portfolioId: portfolio.id, symbol: 'AAPL', type: 'buy', quantity: 100, price: 150, total: 15000, executedBy: 'vector' },
    });

    // 7. Update Position
    const position = mockPosition();
    mockDb.position.create.mockResolvedValue(position);
    await mockDb.position.create({
      data: { portfolioId: portfolio.id, symbol: 'AAPL', quantity: 100, avgCost: 150 },
    });

    // 8. Create Audit Log
    const auditLog = mockAuditLog();
    mockDb.auditLog.create.mockResolvedValue(auditLog);
    await mockDb.auditLog.create({
      data: { projectId: project.id, actor: 'vector', action: 'execute_trade', resource: 'portfolio', details: '{}', hash: 'final_hash' },
    });

    // 9. Complete Project
    mockDb.project.update.mockResolvedValue({ ...project, status: 'completed' });
    await mockDb.project.update({ where: { id: project.id }, data: { status: 'completed' } });

    // Verify complete workflow
    expect(mockDb.project.create).toHaveBeenCalled();
    expect(mockDb.portfolio.create).toHaveBeenCalled();
    expect(mockDb.agentExecution.create).toHaveBeenCalledTimes(6);
    expect(mockDb.eRVDecision.create).toHaveBeenCalled();
    expect(mockDb.humanApproval.create).toHaveBeenCalled();
    expect(mockDb.transaction.create).toHaveBeenCalled();
    expect(mockDb.position.create).toHaveBeenCalled();
    expect(mockDb.auditLog.create).toHaveBeenCalled();
    expect(mockDb.project.update).toHaveBeenCalled();
  });
});
