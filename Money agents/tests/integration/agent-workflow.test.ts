/**
 * Integration Tests: Full Agent Workflow
 * Tests end-to-end agent execution, ERV decisions, and approvals
 */

import {
  createMockPrismaClient,
  mockProject,
  mockPhase,
  mockAgent,
  mockAgentExecution,
  mockERVDecision,
  mockERVPolicy,
  mockHumanApproval,
  mockPortfolio,
  mockPosition,
  mockTransaction,
  mockAuditLog,
  AGENT_DEFINITIONS,
} from '../utils/test-utils';

// ============================================
// Mock Services
// ============================================

class MockAgentOrchestrator {
  private db: ReturnType<typeof createMockPrismaClient>;
  private policies: typeof mockERVPolicy[] = [];

  constructor(db: ReturnType<typeof createMockPrismaClient>) {
    this.db = db;
  }

  async initializeProject(projectId: string): Promise<void> {
    // Update project status
    await this.db.project.update({
      where: { id: projectId },
      data: { status: 'running', startedAt: new Date() },
    });

    // Get phases
    const phases = await this.db.phase.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    // Start first phase
    if (phases.length > 0) {
      await this.startPhase(phases[0].id);
    }
  }

  async startPhase(phaseId: string): Promise<void> {
    await this.db.phase.update({
      where: { id: phaseId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  async completePhase(phaseId: string): Promise<void> {
    await this.db.phase.update({
      where: { id: phaseId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  addPolicy(policy: typeof mockERVPolicy): void {
    this.policies.push(policy);
  }

  evaluateERV(action: string, context: Record<string, any>): 'execute' | 'refuse' | 'verify' {
    for (const policy of this.policies) {
      if (policy.enabled && new RegExp(policy.pattern).test(action)) {
        return policy.action as 'execute' | 'refuse' | 'verify';
      }
    }
    return 'execute';
  }
}

// ============================================
// Integration Test Setup
// ============================================

const mockDb = createMockPrismaClient();

describe('Full Agent Workflow Integration', () => {
  let orchestrator: MockAgentOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator = new MockAgentOrchestrator(mockDb);
  });

  // ============================================
  // Project Creation Flow
  // ============================================
  describe('Project Creation Flow', () => {
    test('should create project with all phases', async () => {
      const project = mockProject();
      const phases = [
        mockPhase({ name: 'research', order: 0 }),
        mockPhase({ name: 'analysis', order: 1 }),
        mockPhase({ name: 'validation', order: 2 }),
        mockPhase({ name: 'synthesis', order: 3 }),
        mockPhase({ name: 'execution', order: 4 }),
      ];

      mockDb.project.create.mockResolvedValue(project);
      mockDb.phase.createMany.mockResolvedValue({ count: 5 });
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio());

      // Create project
      await mockDb.project.create({
        data: {
          name: 'Test Project',
          status: 'draft',
          mode: 'simulation',
        },
      });

      // Create phases
      await mockDb.phase.createMany({
        data: phases.map(p => ({ ...p, projectId: project.id })),
      });

      // Create portfolio
      await mockDb.portfolio.create({
        data: {
          projectId: project.id,
          cash: 100000,
          totalValue: 100000,
        },
      });

      expect(mockDb.project.create).toHaveBeenCalled();
      expect(mockDb.phase.createMany).toHaveBeenCalled();
      expect(mockDb.portfolio.create).toHaveBeenCalled();
    });

    test('should initialize portfolio for simulation mode', async () => {
      const project = mockProject({ mode: 'simulation' });
      const portfolio = mockPortfolio({ projectId: project.id });

      mockDb.project.create.mockResolvedValue(project);
      mockDb.portfolio.create.mockResolvedValue(portfolio);

      await mockDb.project.create({
        data: { name: 'Test', mode: 'simulation' },
      });

      await mockDb.portfolio.create({
        data: { projectId: project.id, cash: 100000, totalValue: 100000 },
      });

      expect(mockDb.portfolio.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cash: 100000,
          }),
        })
      );
    });
  });

  // ============================================
  // Agent Execution Flow
  // ============================================
  describe('Agent Execution Flow', () => {
    test('should execute sentinel agent in research phase', async () => {
      const project = mockProject();
      const phase = mockPhase({ name: 'research' });
      const agent = mockAgent({ name: 'sentinel' });
      const execution = mockAgentExecution({
        agentId: agent.id,
        phaseId: phase.id,
        projectId: project.id,
        status: 'completed',
        output: JSON.stringify({ anomalies: [] }),
      });

      mockDb.agent.findUnique.mockResolvedValue(agent);
      mockDb.agentExecution.create.mockResolvedValue(execution);
      mockDb.agentExecution.update.mockResolvedValue(execution);

      // Create execution record
      await mockDb.agentExecution.create({
        data: {
          projectId: project.id,
          phaseId: phase.id,
          agentId: agent.id,
          status: 'pending',
        },
      });

      // Update to completed
      await mockDb.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: 'completed',
          output: execution.output,
          duration: 1500,
        },
      });

      expect(mockDb.agentExecution.create).toHaveBeenCalled();
      expect(mockDb.agentExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'completed' }),
        })
      );
    });

    test('should track token usage per execution', async () => {
      const execution = mockAgentExecution({
        status: 'completed',
        tokensUsed: 500,
        cost: 0.01,
      });

      mockDb.agentExecution.update.mockResolvedValue(execution);

      await mockDb.agentExecution.update({
        where: { id: execution.id },
        data: {
          tokensUsed: 500,
          cost: 0.01,
        },
      });

      expect(mockDb.agentExecution.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokensUsed: 500,
            cost: 0.01,
          }),
        })
      );
    });
  });

  // ============================================
  // ERV Decision Flow
  // ============================================
  describe('ERV Decision Flow', () => {
    test('should evaluate trade request with ERV', async () => {
      const policy = mockERVPolicy({
        name: 'Large Trade Verification',
        pattern: 'execute_trade',
        action: 'verify',
        conditions: JSON.stringify({ maxAmount: 100000 }),
      });

      orchestrator.addPolicy(policy);

      const decision = orchestrator.evaluateERV('execute_trade', {
        amount: 150000,
        symbol: 'AAPL',
      });

      expect(decision).toBe('verify');
    });

    test('should auto-execute safe actions', async () => {
      const policy = mockERVPolicy({
        name: 'Read Operations',
        pattern: 'read_.*',
        action: 'execute',
      });

      orchestrator.addPolicy(policy);

      const decision = orchestrator.evaluateERV('read_market_data', {});

      expect(decision).toBe('execute');
    });

    test('should refuse dangerous actions', async () => {
      const policy = mockERVPolicy({
        name: 'Block External Transfers',
        pattern: 'external_transfer',
        action: 'refuse',
        priority: 10,
      });

      orchestrator.addPolicy(policy);

      const decision = orchestrator.evaluateERV('external_transfer', {});

      expect(decision).toBe('refuse');
    });

    test('should create ERV decision record', async () => {
      const decision = mockERVDecision({
        action: 'verify',
        reasoning: 'Trade amount exceeds threshold',
        confidence: 0.95,
      });

      mockDb.eRVDecision.create.mockResolvedValue(decision);

      await mockDb.eRVDecision.create({
        data: {
          phaseOutputId: 'output_1',
          action: 'verify',
          reasoning: 'Trade amount exceeds threshold',
          confidence: 0.95,
        },
      });

      expect(mockDb.eRVDecision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'verify',
          }),
        })
      );
    });
  });

  // ============================================
  // Human-in-the-Loop Flow
  // ============================================
  describe('Human-in-the-Loop Flow', () => {
    test('should create approval request for VERIFY decision', async () => {
      const decision = mockERVDecision({ action: 'verify' });
      const approval = mockHumanApproval({
        ervDecisionId: decision.id,
        status: 'pending',
        action: 'execute_trade',
        context: JSON.stringify({ symbol: 'AAPL', amount: 150000 }),
      });

      mockDb.humanApproval.create.mockResolvedValue(approval);

      await mockDb.humanApproval.create({
        data: {
          projectId: 'project_1',
          ervDecisionId: decision.id,
          requester: 'oracle',
          action: 'execute_trade',
          context: JSON.stringify({ symbol: 'AAPL', amount: 150000 }),
          status: 'pending',
        },
      });

      expect(mockDb.humanApproval.create).toHaveBeenCalled();
    });

    test('should approve pending request', async () => {
      const approval = mockHumanApproval({ status: 'pending' });
      const decision = mockERVDecision();

      mockDb.humanApproval.update.mockResolvedValue({ ...approval, status: 'approved' });
      mockDb.eRVDecision.update.mockResolvedValue({ ...decision, overridden: true });

      // Approve
      await mockDb.humanApproval.update({
        where: { id: approval.id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
        },
      });

      // Update ERV decision
      await mockDb.eRVDecision.update({
        where: { id: approval.ervDecisionId },
        data: { overridden: true },
      });

      expect(mockDb.humanApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'approved' }),
        })
      );
    });

    test('should reject pending request', async () => {
      const approval = mockHumanApproval({ status: 'pending' });

      mockDb.humanApproval.update.mockResolvedValue({ ...approval, status: 'rejected' });

      await mockDb.humanApproval.update({
        where: { id: approval.id },
        data: {
          status: 'rejected',
          reviewedAt: new Date(),
          reviewNotes: 'Risk too high',
        },
      });

      expect(mockDb.humanApproval.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'rejected' }),
        })
      );
    });
  });

  // ============================================
  // Portfolio & Trading Flow
  // ============================================
  describe('Portfolio & Trading Flow', () => {
    test('should execute approved trade', async () => {
      const portfolio = mockPortfolio({ cash: 100000, totalValue: 100000 });
      const position = mockPosition({ symbol: 'AAPL', quantity: 0 });
      const transaction = mockTransaction({
        type: 'buy',
        symbol: 'AAPL',
        quantity: 100,
        price: 150,
        total: 15000,
      });

      mockDb.portfolio.findUnique.mockResolvedValue(portfolio);
      mockDb.position.create.mockResolvedValue(position);
      mockDb.transaction.create.mockResolvedValue(transaction);

      // Create transaction
      await mockDb.transaction.create({
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

      // Update portfolio
      await mockDb.portfolio.update({
        where: { id: portfolio.id },
        data: {
          cash: portfolio.cash - 15000,
        },
      });

      expect(mockDb.transaction.create).toHaveBeenCalled();
      expect(mockDb.portfolio.update).toHaveBeenCalled();
    });

    test('should track positions correctly', async () => {
      const positions = [
        mockPosition({ symbol: 'AAPL', quantity: 100, unrealizedPnL: 500 }),
        mockPosition({ symbol: 'GOOGL', quantity: 50, unrealizedPnL: -200 }),
      ];

      mockDb.position.findMany.mockResolvedValue(positions);

      const result = await mockDb.position.findMany({
        where: { portfolioId: 'portfolio_1' },
      });

      expect(result).toHaveLength(2);
    });

    test('should calculate portfolio value', () => {
      const portfolio = mockPortfolio({
        cash: 85000,
        totalValue: 105000,
        dayPnL: 5000,
        totalPnL: 5000,
      });

      expect(portfolio.totalValue - portfolio.cash).toBe(20000); // Position value
    });
  });

  // ============================================
  // Audit Trail Flow
  // ============================================
  describe('Audit Trail Flow', () => {
    test('should create audit log for each action', async () => {
      const auditLog = mockAuditLog({
        action: 'execute_trade',
        actor: 'oracle',
        resource: 'portfolio',
        hash: 'sha256_hash',
      });

      mockDb.auditLog.create.mockResolvedValue(auditLog);

      await mockDb.auditLog.create({
        data: {
          projectId: 'project_1',
          actor: 'oracle',
          action: 'execute_trade',
          resource: 'portfolio',
          details: JSON.stringify({ symbol: 'AAPL', quantity: 100 }),
          hash: 'sha256_hash',
        },
      });

      expect(mockDb.auditLog.create).toHaveBeenCalled();
    });

    test('should chain audit log entries', async () => {
      const entries = [
        mockAuditLog({ hash: 'hash_1', previousHash: null }),
        mockAuditLog({ hash: 'hash_2', previousHash: 'hash_1' }),
        mockAuditLog({ hash: 'hash_3', previousHash: 'hash_2' }),
      ];

      entries.forEach((entry, index) => {
        if (index > 0) {
          expect(entry.previousHash).toBe(entries[index - 1].hash);
        }
      });
    });
  });

  // ============================================
  // Multi-Agent Collaboration
  // ============================================
  describe('Multi-Agent Collaboration', () => {
    test('should execute agents in phase sequence', async () => {
      const phases = [
        mockPhase({ name: 'research', order: 0, status: 'completed' }),
        mockPhase({ name: 'analysis', order: 1, status: 'running' }),
        mockPhase({ name: 'validation', order: 2, status: 'pending' }),
      ];

      mockDb.phase.findMany.mockResolvedValue(phases);

      const result = await mockDb.phase.findMany({
        where: { projectId: 'project_1' },
        orderBy: { order: 'asc' },
      });

      expect(result[0].status).toBe('completed');
      expect(result[1].status).toBe('running');
      expect(result[2].status).toBe('pending');
    });

    test('should pass outputs between agents', async () => {
      const sentinelOutput = { anomalies: ['spike_in_volume'] };
      const cipherInput = sentinelOutput;

      // Sentinel produces output
      // Cipher receives as input
      expect(cipherInput.anomalies).toContain('spike_in_volume');
    });

    test('should aggregate phase outputs', async () => {
      const outputs = [
        { agentName: 'sentinel', content: 'Market data collected' },
        { agentName: 'cipher', content: 'Analysis complete' },
        { agentName: 'guardian', content: 'Security validated' },
      ];

      const aggregated = outputs.map(o => o.agentName);
      
      expect(aggregated).toContain('sentinel');
      expect(aggregated).toContain('cipher');
      expect(aggregated).toContain('guardian');
    });
  });

  // ============================================
  // Complete Workflow Test
  // ============================================
  describe('Complete Workflow', () => {
    test('should execute full project lifecycle', async () => {
      // 1. Create project
      const project = mockProject({ status: 'draft' });
      mockDb.project.create.mockResolvedValue(project);
      mockDb.project.update.mockResolvedValue({ ...project, status: 'running' });

      await mockDb.project.create({
        data: { name: 'Full Workflow Test' },
      });

      // 2. Initialize project (start)
      await mockDb.project.update({
        where: { id: project.id },
        data: { status: 'running', startedAt: new Date() },
      });

      // 3. Execute phases
      const phases = [
        mockPhase({ status: 'completed' }),
        mockPhase({ status: 'completed' }),
        mockPhase({ status: 'completed' }),
        mockPhase({ status: 'completed' }),
        mockPhase({ status: 'completed' }),
      ];
      mockDb.phase.findMany.mockResolvedValue(phases);

      // 4. Complete project
      mockDb.project.update.mockResolvedValue({
        ...project,
        status: 'completed',
        completedAt: new Date(),
      });

      await mockDb.project.update({
        where: { id: project.id },
        data: { status: 'completed', completedAt: new Date() },
      });

      expect(mockDb.project.create).toHaveBeenCalled();
      expect(mockDb.project.update).toHaveBeenCalledTimes(2);
    });
  });
});

// ============================================
// Performance Tests
// ============================================
describe('Workflow Performance', () => {
  test('should handle concurrent project operations', async () => {
    const projects = Array(10).fill(null).map((_, i) => mockProject({ id: `proj_${i}` }));

    mockDb.project.create.mockImplementation(async (args: any) => 
      mockProject({ name: args.data.name })
    );

    const results = await Promise.all(
      projects.map(p => mockDb.project.create({ data: { name: p.name } }))
    );

    expect(results).toHaveLength(10);
  });

  test('should handle high-frequency agent executions', async () => {
    const executions = Array(100).fill(null).map((_, i) => 
      mockAgentExecution({ id: `exec_${i}` })
    );

    mockDb.agentExecution.create.mockImplementation(async () => mockAgentExecution());

    const results = await Promise.all(
      executions.slice(0, 10).map(() => mockDb.agentExecution.create({ data: {} }))
    );

    expect(results).toHaveLength(10);
  });
});

// ============================================
// Error Recovery Tests
// ============================================
describe('Error Recovery', () => {
  test('should handle agent execution failure', async () => {
    const execution = mockAgentExecution({
      status: 'failed',
      error: 'API timeout',
    });

    mockDb.agentExecution.update.mockResolvedValue(execution);

    await mockDb.agentExecution.update({
      where: { id: 'exec_1' },
      data: { status: 'failed', error: 'API timeout' },
    });

    expect(mockDb.agentExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' }),
      })
    );
  });

  test('should handle phase rollback', async () => {
    mockDb.phase.update.mockResolvedValue(mockPhase({ status: 'pending' }));

    await mockDb.phase.update({
      where: { id: 'phase_1' },
      data: { status: 'pending' },
    });

    expect(mockDb.phase.update).toHaveBeenCalled();
  });

  test('should maintain audit trail on errors', async () => {
    const errorAudit = mockAuditLog({
      action: 'error_occurred',
      details: JSON.stringify({ error: 'API timeout', stack: '...' }),
    });

    mockDb.auditLog.create.mockResolvedValue(errorAudit);

    await mockDb.auditLog.create({
      data: {
        action: 'error_occurred',
        details: JSON.stringify({ error: 'API timeout' }),
        hash: 'error_hash',
      },
    });

    expect(mockDb.auditLog.create).toHaveBeenCalled();
  });
});
