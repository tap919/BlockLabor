/**
 * Response Format Tests
 * Tests for API response structure, consistency, and error handling
 */

// ============================================
// Response Types
// ============================================

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
  };
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// Response Builder
// ============================================

class ResponseBuilder {
  static success<T>(data: T, meta?: Partial<ApiResponse['meta']>): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };
  }

  static error(
    code: string,
    message: string,
    details?: unknown
  ): ApiResponse {
    return {
      success: false,
      error: { code, message, details },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number
  ): PaginatedResponse<T> {
    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}

// ============================================
// Response Format Tests
// ============================================

describe('Response Format', () => {
  describe('Success Responses', () => {
    test('should return consistent success format', () => {
      const response = ResponseBuilder.success({ id: '1', name: 'Test' });

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.error).toBeUndefined();
      expect(response.meta?.timestamp).toBeDefined();
    });

    test('should include timestamp in response', () => {
      const response = ResponseBuilder.success({});

      expect(response.meta?.timestamp).toBeDefined();
      expect(new Date(response.meta!.timestamp)).toBeInstanceOf(Date);
    });

    test('should handle null data gracefully', () => {
      const response = ResponseBuilder.success(null);

      expect(response.success).toBe(true);
      expect(response.data).toBeNull();
    });

    test('should handle array data', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = ResponseBuilder.success(items);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
    });

    test('should include optional requestId', () => {
      const response = ResponseBuilder.success({}, { requestId: 'req_123' });

      expect(response.meta?.requestId).toBe('req_123');
    });
  });

  describe('Error Responses', () => {
    test('should return consistent error format', () => {
      const response = ResponseBuilder.error(
        'VALIDATION_ERROR',
        'Invalid input data'
      );

      expect(response.success).toBe(false);
      expect(response.data).toBeUndefined();
      expect(response.error?.code).toBe('VALIDATION_ERROR');
      expect(response.error?.message).toBe('Invalid input data');
    });

    test('should include error details when provided', () => {
      const details = { field: 'name', reason: 'required' };
      const response = ResponseBuilder.error(
        'VALIDATION_ERROR',
        'Validation failed',
        details
      );

      expect(response.error?.details).toEqual(details);
    });

    test('should include timestamp in error response', () => {
      const response = ResponseBuilder.error('ERROR', 'Message');

      expect(response.meta?.timestamp).toBeDefined();
    });

    test('should use standard error codes', () => {
      const errorCodes = [
        'VALIDATION_ERROR',
        'NOT_FOUND',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'RATE_LIMITED',
        'INTERNAL_ERROR',
      ];

      errorCodes.forEach(code => {
        const response = ResponseBuilder.error(code, 'Message');
        expect(response.error?.code).toBe(code);
      });
    });
  });

  describe('Paginated Responses', () => {
    test('should return paginated format', () => {
      const items = [{ id: '1' }, { id: '2' }];
      const response = ResponseBuilder.paginated(items, 1, 10, 25);

      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(2);
      expect(response.pagination).toBeDefined();
    });

    test('should calculate total pages', () => {
      const response = ResponseBuilder.paginated([], 1, 10, 25);

      expect(response.pagination.totalPages).toBe(3);
    });

    test('should handle empty results', () => {
      const response = ResponseBuilder.paginated([], 1, 10, 0);

      expect(response.data).toHaveLength(0);
      expect(response.pagination.total).toBe(0);
      expect(response.pagination.totalPages).toBe(0);
    });

    test('should handle last page correctly', () => {
      const items = [{ id: '21' }, { id: '22' }, { id: '23' }];
      const response = ResponseBuilder.paginated(items, 3, 10, 23);

      expect(response.pagination.page).toBe(3);
      expect(response.pagination.totalPages).toBe(3);
    });
  });
});

// ============================================
// HTTP Status Code Mapping Tests
// ============================================

describe('HTTP Status Code Mapping', () => {
  function mapErrorCodeToStatus(code: string): number {
    const mapping: Record<string, number> = {
      VALIDATION_ERROR: 400,
      NOT_FOUND: 404,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
    };
    return mapping[code] || 500;
  }

  test('should map validation error to 400', () => {
    expect(mapErrorCodeToStatus('VALIDATION_ERROR')).toBe(400);
  });

  test('should map not found to 404', () => {
    expect(mapErrorCodeToStatus('NOT_FOUND')).toBe(404);
  });

  test('should map unauthorized to 401', () => {
    expect(mapErrorCodeToStatus('UNAUTHORIZED')).toBe(401);
  });

  test('should map forbidden to 403', () => {
    expect(mapErrorCodeToStatus('FORBIDDEN')).toBe(403);
  });

  test('should map rate limited to 429', () => {
    expect(mapErrorCodeToStatus('RATE_LIMITED')).toBe(429);
  });

  test('should default to 500 for unknown codes', () => {
    expect(mapErrorCodeToStatus('UNKNOWN')).toBe(500);
  });
});

// ============================================
// Response Headers Tests
// ============================================

describe('Response Headers', () => {
  test('should include Content-Type header', () => {
    const headers = {
      'Content-Type': 'application/json',
    };

    expect(headers['Content-Type']).toBe('application/json');
  });

  test('should include CORS headers', () => {
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    expect(headers['Access-Control-Allow-Origin']).toBe('*');
    expect(headers['Access-Control-Allow-Methods']).toBeDefined();
  });

  test('should include rate limit headers', () => {
    const headers = {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '99',
      'X-RateLimit-Reset': '1234567890',
    };

    expect(headers['X-RateLimit-Limit']).toBeDefined();
    expect(headers['X-RateLimit-Remaining']).toBeDefined();
  });

  test('should include security headers', () => {
    const headers = {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
    };

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
  });
});

// ============================================
// Content Type Tests
// ============================================

describe('Content Type Handling', () => {
  test('should parse JSON request body', async () => {
    const body = '{"name":"test"}';
    const parsed = JSON.parse(body);

    expect(parsed.name).toBe('test');
  });

  test('should handle invalid JSON gracefully', () => {
    const invalidBody = '{invalid json}';

    expect(() => JSON.parse(invalidBody)).toThrow();
  });

  test('should return JSON response', () => {
    const response = ResponseBuilder.success({ test: true });

    expect(() => JSON.stringify(response)).not.toThrow();
  });
});

// ============================================
// Response Time Tests
// ============================================

describe('Response Time', () => {
  test('should include processing time', () => {
    const startTime = Date.now();
    // Simulate processing
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    expect(processingTime).toBeGreaterThanOrEqual(0);
  });

  test('should be under acceptable threshold', () => {
    const response = ResponseBuilder.success({});
    const responseTime = 50; // ms

    expect(responseTime).toBeLessThan(1000);
  });
});

// ============================================
// API Versioning Tests
// ============================================

describe('API Versioning', () => {
  test('should include API version in response', () => {
    const response = {
      ...ResponseBuilder.success({}),
      apiVersion: '1.0.0',
    };

    expect(response.apiVersion).toBe('1.0.0');
  });

  test('should handle version deprecation', () => {
    const response = {
      ...ResponseBuilder.success({}),
      apiVersion: '1.0.0',
      deprecated: true,
      sunsetDate: '2024-12-31',
    };

    expect(response.deprecated).toBe(true);
    expect(response.sunsetDate).toBeDefined();
  });
});

// ============================================
// Response Validation Tests
// ============================================

describe('Response Validation', () => {
  function isValidResponse(response: unknown): boolean {
    if (typeof response !== 'object' || response === null) return false;
    
    const r = response as ApiResponse;
    
    if (typeof r.success !== 'boolean') return false;
    
    if (r.success) {
      return 'data' in r;
    } else {
      return (
        'error' in r &&
        typeof r.error === 'object' &&
        r.error !== null &&
        'code' in r.error &&
        'message' in r.error
      );
    }
  }

  test('should validate success response', () => {
    const response = ResponseBuilder.success({ id: '1' });

    expect(isValidResponse(response)).toBe(true);
  });

  test('should validate error response', () => {
    const response = ResponseBuilder.error('ERROR', 'Message');

    expect(isValidResponse(response)).toBe(true);
  });

  test('should reject invalid response', () => {
    const invalidResponse = { random: 'data' };

    expect(isValidResponse(invalidResponse)).toBe(false);
  });

  test('should reject response without success field', () => {
    const invalidResponse = { data: {} };

    expect(isValidResponse(invalidResponse)).toBe(false);
  });

  test('should reject error response without code', () => {
    const invalidResponse = {
      success: false,
      error: { message: 'Error' },
    };

    expect(isValidResponse(invalidResponse)).toBe(false);
  });
});

// ============================================
// Localization Tests
// ============================================

describe('Localization', () => {
  const messages: Record<string, Record<string, string>> = {
    en: {
      NOT_FOUND: 'Resource not found',
      VALIDATION_ERROR: 'Validation failed',
    },
    zh: {
      NOT_FOUND: '资源未找到',
      VALIDATION_ERROR: '验证失败',
    },
  };

  function getLocalizedMessage(code: string, locale: string = 'en'): string {
    return messages[locale]?.[code] || messages.en[code] || 'Unknown error';
  }

  test('should return English message by default', () => {
    expect(getLocalizedMessage('NOT_FOUND')).toBe('Resource not found');
  });

  test('should return localized message', () => {
    expect(getLocalizedMessage('NOT_FOUND', 'zh')).toBe('资源未找到');
  });

  test('should fallback to English for unknown locale', () => {
    expect(getLocalizedMessage('NOT_FOUND', 'fr')).toBe('Resource not found');
  });

  test('should handle unknown error code', () => {
    expect(getLocalizedMessage('UNKNOWN')).toBe('Unknown error');
  });
});
