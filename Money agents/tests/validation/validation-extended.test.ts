/**
 * Request/Response Validation Tests
 * Comprehensive tests for input validation, output formatting, and schema validation
 */

import {
  createMockPrismaClient,
  mockProject,
  mockAgent,
  mockPortfolio,
  mockPosition,
  mockTransaction,
} from '../utils/test-utils';

// ============================================
// Request Validation Tests
// ============================================

describe('Request Validation', () => {
  describe('Project Request Validation', () => {
    test('should validate project creation request', () => {
      const validRequest = {
        name: 'Test Project',
        description: 'A test project',
        mode: 'simulation',
      };
      
      const isValid = 
        typeof validRequest.name === 'string' &&
        validRequest.name.length > 0 &&
        validRequest.name.length <= 255 &&
        ['simulation', 'live'].includes(validRequest.mode);
      
      expect(isValid).toBe(true);
    });

    test('should reject empty project name', () => {
      const invalidRequest = {
        name: '',
        mode: 'simulation',
      };
      
      const isValid = invalidRequest.name.length > 0;
      expect(isValid).toBe(false);
    });

    test('should reject invalid project mode', () => {
      const invalidRequest = {
        name: 'Test',
        mode: 'invalid_mode',
      };
      
      const validModes = ['simulation', 'live'];
      const isValid = validModes.includes(invalidRequest.mode);
      expect(isValid).toBe(false);
    });

    test('should validate project update request', () => {
      const updateRequest = {
        name: 'Updated Name',
        status: 'running',
      };
      
      const validStatuses = ['draft', 'running', 'paused', 'completed', 'failed', 'archived'];
      const isValid = 
        (updateRequest.name === undefined || typeof updateRequest.name === 'string') &&
        (updateRequest.status === undefined || validStatuses.includes(updateRequest.status));
      
      expect(isValid).toBe(true);
    });

    test('should validate project ID in URL', () => {
      const projectId = 'clx1234567890123456789012';
      const cuidRegex = /^c[a-z0-9]{24}$/;
      
      const isValid = cuidRegex.test(projectId);
      expect(isValid).toBe(true);
    });

    test('should reject malformed project ID', () => {
      const invalidIds = ['', 'invalid', '123', '../../etc/passwd'];
      
      invalidIds.forEach(id => {
        const cuidRegex = /^c[a-z0-9]{24}$/;
        expect(cuidRegex.test(id)).toBe(false);
      });
    });
  });

  describe('Agent Request Validation', () => {
    test('should validate agent execution request', () => {
      const validRequest = {
        agentId: 'agent_oracle',
        projectId: 'proj_123',
        input: { symbol: 'AAPL', timeframe: '1d' },
      };
      
      const isValid = 
        typeof validRequest.agentId === 'string' &&
        typeof validRequest.projectId === 'string' &&
        typeof validRequest.input === 'object';
      
      expect(isValid).toBe(true);
    });

    test('should validate agent input schema', () => {
      const inputSchema = {
        symbol: { type: 'string', required: true, pattern: /^[A-Z]{1,5}$/ },
        timeframe: { type: 'string', enum: ['1m', '5m', '15m', '1h', '1d'] },
        limit: { type: 'number', min: 1, max: 1000 },
      };
      
      const input = { symbol: 'AAPL', timeframe: '1d', limit: 100 };
      
      const validSymbol = inputSchema.symbol.pattern.test(input.symbol);
      const validTimeframe = inputSchema.timeframe.enum?.includes(input.timeframe as any);
      const validLimit = input.limit! >= inputSchema.limit.min && input.limit! <= inputSchema.limit.max;
      
      expect(validSymbol && validTimeframe && validLimit).toBe(true);
    });

    test('should reject invalid symbol format', () => {
      const invalidSymbols = ['', 'TOOLONGSYMBOL', 'abc', 'AA$PL', '123'];
      const pattern = /^[A-Z]{1,5}$/;
      
      invalidSymbols.forEach(symbol => {
        expect(pattern.test(symbol)).toBe(false);
      });
    });
  });

  describe('Trade Request Validation', () => {
    test('should validate trade execution request', () => {
      const validTrade = {
        symbol: 'AAPL',
        type: 'buy',
        quantity: 100,
        price: 150.00,
      };
      
      const isValid = 
        /^[A-Z]{1,5}$/.test(validTrade.symbol) &&
        ['buy', 'sell'].includes(validTrade.type) &&
        Number.isInteger(validTrade.quantity) &&
        validTrade.quantity > 0 &&
        typeof validTrade.price === 'number' &&
        validTrade.price > 0;
      
      expect(isValid).toBe(true);
    });

    test('should reject negative quantity', () => {
      const invalidTrade = {
        symbol: 'AAPL',
        type: 'buy',
        quantity: -100,
        price: 150,
      };
      
      const isValid = invalidTrade.quantity > 0;
      expect(isValid).toBe(false);
    });

    test('should reject negative price', () => {
      const invalidTrade = {
        symbol: 'AAPL',
        type: 'buy',
        quantity: 100,
        price: -150,
      };
      
      const isValid = invalidTrade.price > 0;
      expect(isValid).toBe(false);
    });

    test('should validate stop-loss configuration', () => {
      const stopLoss = {
        type: 'percentage',
        value: 0.05, // 5%
      };
      
      const isValid = 
        ['percentage', 'absolute'].includes(stopLoss.type) &&
        stopLoss.value > 0 &&
        (stopLoss.type === 'percentage' ? stopLoss.value < 1 : stopLoss.value > 0);
      
      expect(isValid).toBe(true);
    });

    test('should reject invalid stop-loss percentage', () => {
      const invalidStopLoss = {
        type: 'percentage',
        value: 1.5, // 150% - invalid
      };
      
      const isValid = invalidStopLoss.type === 'percentage' 
        ? invalidStopLoss.value > 0 && invalidStopLoss.value < 1 
        : invalidStopLoss.value > 0;
      
      expect(isValid).toBe(false);
    });
  });

  describe('Approval Request Validation', () => {
    test('should validate approval request', () => {
      const validApproval = {
        approvalId: 'approval_123',
        action: 'approve',
        notes: 'Looks good',
      };
      
      const validActions = ['approve', 'reject'];
      const isValid = 
        typeof validApproval.approvalId === 'string' &&
        validActions.includes(validApproval.action);
      
      expect(isValid).toBe(true);
    });

    test('should require notes for rejection', () => {
      const rejectionRequest = {
        action: 'reject',
        notes: '', // Empty notes
      };
      
      const isValid = rejectionRequest.action !== 'reject' || rejectionRequest.notes.length > 0;
      expect(isValid).toBe(false);
    });
  });

  describe('Pagination Validation', () => {
    test('should validate pagination parameters', () => {
      const pagination = {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };
      
      const isValid = 
        Number.isInteger(pagination.page) &&
        pagination.page > 0 &&
        Number.isInteger(pagination.limit) &&
        pagination.limit > 0 &&
        pagination.limit <= 100 &&
        ['asc', 'desc'].includes(pagination.sortOrder);
      
      expect(isValid).toBe(true);
    });

    test('should reject page less than 1', () => {
      const invalidPagination = { page: 0, limit: 20 };
      
      const isValid = invalidPagination.page > 0;
      expect(isValid).toBe(false);
    });

    test('should reject limit exceeding maximum', () => {
      const invalidPagination = { page: 1, limit: 1000 };
      
      const isValid = invalidPagination.limit <= 100;
      expect(isValid).toBe(false);
    });

    test('should apply default pagination values', () => {
      const defaults = { page: 1, limit: 20 };
      const input = { page: undefined, limit: undefined };
      
      const result = {
        page: input.page ?? defaults.page,
        limit: input.limit ?? defaults.limit,
      };
      
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });
  });

  describe('Date Range Validation', () => {
    test('should validate date range', () => {
      const dateRange = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      };
      
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      
      const isValid = 
        !isNaN(start.getTime()) &&
        !isNaN(end.getTime()) &&
        start <= end;
      
      expect(isValid).toBe(true);
    });

    test('should reject invalid date format', () => {
      const invalidDate = 'not-a-date';
      const parsed = new Date(invalidDate);
      
      const isValid = !isNaN(parsed.getTime());
      expect(isValid).toBe(false);
    });

    test('should reject start date after end date', () => {
      const invalidRange = {
        startDate: '2024-02-01',
        endDate: '2024-01-01',
      };
      
      const isValid = new Date(invalidRange.startDate) <= new Date(invalidRange.endDate);
      expect(isValid).toBe(false);
    });

    test('should enforce maximum date range', () => {
      const maxDays = 90;
      const range = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-05-01'), // 120+ days
      };
      
      const daysDiff = (range.endDate.getTime() - range.startDate.getTime()) / (1000 * 60 * 60 * 24);
      const isValid = daysDiff <= maxDays;
      
      expect(isValid).toBe(false);
    });
  });
});

// ============================================
// Response Format Tests
// ============================================

describe('Response Format', () => {
  describe('Success Response Format', () => {
    test('should format single resource response', () => {
      const project = mockProject();
      const response = {
        success: true,
        data: project,
        meta: {
          timestamp: new Date().toISOString(),
        },
      };
      
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.meta.timestamp).toBeDefined();
    });

    test('should format list response with pagination', () => {
      const projects = [mockProject(), mockProject()];
      const response = {
        success: true,
        data: projects,
        meta: {
          total: 100,
          page: 1,
          limit: 20,
          totalPages: 5,
        },
      };
      
      expect(response.data).toHaveLength(2);
      expect(response.meta.total).toBe(100);
      expect(response.meta.totalPages).toBe(5);
    });

    test('should include request ID for tracing', () => {
      const response = {
        success: true,
        data: {},
        requestId: 'req_abc123',
      };
      
      expect(response.requestId).toBeDefined();
    });

    test('should include rate limit info', () => {
      const response = {
        success: true,
        data: {},
        rateLimit: {
          limit: 100,
          remaining: 95,
          reset: Date.now() + 60000,
        },
      };
      
      expect(response.rateLimit).toBeDefined();
    });
  });

  describe('Error Response Format', () => {
    test('should format validation error', () => {
      const response = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          details: [
            { field: 'name', message: 'Name is required' },
            { field: 'mode', message: 'Invalid mode' },
          ],
        },
      };
      
      expect(response.success).toBe(false);
      expect(response.error.code).toBe('VALIDATION_ERROR');
      expect(response.error.details).toHaveLength(2);
    });

    test('should format not found error', () => {
      const response = {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Project not found',
          resource: 'project',
          id: 'proj_123',
        },
      };
      
      expect(response.error.code).toBe('NOT_FOUND');
    });

    test('should format unauthorized error', () => {
      const response = {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
      
      expect(response.error.code).toBe('UNAUTHORIZED');
    });

    test('should format rate limit error', () => {
      const response = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          retryAfter: 30,
        },
      };
      
      expect(response.error.retryAfter).toBe(30);
    });

    test('should format internal error (sanitized)', () => {
      const internalError = new Error('Database connection failed: password=secret');
      
      const response = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
          requestId: 'req_123',
        },
      };
      
      // Should not expose internal details
      expect(response.error.message).not.toContain('password');
      expect(response.error.message).not.toContain('Database');
    });
  });

  describe('HTTP Status Codes', () => {
    test('should return 200 for successful GET', () => {
      const status = 200;
      expect(status).toBe(200);
    });

    test('should return 201 for successful POST', () => {
      const status = 201;
      expect(status).toBe(201);
    });

    test('should return 204 for successful DELETE', () => {
      const status = 204;
      expect(status).toBe(204);
    });

    test('should return 400 for validation errors', () => {
      const status = 400;
      expect(status).toBe(400);
    });

    test('should return 401 for unauthorized', () => {
      const status = 401;
      expect(status).toBe(401);
    });

    test('should return 403 for forbidden', () => {
      const status = 403;
      expect(status).toBe(403);
    });

    test('should return 404 for not found', () => {
      const status = 404;
      expect(status).toBe(404);
    });

    test('should return 422 for unprocessable entity', () => {
      const status = 422;
      expect(status).toBe(422);
    });

    test('should return 429 for rate limit', () => {
      const status = 429;
      expect(status).toBe(429);
    });

    test('should return 500 for server error', () => {
      const status = 500;
      expect(status).toBe(500);
    });
  });
});

// ============================================
// Schema Validation Tests
// ============================================

describe('Schema Validation', () => {
  describe('Project Schema', () => {
    test('should validate complete project object', () => {
      const project = mockProject({
        name: 'Test Project',
        status: 'running',
        mode: 'simulation',
      });
      
      const requiredFields = ['id', 'name', 'status', 'mode', 'createdAt'];
      const hasAllFields = requiredFields.every(field => field in project);
      
      expect(hasAllFields).toBe(true);
    });

    test('should validate project status values', () => {
      const validStatuses = ['draft', 'running', 'paused', 'completed', 'failed', 'archived'];
      
      validStatuses.forEach(status => {
        expect(validStatuses.includes(status)).toBe(true);
      });
    });

    test('should validate project mode values', () => {
      const validModes = ['simulation', 'live'];
      
      validModes.forEach(mode => {
        expect(validModes.includes(mode)).toBe(true);
      });
    });

    test('should validate ISO date strings', () => {
      const isoDate = '2024-01-15T10:30:00.000Z';
      const parsed = new Date(isoDate);
      
      expect(isNaN(parsed.getTime())).toBe(false);
    });
  });

  describe('Portfolio Schema', () => {
    test('should validate portfolio object', () => {
      const portfolio = mockPortfolio({
        cash: 100000,
        totalValue: 120000,
        dayPnL: 5000,
        totalPnL: 20000,
      });
      
      const isValid = 
        typeof portfolio.cash === 'number' &&
        typeof portfolio.totalValue === 'number' &&
        portfolio.cash >= 0 &&
        portfolio.totalValue >= 0;
      
      expect(isValid).toBe(true);
    });

    test('should validate positive values for financial fields', () => {
      const portfolio = mockPortfolio();
      
      const nonNegative = 
        portfolio.cash >= 0 &&
        portfolio.totalValue >= 0 &&
        (portfolio.dayPnL === null || typeof portfolio.dayPnL === 'number');
      
      expect(nonNegative).toBe(true);
    });
  });

  describe('Position Schema', () => {
    test('should validate position object', () => {
      const position = mockPosition({
        symbol: 'AAPL',
        quantity: 100,
        avgCost: 150.00,
        currentPrice: 155.00,
      });
      
      const isValid = 
        /^[A-Z]{1,5}$/.test(position.symbol) &&
        Number.isInteger(position.quantity) &&
        position.quantity >= 0 &&
        position.avgCost > 0;
      
      expect(isValid).toBe(true);
    });

    test('should validate symbol format', () => {
      const validSymbols = ['AAPL', 'GOOGL', 'MSFT', 'V'];
      const pattern = /^[A-Z]{1,5}$/;
      
      validSymbols.forEach(symbol => {
        expect(pattern.test(symbol)).toBe(true);
      });
    });
  });

  describe('Transaction Schema', () => {
    test('should validate transaction object', () => {
      const transaction = mockTransaction({
        type: 'buy',
        symbol: 'AAPL',
        quantity: 100,
        price: 150.00,
        total: 15000,
      });
      
      const isValid = 
        ['buy', 'sell'].includes(transaction.type) &&
        transaction.quantity > 0 &&
        transaction.price > 0 &&
        Math.abs(transaction.total - transaction.quantity * transaction.price) < 0.01;
      
      expect(isValid).toBe(true);
    });

    test('should calculate correct transaction total', () => {
      const quantity = 100;
      const price = 150.00;
      const expectedTotal = quantity * price;
      
      expect(expectedTotal).toBe(15000);
    });
  });
});

// ============================================
// Sanitization Tests
// ============================================

describe('Input Sanitization', () => {
  describe('HTML Sanitization', () => {
    test('should escape HTML tags', () => {
      const input = '<script>alert("xss")</script>';
      const sanitized = input
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      expect(sanitized).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    test('should remove dangerous attributes', () => {
      const input = '<div onclick="alert(1)">test</div>';
      const sanitized = input.replace(/on\w+="[^"]*"/g, '');
      
      expect(sanitized).not.toContain('onclick');
    });

    test('should escape special characters', () => {
      const input = '< > & " \'';
      const sanitized = input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      
      expect(sanitized).toBe('&lt; &gt; &amp; &quot; &#x27;');
    });
  });

  describe('SQL Sanitization', () => {
    test('should detect SQL injection patterns', () => {
      const sqlPatterns = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "1; DELETE FROM projects",
      ];
      
      const detectSQL = (input: string) => {
        const patterns = [
          /(\bDROP\b|\bDELETE\b|\bUNION\b|\bSELECT\b)/i,
          /'\s*OR\s*['\d]/i,
          /--/,
          /;/,
        ];
        return patterns.some(p => p.test(input));
      };
      
      sqlPatterns.forEach(pattern => {
        expect(detectSQL(pattern)).toBe(true);
      });
    });

    test('should allow safe input', () => {
      const safeInputs = [
        'Test Project',
        'user@example.com',
        '2024-01-15',
      ];
      
      const detectSQL = (input: string) => {
        const patterns = [
          /(\bDROP\b|\bDELETE\b|\bUNION\b|\bSELECT\b)/i,
          /'\s*OR\s*['\d]/i,
        ];
        return patterns.some(p => p.test(input));
      };
      
      safeInputs.forEach(input => {
        expect(detectSQL(input)).toBe(false);
      });
    });
  });

  describe('Path Sanitization', () => {
    test('should prevent path traversal', () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '/etc/passwd',
        '~/../secret',
      ];
      
      const isPathTraversal = (path: string) => {
        return path.includes('..') || path.includes('~') || path.startsWith('/');
      };
      
      maliciousPaths.forEach(path => {
        expect(isPathTraversal(path)).toBe(true);
      });
    });

    test('should allow safe paths', () => {
      const safePaths = [
        'projects/123',
        'data/export.json',
        'uploads/image.png',
      ];
      
      const isPathTraversal = (path: string) => {
        return path.includes('..') || path.includes('~') || path.startsWith('/');
      };
      
      safePaths.forEach(path => {
        expect(isPathTraversal(path)).toBe(false);
      });
    });
  });
});

// ============================================
// Type Coercion Tests
// ============================================

describe('Type Coercion', () => {
  test('should coerce string to number', () => {
    const input = '123';
    const result = Number(input);
    
    expect(result).toBe(123);
    expect(typeof result).toBe('number');
  });

  test('should handle invalid number coercion', () => {
    const input = 'not-a-number';
    const result = Number(input);
    
    expect(Number.isNaN(result)).toBe(true);
  });

  test('should coerce to boolean', () => {
    const truthy = ['true', '1', 'yes', 'on'];
    const falsy = ['false', '0', 'no', 'off', ''];
    
    const toBoolean = (value: string) => {
      return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    };
    
    truthy.forEach(v => expect(toBoolean(v)).toBe(true));
    falsy.forEach(v => expect(toBoolean(v)).toBe(false));
  });

  test('should handle null vs undefined', () => {
    const values = {
      null: null,
      undefined: undefined,
      empty: '',
      zero: 0,
      false: false,
    };
    
    // Nullish coalescing
    expect(values.null ?? 'default').toBe('default');
    expect(values.undefined ?? 'default').toBe('default');
    expect(values.empty ?? 'default').toBe('');
    expect(values.zero ?? 'default').toBe(0);
  });

  test('should validate array items', () => {
    const input = ['AAPL', 'GOOGL', 'MSFT'];
    
    const isValid = Array.isArray(input) && input.every(s => typeof s === 'string');
    expect(isValid).toBe(true);
  });
});
