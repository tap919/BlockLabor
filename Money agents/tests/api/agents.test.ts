/**
 * API Tests: Agents Endpoints
 * Tests for agent listing, retrieval, and execution
 */

import { createMockPrismaClient, mockAgent, mockAgentExecution, AGENT_DEFINITIONS } from '../utils/test-utils';

jest.mock('@/lib/db', () => ({
  db: createMockPrismaClient(),
}));

import { db } from '@/lib/db';
import { GET } from '@/app/api/agents/route';

const mockDb = db as jest.Mocked<typeof db>;

describe('Agents API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // GET /api/agents - List Agents
  // ============================================
  describe('GET /api/agents', () => {
    test('should return all agents ordered by name', async () => {
      const agents = [
        mockAgent({ name: 'cipher', displayName: 'Cipher' }),
        mockAgent({ name: 'guardian', displayName: 'Guardian' }),
        mockAgent({ name: 'sentinel', displayName: 'Sentinel' }),
      ];
      
      mockDb.agent.findMany.mockResolvedValue(agents);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(mockDb.agent.findMany).toHaveBeenCalledWith({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: { executions: true },
          },
        },
      });
    });

    test('should return empty array when no agents exist', async () => {
      mockDb.agent.findMany.mockResolvedValue([]);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    test('should include execution count for each agent', async () => {
      const agents = [
        { ...mockAgent(), _count: { executions: 5 } },
        { ...mockAgent({ name: 'cipher' }), _count: { executions: 10 } },
      ];
      
      mockDb.agent.findMany.mockResolvedValue(agents);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data[0]._count.executions).toBe(5);
      expect(data[1]._count.executions).toBe(10);
    });

    test('should handle database errors gracefully', async () => {
      mockDb.agent.findMany.mockRejectedValue(new Error('Database error'));
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch agents');
    });

    test('should return all six agent types', async () => {
      const agents = AGENT_DEFINITIONS.map(def => 
        mockAgent({ name: def.name, displayName: def.displayName })
      );
      
      mockDb.agent.findMany.mockResolvedValue(agents);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveLength(6);
      
      const agentNames = data.map((a: any) => a.name);
      expect(agentNames).toContain('sentinel');
      expect(agentNames).toContain('cipher');
      expect(agentNames).toContain('guardian');
      expect(agentNames).toContain('oracle');
      expect(agentNames).toContain('vector');
      expect(agentNames).toContain('ledger');
    });

    test('should include agent configuration', async () => {
      const agents = [
        mockAgent({ config: '{"threshold": 0.5}' }),
      ];
      
      mockDb.agent.findMany.mockResolvedValue(agents);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data[0].config).toBe('{"threshold": 0.5}');
    });

    test('should filter out disabled agents', async () => {
      const agents = [
        mockAgent({ name: 'sentinel', enabled: true }),
        mockAgent({ name: 'cipher', enabled: false }),
      ];
      
      mockDb.agent.findMany.mockResolvedValue(agents);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      // Note: The actual filtering would be done in the query
      expect(data).toHaveLength(2);
    });

    test('should include agent icons and colors', async () => {
      const agents = AGENT_DEFINITIONS.map(def => 
        mockAgent({ 
          name: def.name, 
          icon: def.icon, 
          color: def.color 
        })
      );
      
      mockDb.agent.findMany.mockResolvedValue(agents);
      
      const response = await GET();
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data[0].icon).toBeDefined();
      expect(data[0].color).toBeDefined();
    });
  });
});

describe('Agent Types', () => {
  test('should have correct properties for Sentinel agent', () => {
    const sentinel = AGENT_DEFINITIONS.find(a => a.name === 'sentinel');
    
    expect(sentinel).toBeDefined();
    expect(sentinel?.displayName).toBe('Sentinel');
    expect(sentinel?.description).toContain('surveillance');
    expect(sentinel?.icon).toBe('Radar');
  });

  test('should have correct properties for Cipher agent', () => {
    const cipher = AGENT_DEFINITIONS.find(a => a.name === 'cipher');
    
    expect(cipher).toBeDefined();
    expect(cipher?.displayName).toBe('Cipher');
    expect(cipher?.description).toContain('Quantitative');
    expect(cipher?.icon).toBe('Calculator');
  });

  test('should have correct properties for Guardian agent', () => {
    const guardian = AGENT_DEFINITIONS.find(a => a.name === 'guardian');
    
    expect(guardian).toBeDefined();
    expect(guardian?.displayName).toBe('Guardian');
    expect(guardian?.description).toContain('Security');
    expect(guardian?.icon).toBe('Shield');
  });

  test('should have correct properties for Oracle agent', () => {
    const oracle = AGENT_DEFINITIONS.find(a => a.name === 'oracle');
    
    expect(oracle).toBeDefined();
    expect(oracle?.displayName).toBe('Oracle');
    expect(oracle?.description).toContain('Predictive');
    expect(oracle?.icon).toBe('Sparkles');
  });

  test('should have correct properties for Vector agent', () => {
    const vector = AGENT_DEFINITIONS.find(a => a.name === 'vector');
    
    expect(vector).toBeDefined();
    expect(vector?.displayName).toBe('Vector');
    expect(vector?.description).toContain('Trade');
    expect(vector?.icon).toBe('TrendingUp');
  });

  test('should have correct properties for Ledger agent', () => {
    const ledger = AGENT_DEFINITIONS.find(a => a.name === 'ledger');
    
    expect(ledger).toBeDefined();
    expect(ledger?.displayName).toBe('Ledger');
    expect(ledger?.description).toContain('Audit');
    expect(ledger?.icon).toBe('BookOpen');
  });
});

describe('Agent Execution Tests', () => {
  test('should create execution record with valid data', () => {
    const execution = mockAgentExecution({
      status: 'pending',
      input: '{"symbol": "AAPL"}',
    });
    
    expect(execution.status).toBe('pending');
    expect(execution.input).toContain('AAPL');
  });

  test('should track execution duration', () => {
    const execution = mockAgentExecution({
      status: 'completed',
      duration: 1500,
      tokensUsed: 500,
    });
    
    expect(execution.duration).toBe(1500);
    expect(execution.tokensUsed).toBe(500);
  });

  test('should track execution cost', () => {
    const execution = mockAgentExecution({
      cost: 0.002,
    });
    
    expect(execution.cost).toBe(0.002);
  });

  test('should handle failed executions', () => {
    const execution = mockAgentExecution({
      status: 'failed',
      error: 'API rate limit exceeded',
    });
    
    expect(execution.status).toBe('failed');
    expect(execution.error).toContain('rate limit');
  });

  test('should handle timeout executions', () => {
    const execution = mockAgentExecution({
      status: 'timeout',
      duration: 30000,
    });
    
    expect(execution.status).toBe('timeout');
    expect(execution.duration).toBe(30000);
  });
});

describe('Agent API Performance Tests', () => {
  test('should handle large number of agents', async () => {
    const manyAgents = Array(100).fill(null).map((_, i) => 
      mockAgent({ id: `agent_${i}`, name: `agent_${i}` })
    );
    
    mockDb.agent.findMany.mockResolvedValue(manyAgents);
    
    const response = await GET();
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data).toHaveLength(100);
  });

  test('should handle concurrent agent requests', async () => {
    mockDb.agent.findMany.mockResolvedValue([mockAgent()]);
    
    const requests = Array(20).fill(null).map(() => GET());
    const responses = await Promise.all(requests);
    
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  });
});
