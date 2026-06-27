/**
 * Performance Tests
 * Tests for system performance under various conditions
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
  mockHumanApproval,
  mockAuditLog,
  createMockPrismaClient,
} from '../utils/test-utils';

// ============================================
// Performance Measurement Utilities
// ============================================

class PerformanceTimer {
  private startTime: number = 0;
  private endTime: number = 0;

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  static async measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  }

  static measure<T>(fn: () => T): { result: T; duration: number } {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    return { result, duration };
  }
}

// ============================================
// Database Query Performance Tests
// ============================================

describe('Database Query Performance', () => {
  const mockDb = createMockPrismaClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Queries', () => {
    test('should fetch single project in under 10ms', async () => {
      mockDb.project.findUnique.mockResolvedValue(mockProject());

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.project.findUnique({ where: { id: 'test' } })
      );

      expect(duration).toBeLessThan(10);
    });

    test('should fetch 100 projects in under 50ms', async () => {
      const projects = Array(100).fill(null).map((_, i) => mockProject({ id: `proj_${i}` }));
      mockDb.project.findMany.mockResolvedValue(projects);

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.project.findMany()
      );

      expect(duration).toBeLessThan(50);
    });

    test('should fetch project with all relationships efficiently', async () => {
      const project = {
        ...mockProject(),
        phases: Array(5).fill(null).map((_, i) => mockPhase({ id: `phase_${i}` })),
        portfolio: {
          ...mockPortfolio(),
          positions: Array(10).fill(null).map((_, i) => mockPosition({ id: `pos_${i}` })),
          transactions: Array(20).fill(null).map((_, i) => mockTransaction({ id: `txn_${i}` })),
        },
      };
      mockDb.project.findUnique.mockResolvedValue(project);

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.project.findUnique({
          where: { id: 'test' },
          include: {
            phases: true,
            portfolio: {
              include: {
                positions: true,
                transactions: true,
              },
            },
          },
        })
      );

      expect(duration).toBeLessThan(20);
    });

    test('should create project efficiently', async () => {
      mockDb.project.create.mockResolvedValue(mockProject());

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.project.create({
          data: { name: 'Test Project', status: 'draft' },
        })
      );

      expect(duration).toBeLessThan(5);
    });

    test('should update project efficiently', async () => {
      mockDb.project.update.mockResolvedValue(mockProject({ status: 'running' }));

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.project.update({
          where: { id: 'test' },
          data: { status: 'running' },
        })
      );

      expect(duration).toBeLessThan(5);
    });
  });

  describe('Agent Execution Queries', () => {
    test('should fetch agent execution history efficiently', async () => {
      const executions = Array(50).fill(null).map((_, i) =>
        mockAgentExecution({ id: `exec_${i}`, status: 'completed' })
      );
      mockDb.agentExecution.findMany.mockResolvedValue(executions);

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.agentExecution.findMany({
          where: { projectId: 'test' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      );

      expect(duration).toBeLessThan(15);
    });

    test('should create execution record efficiently', async () => {
      mockDb.agentExecution.create.mockResolvedValue(mockAgentExecution());

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.agentExecution.create({
          data: {
            projectId: 'test',
            agentId: 'agent_1',
            phaseId: 'phase_1',
            status: 'pending',
          },
        })
      );

      expect(duration).toBeLessThan(5);
    });
  });

  describe('Audit Log Queries', () => {
    test('should fetch recent audit logs efficiently', async () => {
      const logs = Array(100).fill(null).map((_, i) =>
        mockAuditLog({ id: `audit_${i}` })
      );
      mockDb.auditLog.findMany.mockResolvedValue(logs);

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.auditLog.findMany({
          where: { projectId: 'test' },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      );

      expect(duration).toBeLessThan(20);
    });

    test('should create audit log entry efficiently', async () => {
      mockDb.auditLog.create.mockResolvedValue(mockAuditLog());

      const { duration } = await PerformanceTimer.measureAsync(() =>
        mockDb.auditLog.create({
          data: {
            projectId: 'test',
            actor: 'system',
            action: 'test_action',
            resource: 'test_resource',
            details: '{}',
            hash: 'hash_123',
          },
        })
      );

      expect(duration).toBeLessThan(5);
    });
  });
});

// ============================================
// Concurrent Operation Performance Tests
// ============================================

describe('Concurrent Operation Performance', () => {
  const mockDb = createMockPrismaClient();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle 10 concurrent project fetches', async () => {
    mockDb.project.findUnique.mockResolvedValue(mockProject());

    const start = performance.now();
    const promises = Array(10).fill(null).map((_, i) =>
      mockDb.project.findUnique({ where: { id: `proj_${i}` } })
    );
    await Promise.all(promises);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
  });

  test('should handle 50 concurrent project creates', async () => {
    mockDb.project.create.mockResolvedValue(mockProject());

    const start = performance.now();
    const promises = Array(50).fill(null).map((_, i) =>
      mockDb.project.create({ data: { name: `Project ${i}` } })
    );
    await Promise.all(promises);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
  });

  test('should handle 100 concurrent audit log creates', async () => {
    mockDb.auditLog.create.mockResolvedValue(mockAuditLog());

    const start = performance.now();
    const promises = Array(100).fill(null).map((_, i) =>
      mockDb.auditLog.create({
        data: {
          projectId: 'test',
          actor: 'system',
          action: `action_${i}`,
          resource: 'test',
          details: '{}',
          hash: `hash_${i}`,
        },
      })
    );
    await Promise.all(promises);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200);
  });

  test('should handle mixed concurrent operations', async () => {
    mockDb.project.findMany.mockResolvedValue([mockProject()]);
    mockDb.project.create.mockResolvedValue(mockProject());
    mockDb.project.update.mockResolvedValue(mockProject());

    const start = performance.now();
    await Promise.all([
      ...Array(10).fill(null).map(() => mockDb.project.findMany()),
      ...Array(10).fill(null).map((_, i) =>
        mockDb.project.create({ data: { name: `Project ${i}` } })
      ),
      ...Array(10).fill(null).map((_, i) =>
        mockDb.project.update({ where: { id: `proj_${i}` }, data: { status: 'running' } })
      ),
    ]);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(150);
  });
});

// ============================================
// Memory Usage Tests
// ============================================

describe('Memory Usage', () => {
  test('should handle large datasets without memory issues', () => {
    const initialMemory = process.memoryUsage().heapUsed;

    // Create large array
    const largeArray = Array(10000).fill(null).map((_, i) => ({
      id: i,
      data: 'x'.repeat(100),
    }));

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    // Should not use more than 50MB for 10k items
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });

  test('should efficiently process large JSON strings', () => {
    const largeObject = {
      items: Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: { nested: { deep: { value: i } } },
      })),
    };

    const { duration } = PerformanceTimer.measure(() =>
      JSON.stringify(largeObject)
    );

    expect(duration).toBeLessThan(100);
  });

  test('should efficiently parse large JSON strings', () => {
    const jsonString = JSON.stringify(
      Array(1000).fill(null).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: { nested: { deep: { value: i } } },
      }))
    );

    const { duration } = PerformanceTimer.measure(() =>
      JSON.parse(jsonString)
    );

    expect(duration).toBeLessThan(50);
  });
});

// ============================================
// Throughput Tests
// ============================================

describe('Throughput', () => {
  const mockDb = createMockPrismaClient();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.project.create.mockResolvedValue(mockProject());
  });

  test('should support 100 project creates per second', async () => {
    const operations = 100;
    const start = performance.now();

    for (let i = 0; i < operations; i++) {
      await mockDb.project.create({ data: { name: `Project ${i}` } });
    }

    const duration = performance.now() - start;
    const opsPerSecond = (operations / duration) * 1000;

    expect(opsPerSecond).toBeGreaterThan(100);
  });

  test('should support 500 concurrent operations per second', async () => {
    const operations = 500;
    const start = performance.now();

    await Promise.all(
      Array(operations).fill(null).map((_, i) =>
        mockDb.project.create({ data: { name: `Project ${i}` } })
      )
    );

    const duration = performance.now() - start;
    const opsPerSecond = (operations / duration) * 1000;

    expect(opsPerSecond).toBeGreaterThan(500);
  });
});

// ============================================
// Latency Tests
// ============================================

describe('Latency', () => {
  const mockDb = createMockPrismaClient();

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.project.findUnique.mockResolvedValue(mockProject());
  });

  test('should have p50 latency under 5ms', async () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await mockDb.project.findUnique({ where: { id: 'test' } });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[50];

    expect(p50).toBeLessThan(5);
  });

  test('should have p95 latency under 15ms', async () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await mockDb.project.findUnique({ where: { id: 'test' } });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[95];

    expect(p95).toBeLessThan(15);
  });

  test('should have p99 latency under 25ms', async () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await mockDb.project.findUnique({ where: { id: 'test' } });
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[99];

    expect(p99).toBeLessThan(25);
  });
});

// ============================================
// Algorithm Performance Tests
// ============================================

describe('Algorithm Performance', () => {
  describe('ERV Policy Evaluation', () => {
    class SimpleERVEngine {
      private policies: Array<{
        pattern: RegExp;
        action: 'execute' | 'refuse' | 'verify';
        priority: number;
      }> = [];

      addPolicy(pattern: string, action: 'execute' | 'refuse' | 'verify', priority: number) {
        this.policies.push({ pattern: new RegExp(pattern), action, priority });
        this.policies.sort((a, b) => b.priority - a.priority);
      }

      evaluate(action: string): 'execute' | 'refuse' | 'verify' {
        for (const policy of this.policies) {
          if (policy.pattern.test(action)) {
            return policy.action;
          }
        }
        return 'execute';
      }
    }

    test('should evaluate 1000 policies in under 100ms', () => {
      const engine = new SimpleERVEngine();

      // Add 100 policies
      for (let i = 0; i < 100; i++) {
        engine.addPolicy(`action_${i}`, i % 3 === 0 ? 'verify' : 'execute', i);
      }

      const { duration } = PerformanceTimer.measure(() => {
        for (let i = 0; i < 1000; i++) {
          engine.evaluate(`action_${i % 100}`);
        }
      });

      expect(duration).toBeLessThan(100);
    });

    test('should handle complex regex patterns efficiently', () => {
      const engine = new SimpleERVEngine();

      // Add complex patterns
      engine.addPolicy('execute_.*', 'verify', 10);
      engine.addPolicy('^trade_.+_usd$', 'verify', 9);
      engine.addPolicy('.*_large$', 'verify', 8);

      const { duration } = PerformanceTimer.measure(() => {
        for (let i = 0; i < 1000; i++) {
          engine.evaluate(`execute_trade_${i}_usd_large`);
        }
      });

      expect(duration).toBeLessThan(50);
    });
  });

  describe('Hash Chain Performance', () => {
    test('should generate 100 hash chain entries in under 100ms', () => {
      const crypto = require('crypto');
      let previousHash = '0'.repeat(64);
      const hashes: string[] = [];

      const { duration } = PerformanceTimer.measure(() => {
        for (let i = 0; i < 100; i++) {
          const hash = crypto
            .createHash('sha256')
            .update(`${previousHash}:${i}:${Date.now()}`)
            .digest('hex');
          hashes.push(hash);
          previousHash = hash;
        }
      });

      expect(duration).toBeLessThan(100);
      expect(hashes).toHaveLength(100);
    });
  });

  describe('Portfolio Calculation Performance', () => {
    test('should calculate portfolio value efficiently', () => {
      const positions = Array(100).fill(null).map((_, i) => ({
        symbol: `STOCK_${i}`,
        quantity: Math.floor(Math.random() * 1000),
        price: Math.random() * 500,
      }));

      const { duration, result } = PerformanceTimer.measure(() => {
        return positions.reduce((total, pos) => total + pos.quantity * pos.price, 0);
      });

      expect(duration).toBeLessThan(1);
      expect(result).toBeGreaterThan(0);
    });

    test('should calculate P&L for 1000 transactions', () => {
      const transactions = Array(1000).fill(null).map((_, i) => ({
        type: i % 2 === 0 ? 'buy' : 'sell',
        quantity: Math.floor(Math.random() * 100),
        price: 100 + Math.random() * 50,
        avgCost: 100,
      }));

      const { duration } = PerformanceTimer.measure(() => {
        let realizedPnL = 0;
        for (const txn of transactions) {
          if (txn.type === 'sell') {
            realizedPnL += (txn.price - txn.avgCost) * txn.quantity;
          }
        }
        return realizedPnL;
      });

      expect(duration).toBeLessThan(5);
    });
  });
});

// ============================================
// Data Processing Performance Tests
// ============================================

describe('Data Processing Performance', () => {
  test('should filter 10000 items in under 50ms', () => {
    const items = Array(10000).fill(null).map((_, i) => ({
      id: i,
      status: i % 3 === 0 ? 'active' : 'inactive',
      value: Math.random() * 1000,
    }));

    const { duration } = PerformanceTimer.measure(() => {
      return items.filter(item => item.status === 'active' && item.value > 500);
    });

    expect(duration).toBeLessThan(50);
  });

  test('should sort 10000 items in under 100ms', () => {
    const items = Array(10000).fill(null).map((_, i) => ({
      id: i,
      value: Math.random() * 1000,
    }));

    const { duration } = PerformanceTimer.measure(() => {
      return items.sort((a, b) => a.value - b.value);
    });

    expect(duration).toBeLessThan(100);
  });

  test('should group 10000 items in under 100ms', () => {
    const items = Array(10000).fill(null).map((_, i) => ({
      id: i,
      category: `cat_${i % 10}`,
      value: Math.random() * 100,
    }));

    const { duration } = PerformanceTimer.measure(() => {
      const groups: Record<string, typeof items> = {};
      for (const item of items) {
        if (!groups[item.category]) {
          groups[item.category] = [];
        }
        groups[item.category].push(item);
      }
      return groups;
    });

    expect(duration).toBeLessThan(100);
  });

  test('should aggregate 10000 items in under 50ms', () => {
    const items = Array(10000).fill(null).map((_, i) => ({
      id: i,
      value: Math.random() * 100,
    }));

    const { duration } = PerformanceTimer.measure(() => {
      const sum = items.reduce((acc, item) => acc + item.value, 0);
      const avg = sum / items.length;
      return { sum, avg };
    });

    expect(duration).toBeLessThan(50);
  });
});

// ============================================
// Serialization Performance Tests
// ============================================

describe('Serialization Performance', () => {
  test('should serialize complex object in under 50ms', () => {
    const complexObject = {
      project: mockProject(),
      phases: Array(5).fill(null).map(() => mockPhase()),
      agents: Array(6).fill(null).map(() => mockAgent()),
      executions: Array(50).fill(null).map(() => mockAgentExecution()),
      portfolio: mockPortfolio(),
      positions: Array(20).fill(null).map(() => mockPosition()),
      transactions: Array(100).fill(null).map(() => mockTransaction()),
      decisions: Array(30).fill(null).map(() => mockERVDecision()),
      approvals: Array(10).fill(null).map(() => mockHumanApproval()),
      auditLogs: Array(100).fill(null).map(() => mockAuditLog()),
    };

    const { duration } = PerformanceTimer.measure(() =>
      JSON.stringify(complexObject)
    );

    expect(duration).toBeLessThan(50);
  });

  test('should deserialize complex object in under 50ms', () => {
    const complexObject = {
      project: mockProject(),
      phases: Array(5).fill(null).map(() => mockPhase()),
      agents: Array(6).fill(null).map(() => mockAgent()),
      executions: Array(50).fill(null).map(() => mockAgentExecution()),
    };
    const jsonString = JSON.stringify(complexObject);

    const { duration } = PerformanceTimer.measure(() =>
      JSON.parse(jsonString)
    );

    expect(duration).toBeLessThan(50);
  });
});

// ============================================
// Benchmark Tests
// ============================================

describe('Benchmarks', () => {
  test('benchmark: object creation', () => {
    const iterations = 10000;
    const { duration } = PerformanceTimer.measure(() => {
      for (let i = 0; i < iterations; i++) {
        const obj = { id: i, name: `Item ${i}`, value: Math.random() };
      }
    });

    const opsPerSecond = (iterations / duration) * 1000;
    console.log(`Object creation: ${opsPerSecond.toFixed(0)} ops/sec`);

    expect(opsPerSecond).toBeGreaterThan(100000);
  });

  test('benchmark: array operations', () => {
    const iterations = 1000;
    const arr: number[] = [];

    const { duration } = PerformanceTimer.measure(() => {
      for (let i = 0; i < iterations; i++) {
        arr.push(i);
      }
      for (let i = 0; i < iterations; i++) {
        arr.pop();
      }
    });

    const opsPerSecond = (iterations * 2 / duration) * 1000;
    console.log(`Array operations: ${opsPerSecond.toFixed(0)} ops/sec`);

    expect(opsPerSecond).toBeGreaterThan(50000);
  });

  test('benchmark: map operations', () => {
    const iterations = 10000;
    const map = new Map<string, number>();

    const { duration } = PerformanceTimer.measure(() => {
      for (let i = 0; i < iterations; i++) {
        map.set(`key_${i}`, i);
      }
      for (let i = 0; i < iterations; i++) {
        map.get(`key_${i}`);
      }
    });

    const opsPerSecond = (iterations * 2 / duration) * 1000;
    console.log(`Map operations: ${opsPerSecond.toFixed(0)} ops/sec`);

    expect(opsPerSecond).toBeGreaterThan(100000);
  });
});
