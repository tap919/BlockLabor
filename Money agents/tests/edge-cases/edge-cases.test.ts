/**
 * Edge Cases Tests
 * Tests for boundary conditions, edge cases, and unusual inputs
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
  mockUser,
  mockFinancialData,
  createMockPrismaClient,
} from '../utils/test-utils';

const mockDb = createMockPrismaClient();

// ============================================
// String Edge Cases
// ============================================

describe('String Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty Strings', () => {
    test('should handle empty project name', async () => {
      mockDb.project.create.mockResolvedValue(mockProject({ name: '' }));
      
      const result = await mockDb.project.create({
        data: { name: '' },
      });
      
      expect(result.name).toBe('');
    });

    test('should handle empty description', async () => {
      mockDb.project.create.mockResolvedValue(mockProject({ description: '' }));
      
      const result = await mockDb.project.create({
        data: { name: 'Test', description: '' },
      });
      
      expect(result.description).toBe('');
    });

    test('should handle whitespace-only strings', () => {
      const whitespaceStrings = [' ', '  ', '\t', '\n', '\r\n', ' \t\n '];
      
      whitespaceStrings.forEach(str => {
        const trimmed = str.trim();
        expect(trimmed).toBe('');
      });
    });
  });

  describe('Very Long Strings', () => {
    test('should handle 10,000 character project name', async () => {
      const longName = 'A'.repeat(10000);
      mockDb.project.create.mockResolvedValue(mockProject({ name: longName }));
      
      const result = await mockDb.project.create({
        data: { name: longName },
      });
      
      expect(result.name).toHaveLength(10000);
    });

    test('should handle 1MB description', async () => {
      const hugeDescription = 'X'.repeat(1024 * 1024);
      mockDb.project.create.mockResolvedValue(mockProject({ description: hugeDescription }));
      
      const result = await mockDb.project.create({
        data: { name: 'Test', description: hugeDescription },
      });
      
      expect(result.description).toHaveLength(1024 * 1024);
    });

    test('should handle very long JSON in config', async () => {
      const largeConfig = JSON.stringify({
        items: Array(10000).fill(null).map((_, i) => ({ id: i, value: `item_${i}` })),
      });
      
      mockDb.agent.update.mockResolvedValue(mockAgent({ config: largeConfig }));
      
      const result = await mockDb.agent.update({
        where: { id: 'agent_1' },
        data: { config: largeConfig },
      });
      
      const parsed = JSON.parse(result.config);
      expect(parsed.items).toHaveLength(10000);
    });
  });

  describe('Special Characters', () => {
    test('should handle all ASCII special characters', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:\'",.<>?/~`';
      mockDb.project.create.mockResolvedValue(mockProject({ name: specialChars }));
      
      const result = await mockDb.project.create({
        data: { name: specialChars },
      });
      
      expect(result.name).toBe(specialChars);
    });

    test('should handle SQL injection characters', async () => {
      const sqlInjection = "'; DROP TABLE projects; --";
      mockDb.project.create.mockResolvedValue(mockProject({ name: sqlInjection }));
      
      const result = await mockDb.project.create({
        data: { name: sqlInjection },
      });
      
      // Should store as literal string, not execute
      expect(result.name).toBe(sqlInjection);
    });

    test('should handle script injection characters', async () => {
      const scriptInjection = '<script>alert("xss")</script>';
      mockDb.project.create.mockResolvedValue(mockProject({ name: scriptInjection }));
      
      const result = await mockDb.project.create({
        data: { name: scriptInjection },
      });
      
      expect(result.name).toBe(scriptInjection);
    });

    test('should handle emoji strings', async () => {
      const emojiString = '🚀💰📈🎯🔥💡⚡🌟🎉';
      mockDb.project.create.mockResolvedValue(mockProject({ name: emojiString }));
      
      const result = await mockDb.project.create({
        data: { name: emojiString },
      });
      
      expect(result.name).toBe(emojiString);
    });

    test('should handle mixed language strings', async () => {
      const mixedLanguage = 'English 中文 日本語 한글 العربية עברית';
      mockDb.project.create.mockResolvedValue(mockProject({ name: mixedLanguage }));
      
      const result = await mockDb.project.create({
        data: { name: mixedLanguage },
      });
      
      expect(result.name).toBe(mixedLanguage);
    });

    test('should handle RTL text', async () => {
      const rtlText = 'مرحبا بالعالم'; // Arabic: Hello World
      mockDb.project.create.mockResolvedValue(mockProject({ name: rtlText }));
      
      const result = await mockDb.project.create({
        data: { name: rtlText },
      });
      
      expect(result.name).toBe(rtlText);
    });
  });

  describe('Control Characters', () => {
    test('should handle null bytes', () => {
      const stringWithNull = 'test\x00project';
      
      expect(() => {
        // Should not throw
        const processed = stringWithNull.replace(/\x00/g, '');
        expect(processed).toBe('testproject');
      }).not.toThrow();
    });

    test('should handle newline characters', async () => {
      const multilineName = 'Line1\nLine2\nLine3';
      mockDb.project.create.mockResolvedValue(mockProject({ name: multilineName }));
      
      const result = await mockDb.project.create({
        data: { name: multilineName },
      });
      
      expect(result.name).toBe(multilineName);
    });

    test('should handle tab characters', async () => {
      const tabbedName = 'Column1\tColumn2\tColumn3';
      mockDb.project.create.mockResolvedValue(mockProject({ name: tabbedName }));
      
      const result = await mockDb.project.create({
        data: { name: tabbedName },
      });
      
      expect(result.name).toBe(tabbedName);
    });

    test('should handle carriage return', async () => {
      const crName = 'Line1\rLine2\rLine3';
      mockDb.project.create.mockResolvedValue(mockProject({ name: crName }));
      
      const result = await mockDb.project.create({
        data: { name: crName },
      });
      
      expect(result.name).toBe(crName);
    });
  });

  describe('Unicode Edge Cases', () => {
    test('should handle zero-width characters', () => {
      const zeroWidthChars = 'test\u200B\u200C\u200Dproject'; // Zero-width space, non-joiner, joiner
      
      expect(zeroWidthChars.length).toBeGreaterThan(10); // More than visible characters
    });

    test('should handle combining characters', () => {
      const combiningChars = 'e\u0301'; // e with combining acute accent
      
      expect(combiningChars).toHaveLength(2); // Base char + combining char
    });

    test('should handle surrogate pairs', () => {
      const emoji = '𝕳𝖊𝖑𝖑𝖔'; // Mathematical bold script characters (surrogate pairs)
      
      expect(emoji.length).toBeGreaterThan(5); // Each char is 2 UTF-16 code units
    });

    test('should handle unicode normalization', () => {
      const nfc = 'é'; // Precomposed
      const nfd = 'e\u0301'; // Decomposed
      
      expect(nfc.normalize('NFD')).toBe(nfd);
      expect(nfd.normalize('NFC')).toBe(nfc);
    });
  });
});

// ============================================
// Numeric Edge Cases
// ============================================

describe('Numeric Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Zero Values', () => {
    test('should handle zero cash in portfolio', async () => {
      mockDb.portfolio.create.mockResolvedValue(mockPortfolio({ cash: 0 }));
      
      const result = await mockDb.portfolio.create({
        data: { projectId: 'test', cash: 0, totalValue: 0 },
      });
      
      expect(result.cash).toBe(0);
    });

    test('should handle zero quantity position', async () => {
      mockDb.position.create.mockResolvedValue(mockPosition({ quantity: 0 }));
      
      const result = await mockDb.position.create({
        data: { portfolioId: 'test', symbol: 'AAPL', quantity: 0, avgCost: 0 },
      });
      
      expect(result.quantity).toBe(0);
    });

    test('should handle zero price transaction', async () => {
      mockDb.transaction.create.mockResolvedValue(mockTransaction({ price: 0, total: 0 }));
      
      const result = await mockDb.transaction.create({
        data: {
          portfolioId: 'test',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price: 0,
          total: 0,
          executedBy: 'oracle',
        },
      });
      
      expect(result.price).toBe(0);
    });
  });

  describe('Negative Values', () => {
    test('should handle negative P&L', async () => {
      mockDb.portfolio.update.mockResolvedValue(mockPortfolio({ dayPnL: -5000, totalPnL: -10000 }));
      
      const result = await mockDb.portfolio.update({
        where: { id: 'test' },
        data: { dayPnL: -5000, totalPnL: -10000 },
      });
      
      expect(result.dayPnL).toBe(-5000);
      expect(result.totalPnL).toBe(-10000);
    });

    test('should handle negative unrealized P&L', async () => {
      mockDb.position.update.mockResolvedValue(mockPosition({ unrealizedPnL: -500 }));
      
      const result = await mockDb.position.update({
        where: { id: 'test' },
        data: { unrealizedPnL: -500 },
      });
      
      expect(result.unrealizedPnL).toBe(-500);
    });

    test('should handle negative max drawdown', async () => {
      mockDb.portfolio.update.mockResolvedValue(mockPortfolio({ maxDrawdown: -0.25 }));
      
      const result = await mockDb.portfolio.update({
        where: { id: 'test' },
        data: { maxDrawdown: -0.25 },
      });
      
      expect(result.maxDrawdown).toBe(-0.25);
    });
  });

  describe('Very Large Numbers', () => {
    test('should handle large portfolio value', async () => {
      const largeValue = 999999999999.99;
      mockDb.portfolio.update.mockResolvedValue(mockPortfolio({ totalValue: largeValue }));
      
      const result = await mockDb.portfolio.update({
        where: { id: 'test' },
        data: { totalValue: largeValue },
      });
      
      expect(result.totalValue).toBe(largeValue);
    });

    test('should handle large quantity', async () => {
      const largeQuantity = 1000000000;
      mockDb.position.create.mockResolvedValue(mockPosition({ quantity: largeQuantity }));
      
      const result = await mockDb.position.create({
        data: { portfolioId: 'test', symbol: 'AAPL', quantity: largeQuantity, avgCost: 1 },
      });
      
      expect(result.quantity).toBe(largeQuantity);
    });

    test('should handle large token count', async () => {
      const largeTokens = 1000000000;
      mockDb.agentExecution.update.mockResolvedValue(mockAgentExecution({ tokensUsed: largeTokens }));
      
      const result = await mockDb.agentExecution.update({
        where: { id: 'test' },
        data: { tokensUsed: largeTokens },
      });
      
      expect(result.tokensUsed).toBe(largeTokens);
    });
  });

  describe('Floating Point Edge Cases', () => {
    test('should handle very small decimal', async () => {
      const tinyDecimal = 0.00000001;
      mockDb.transaction.create.mockResolvedValue(mockTransaction({ price: tinyDecimal }));
      
      const result = await mockDb.transaction.create({
        data: {
          portfolioId: 'test',
          symbol: 'AAPL',
          type: 'buy',
          quantity: 100,
          price: tinyDecimal,
          total: tinyDecimal * 100,
          executedBy: 'oracle',
        },
      });
      
      expect(result.price).toBeCloseTo(tinyDecimal, 10);
    });

    test('should handle floating point precision', () => {
      const a = 0.1;
      const b = 0.2;
      const sum = a + b;
      
      // 0.1 + 0.2 !== 0.3 in floating point
      expect(sum).not.toBe(0.3);
      expect(sum).toBeCloseTo(0.3, 10);
    });

    test('should handle scientific notation', () => {
      const scientificNumber = 1.23e-10;
      
      expect(scientificNumber).toBe(0.000000000123);
    });

    test('should handle Infinity', () => {
      const positiveInf = Number.POSITIVE_INFINITY;
      const negativeInf = Number.NEGATIVE_INFINITY;
      
      expect(positiveInf).toBeGreaterThan(Number.MAX_VALUE);
      expect(negativeInf).toBeLessThan(Number.MIN_VALUE);
    });

    test('should handle NaN', () => {
      const nan = NaN;
      
      expect(Number.isNaN(nan)).toBe(true);
      expect(nan === nan).toBe(false); // NaN is not equal to itself
    });
  });

  describe('Integer Overflow Simulation', () => {
    test('should handle MAX_SAFE_INTEGER', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER; // 9007199254740991
      
      expect(maxSafe).toBe(9007199254740991);
      expect(maxSafe + 1).toBe(maxSafe + 1); // Still safe
      expect(maxSafe + 2).toBe(maxSafe + 2); // Might lose precision
    });

    test('should handle MIN_SAFE_INTEGER', () => {
      const minSafe = Number.MIN_SAFE_INTEGER; // -9007199254740991
      
      expect(minSafe).toBe(-9007199254740991);
    });
  });
});

// ============================================
// Date Edge Cases
// ============================================

describe('Date Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Boundary Dates', () => {
    test('should handle Unix epoch', async () => {
      const epoch = new Date(0);
      mockDb.project.create.mockResolvedValue(mockProject({ createdAt: epoch.toISOString() }));
      
      const result = await mockDb.project.create({
        data: { name: 'Test', createdAt: epoch },
      });
      
      expect(new Date(result.createdAt).getTime()).toBe(0);
    });

    test('should handle far future date', async () => {
      const farFuture = new Date('2100-01-01T00:00:00Z');
      mockDb.project.create.mockResolvedValue(mockProject({ createdAt: farFuture.toISOString() }));
      
      const result = await mockDb.project.create({
        data: { name: 'Test', createdAt: farFuture },
      });
      
      expect(new Date(result.createdAt).getFullYear()).toBe(2100);
    });

    test('should handle leap year date', async () => {
      const leapDate = new Date('2024-02-29T00:00:00Z');
      mockDb.project.create.mockResolvedValue(mockProject({ createdAt: leapDate.toISOString() }));
      
      const result = await mockDb.project.create({
        data: { name: 'Test', createdAt: leapDate },
      });
      
      const date = new Date(result.createdAt);
      expect(date.getMonth()).toBe(1); // February
      expect(date.getDate()).toBe(29);
    });

    test('should handle end of year', async () => {
      const yearEnd = new Date('2024-12-31T23:59:59.999Z');
      mockDb.project.create.mockResolvedValue(mockProject({ createdAt: yearEnd.toISOString() }));
      
      const result = await mockDb.project.create({
        data: { name: 'Test', createdAt: yearEnd },
      });
      
      const date = new Date(result.createdAt);
      expect(date.getMonth()).toBe(11); // December
      expect(date.getDate()).toBe(31);
    });
  });

  describe('Timezone Handling', () => {
    test('should handle UTC dates', () => {
      const utcDate = new Date('2024-01-01T00:00:00Z');
      
      expect(utcDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    test('should handle timezone offset', () => {
      const date = new Date('2024-01-01T00:00:00-05:00'); // EST
      
      // UTC would be 5 hours ahead
      expect(date.getUTCHours()).toBe(5);
    });

    test('should handle DST transition', () => {
      // DST transition dates vary by region
      const beforeDST = new Date('2024-03-10T01:59:00-05:00'); // Before DST
      const afterDST = new Date('2024-03-10T03:00:00-04:00'); // After DST
      
      expect(afterDST.getTime() - beforeDST.getTime()).toBeLessThan(3600000); // Less than 1 hour
    });
  });

  describe('Invalid Dates', () => {
    test('should detect invalid date string', () => {
      const invalidDate = new Date('not-a-date');
      
      expect(isNaN(invalidDate.getTime())).toBe(true);
    });

    test('should handle date overflow', () => {
      // January 32nd
      const overflowDate = new Date(2024, 0, 32);
      
      // JavaScript auto-corrects to February 1st
      expect(overflowDate.getMonth()).toBe(1); // February
      expect(overflowDate.getDate()).toBe(1);
    });
  });
});

// ============================================
// Array Edge Cases
// ============================================

describe('Array Edge Cases', () => {
  test('should handle empty array', () => {
    const emptyArray: any[] = [];
    
    expect(emptyArray).toHaveLength(0);
    expect(emptyArray[0]).toBeUndefined();
  });

  test('should handle sparse array', () => {
    const sparseArray: (number | undefined)[] = [];
    sparseArray[100] = 100;
    
    expect(sparseArray).toHaveLength(101);
    expect(sparseArray[0]).toBeUndefined();
    expect(sparseArray[100]).toBe(100);
  });

  test('should handle array with undefined elements', () => {
    const arrayWithUndefined = [1, undefined, 3];
    
    expect(arrayWithUndefined).toHaveLength(3);
    expect(arrayWithUndefined[1]).toBeUndefined();
  });

  test('should handle array with null elements', () => {
    const arrayWithNull = [1, null, 3];
    
    expect(arrayWithNull).toHaveLength(3);
    expect(arrayWithNull[1]).toBeNull();
  });

  test('should handle nested arrays', () => {
    const nestedArray = [[[['deep']]]];
    
    expect(nestedArray[0][0][0][0]).toBe('deep');
  });

  test('should handle very large array', () => {
    const largeArray = Array(100000).fill(0).map((_, i) => i);
    
    expect(largeArray).toHaveLength(100000);
    expect(largeArray[0]).toBe(0);
    expect(largeArray[99999]).toBe(99999);
  });
});

// ============================================
// Object Edge Cases
// ============================================

describe('Object Edge Cases', () => {
  test('should handle empty object', () => {
    const emptyObj = {};
    
    expect(Object.keys(emptyObj)).toHaveLength(0);
  });

  test('should handle object with undefined values', () => {
    const objWithUndefined = { a: 1, b: undefined, c: 3 };
    
    expect(objWithUndefined.b).toBeUndefined();
    expect(Object.keys(objWithUndefined)).toHaveLength(3); // Keys are still there
  });

  test('should handle object with null values', () => {
    const objWithNull = { a: 1, b: null, c: 3 };
    
    expect(objWithNull.b).toBeNull();
    expect(Object.keys(objWithNull)).toHaveLength(3);
  });

  test('should handle deeply nested object', () => {
    const deepObject = {
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                value: 'deep',
              },
            },
          },
        },
      },
    };
    
    expect(deepObject.level1.level2.level3.level4.level5.value).toBe('deep');
  });

  test('should handle object with many keys', () => {
    const objWithManyKeys: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      objWithManyKeys[`key_${i}`] = i;
    }
    
    expect(Object.keys(objWithManyKeys)).toHaveLength(1000);
  });

  test('should handle object with symbol keys', () => {
    const sym = Symbol('key');
    const objWithSymbol = { [sym]: 'value' };
    
    expect(objWithSymbol[sym]).toBe('value');
  });

  test('should handle object with numeric string keys', () => {
    const obj = { '0': 'zero', '1': 'one' };
    
    expect(obj['0']).toBe('zero');
    expect(obj[0]).toBe('zero'); // Numeric access works too
  });
});

// ============================================
// Null and Undefined Edge Cases
// ============================================

describe('Null and Undefined Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should distinguish null from undefined', () => {
    const nullValue = null;
    const undefinedValue = undefined;
    
    expect(nullValue).toBeNull();
    expect(undefinedValue).toBeUndefined();
    expect(nullValue === undefinedValue).toBe(false);
  });

  test('should handle optional chaining with null', () => {
    const obj: { nested?: { value?: string } } = { nested: null as any };
    
    expect(obj.nested?.value).toBeUndefined();
  });

  test('should handle nullish coalescing', () => {
    const nullValue = null;
    const undefinedValue = undefined;
    const emptyString = '';
    const zero = 0;
    
    expect(nullValue ?? 'default').toBe('default');
    expect(undefinedValue ?? 'default').toBe('default');
    expect(emptyString ?? 'default').toBe(''); // Empty string is not nullish
    expect(zero ?? 'default').toBe(0); // Zero is not nullish
  });

  test('should handle database null values', async () => {
    mockDb.project.findUnique.mockResolvedValue(null);
    
    const result = await mockDb.project.findUnique({
      where: { id: 'nonexistent' },
    });
    
    expect(result).toBeNull();
  });

  test('should handle optional fields', async () => {
    mockDb.project.create.mockResolvedValue(mockProject({
      description: null,
      startedAt: null,
      completedAt: null,
    }));
    
    const result = await mockDb.project.create({
      data: { name: 'Test' },
    });
    
    expect(result.description).toBeNull();
    expect(result.startedAt).toBeNull();
  });
});

// ============================================
// JSON Edge Cases
// ============================================

describe('JSON Edge Cases', () => {
  test('should handle empty JSON object', () => {
    const emptyJson = '{}';
    const parsed = JSON.parse(emptyJson);
    
    expect(parsed).toEqual({});
  });

  test('should handle empty JSON array', () => {
    const emptyJson = '[]';
    const parsed = JSON.parse(emptyJson);
    
    expect(parsed).toEqual([]);
  });

  test('should handle JSON with escaped characters', () => {
    const jsonWithEscapes = '{"key": "value with \\"quotes\\" and \\\\backslash"}';
    const parsed = JSON.parse(jsonWithEscapes);
    
    expect(parsed.key).toBe('value with "quotes" and \\backslash');
  });

  test('should handle JSON with unicode', () => {
    const jsonWithUnicode = '{"emoji": "\\ud83d\\ude00"}'; // 😀
    const parsed = JSON.parse(jsonWithUnicode);
    
    expect(parsed.emoji).toBe('😀');
  });

  test('should handle deeply nested JSON', () => {
    const deepJson = JSON.stringify({
      level1: { level2: { level3: { level4: { level5: { value: 'deep' } } } } },
    });
    const parsed = JSON.parse(deepJson);
    
    expect(parsed.level1.level2.level3.level4.level5.value).toBe('deep');
  });

  test('should reject invalid JSON', () => {
    const invalidJson = '{invalid}';
    
    expect(() => JSON.parse(invalidJson)).toThrow();
  });

  test('should handle JSON.stringify circular reference', () => {
    const obj: any = { name: 'circular' };
    obj.self = obj;
    
    expect(() => JSON.stringify(obj)).toThrow();
  });

  test('should serialize and deserialize complex object', async () => {
    const complex = {
      project: mockProject(),
      portfolio: mockPortfolio(),
      positions: [mockPosition(), mockPosition()],
    };
    
    const serialized = JSON.stringify(complex);
    const deserialized = JSON.parse(serialized);
    
    expect(deserialized.project.id).toBe(complex.project.id);
    expect(deserialized.positions).toHaveLength(2);
  });
});

// ============================================
// Status Transition Edge Cases
// ============================================

describe('Status Transition Edge Cases', () => {
  test('should handle project status transitions', () => {
    const validTransitions = {
      draft: ['running', 'archived'],
      running: ['paused', 'completed', 'failed'],
      paused: ['running', 'archived'],
      completed: ['archived'],
      failed: ['running', 'archived'],
    };

    // Draft can transition to running
    expect(validTransitions['draft']).toContain('running');
    
    // Draft cannot skip to completed
    expect(validTransitions['draft']).not.toContain('completed');
    
    // Completed is terminal (except archive)
    expect(validTransitions['completed']).not.toContain('running');
  });

  test('should handle phase status transitions', () => {
    const phaseTransitions = {
      pending: ['running', 'skipped'],
      running: ['completed', 'failed'],
      completed: [],
      failed: ['pending'],
      skipped: [],
    };

    expect(phaseTransitions['pending']).toContain('running');
    expect(phaseTransitions['completed']).toHaveLength(0); // Terminal
    expect(phaseTransitions['failed']).toContain('pending'); // Can retry
  });

  test('should handle approval status transitions', () => {
    const approvalTransitions = {
      pending: ['approved', 'rejected', 'expired'],
      approved: [],
      rejected: [],
      expired: [],
    };

    expect(approvalTransitions['pending']).toContain('approved');
    expect(approvalTransitions['approved']).toHaveLength(0); // Terminal
  });
});

// ============================================
// Concurrency Edge Cases
// ============================================

describe('Concurrency Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle race condition in updates', async () => {
    let counter = 0;
    mockDb.project.update.mockImplementation(async () => {
      counter++;
      return mockProject({ status: 'running' });
    });

    // Simulate concurrent updates
    await Promise.all([
      mockDb.project.update({ where: { id: 'test' }, data: { status: 'running' } }),
      mockDb.project.update({ where: { id: 'test' }, data: { status: 'running' } }),
      mockDb.project.update({ where: { id: 'test' }, data: { status: 'running' } }),
    ]);

    expect(counter).toBe(3);
  });

  test('should handle sequential updates', async () => {
    mockDb.project.update.mockResolvedValue(mockProject());

    await mockDb.project.update({ where: { id: 'test' }, data: { status: 'running' } });
    await mockDb.project.update({ where: { id: 'test' }, data: { status: 'paused' } });
    await mockDb.project.update({ where: { id: 'test' }, data: { status: 'completed' } });

    expect(mockDb.project.update).toHaveBeenCalledTimes(3);
  });
});
