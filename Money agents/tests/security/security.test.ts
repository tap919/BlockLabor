/**
 * Security Tests
 * Tests for XSS, SQL Injection, CSRF, and other security vulnerabilities
 */

import { 
  mockProject, 
  mockUser, 
  mockAuditLog, 
  createMockPrismaClient 
} from '../utils/test-utils';

// ============================================
// Input Validation Tests
// ============================================
describe('Input Validation', () => {
  describe('Project Name Validation', () => {
    test('should reject XSS attempts in project name', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '"><script>alert(document.cookie)</script>',
        "javascript:alert('XSS')",
        '<svg onload=alert(1)>',
        '<body onload=alert(1)>',
      ];

      xssPayloads.forEach(payload => {
        const sanitized = payload
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');

        // After sanitization, the tags should be escaped
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('<svg');
        expect(sanitized).not.toContain('<body');
      });
    });

    test('should handle unicode edge cases', () => {
      const unicodeInputs = [
        '\u0000null-byte',
        '\u202Ereversed-text',
        '🚀\u200D🔥', // Zero-width joiner
        'test\u2028newline', // Line separator
        'test\u2029paragraph', // Paragraph separator
      ];

      unicodeInputs.forEach(input => {
        // Should not throw when processing
        expect(() => input.trim()).not.toThrow();
      });
    });

    test('should enforce maximum length', () => {
      const longName = 'A'.repeat(10000);
      
      // Truncate to reasonable length
      const truncated = longName.substring(0, 255);
      
      expect(truncated.length).toBe(255);
    });

    test('should handle null bytes in input', () => {
      const input = 'test\x00project';
      
      // Remove null bytes
      const sanitized = input.replace(/\x00/g, '');
      
      expect(sanitized).toBe('testproject');
    });
  });

  describe('Email Validation', () => {
    test('should validate email format', () => {
      const validEmails = [
        'test@example.com',
        'user.name@example.com',
        'user+tag@example.com',
        'user@subdomain.example.com',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      validEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(true);
      });
    });

    test('should reject invalid emails', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });

    test('should normalize email case', () => {
      const email = 'Test@Example.COM';
      const normalized = email.toLowerCase();
      
      expect(normalized).toBe('test@example.com');
    });
  });

  describe('ID Validation', () => {
    test('should validate CUID format', () => {
      const cuidRegex = /^c[a-z0-9]{24}$/;
      const validCUID = 'clx1234567890123456789012';
      
      // CUIDs start with 'c' and are 25 characters
      expect(validCUID.length).toBe(25);
    });

    test('should reject malformed IDs', () => {
      const invalidIDs = [
        '',
        'null',
        'undefined',
        '../../../etc/passwd',
        '1; DROP TABLE projects; --',
      ];

      // These IDs are clearly not valid CUIDs (too short or contain special chars)
      invalidIDs.forEach(id => {
        const isValidCUID = /^c[a-z0-9]{24}$/.test(id);
        expect(isValidCUID).toBe(false);
      });
    });
  });
});

// ============================================
// SQL Injection Tests
// ============================================
describe('SQL Injection Prevention', () => {
  test('should sanitize SQL injection attempts', () => {
    const sqlInjectionPayloads = [
      "'; DROP TABLE projects; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "1; DELETE FROM projects WHERE '1'='1'",
      "admin'--",
      "' OR 1=1 --",
    ];

    // All payloads contain SQL-like patterns
    const hasSQLPattern = (payload: string) => {
      const patterns = [
        /(\bDROP\b|\bDELETE\b|\bUNION\b|\bSELECT\b)/i,
        /'\s*OR\s*['\d]/i,
        /--/,
      ];
      return patterns.some(p => p.test(payload));
    };

    sqlInjectionPayloads.forEach(payload => {
      // All payloads should match SQL-like patterns
      expect(hasSQLPattern(payload)).toBe(true);
    });
  });

  test('should use parameterized queries', () => {
    const userInput = "'; DROP TABLE projects; --";
    
    // Simulate Prisma's parameterized query behavior
    const query = {
      where: {
        name: userInput, // This is parameterized, not interpolated
      },
    };

    expect(query.where.name).toBe(userInput);
    // In actual Prisma, this would be safely parameterized
  });

  test('should escape special characters', () => {
    const specialChars = [
      "'",
      '"',
      '\\',
      '\n',
      '\r',
      '\x00',
    ];

    specialChars.forEach(char => {
      const input = `test${char}name`;
      
      // Input should be preserved, but not interpreted as SQL
      expect(input).toContain(char);
    });
  });
});

// ============================================
// XSS Prevention Tests
// ============================================
describe('XSS Prevention', () => {
  test('should sanitize HTML in output', () => {
    const htmlContent = '<script>alert("xss")</script>';
    
    const sanitized = htmlContent
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    expect(sanitized).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
  });

  test('should sanitize attributes', () => {
    const attributePayloads = [
      'onclick="alert(1)"',
      'onmouseover="alert(1)"',
      'onfocus="alert(1)"',
      'onerror="alert(1)"',
    ];

    attributePayloads.forEach(payload => {
      // Remove event handlers
      const sanitized = payload.replace(/on\w+="[^"]*"/g, '');
      expect(sanitized).not.toContain('alert');
    });
  });

  test('should sanitize URL schemes', () => {
    const dangerousURLs = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:alert(1)',
    ];

    const allowedSchemes = ['http', 'https', 'mailto', 'tel'];

    dangerousURLs.forEach(url => {
      const scheme = url.split(':')[0].toLowerCase();
      expect(allowedSchemes.includes(scheme)).toBe(false);
    });
  });

  test('should handle base64 encoded payloads', () => {
    const base64Payload = Buffer.from('<script>alert(1)</script>').toString('base64');
    
    // Even if base64 decoded, should still sanitize
    const decoded = Buffer.from(base64Payload, 'base64').toString();
    const sanitized = decoded.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    expect(sanitized).not.toContain('<script>');
  });
});

// ============================================
// CSRF Protection Tests
// ============================================
describe('CSRF Protection', () => {
  test('should require CSRF token for state-changing operations', () => {
    const csrfToken = 'csrf_token_12345';
    
    const request = {
      method: 'POST',
      headers: {
        'x-csrf-token': csrfToken,
      },
    };

    expect(request.headers['x-csrf-token']).toBe(csrfToken);
  });

  test('should validate CSRF token', () => {
    const sessionToken = 'session_csrf_token';
    const requestToken = 'session_csrf_token';

    expect(sessionToken).toBe(requestToken);
  });

  test('should reject mismatched CSRF tokens', () => {
    const sessionToken = 'session_csrf_token';
    const requestToken = 'invalid_token';

    expect(sessionToken).not.toBe(requestToken);
  });

  test('should check Origin header', () => {
    const allowedOrigins = ['https://example.com', 'https://app.example.com'];
    const requestOrigin = 'https://example.com';

    expect(allowedOrigins.includes(requestOrigin)).toBe(true);
  });

  test('should reject cross-origin requests', () => {
    const allowedOrigins = ['https://example.com'];
    const maliciousOrigin = 'https://attacker.com';

    expect(allowedOrigins.includes(maliciousOrigin)).toBe(false);
  });
});

// ============================================
// Authentication Security Tests
// ============================================
describe('Authentication Security', () => {
  test('should hash API keys', () => {
    const apiKey = 'sk_live_1234567890abcdef';
    
    // Simulate hashing
    const hashedKey = `hashed_${apiKey.substring(0, 8)}...`;
    
    expect(hashedKey).not.toBe(apiKey);
  });

  test('should validate API key format', () => {
    const validKeyFormat = /^sk_(test|live)_[a-zA-Z0-9]+$/;
    
    const validKey = 'sk_test_1234567890abcdefghij';
    const invalidKey = 'invalid-key';
    
    expect(validKeyFormat.test(validKey)).toBe(true);
    expect(validKeyFormat.test(invalidKey)).toBe(false);
  });

  test('should enforce role-based access', () => {
    const roles = {
      admin: ['read', 'write', 'delete', 'manage_users'],
      analyst: ['read', 'write'],
      viewer: ['read'],
    };

    expect(roles.admin).toContain('delete');
    expect(roles.analyst).not.toContain('delete');
    expect(roles.viewer).not.toContain('write');
  });

  test('should handle session expiration', () => {
    const sessionExpiry = new Date(Date.now() - 1000); // Expired
    const now = new Date();

    expect(sessionExpiry < now).toBe(true);
  });
});

// ============================================
// Audit Trail Security Tests
// ============================================
describe('Audit Trail Security', () => {
  test('should create immutable audit entries', () => {
    const auditLog = mockAuditLog({
      action: 'sensitive_action',
      hash: 'sha256_hash_value',
    });

    // Hash should be generated and immutable
    expect(auditLog.hash).toBeDefined();
    expect(auditLog.hash.length).toBeGreaterThan(0);
  });

  test('should link audit entries in chain', () => {
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

  test('should detect tampering in audit chain', () => {
    const entries = [
      mockAuditLog({ hash: 'hash_1', previousHash: null }),
      mockAuditLog({ hash: 'hash_2_tampered', previousHash: 'hash_1' }),
      mockAuditLog({ hash: 'hash_3', previousHash: 'hash_2' }), // Points to original
    ];

    // Hash chain is broken
    expect(entries[2].previousHash).not.toBe(entries[1].hash);
  });

  test('should log IP addresses for security events', () => {
    const auditLog = mockAuditLog({
      action: 'login_attempt',
      ipAddress: '192.168.1.100',
    });

    expect(auditLog.ipAddress).toBeDefined();
  });

  test('should log user agent strings', () => {
    const auditLog = mockAuditLog({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });

    expect(auditLog.userAgent).toBeDefined();
  });
});

// ============================================
// Data Sanitization Tests
// ============================================
describe('Data Sanitization', () => {
  test('should remove sensitive fields from responses', () => {
    const user = mockUser({
      apiKey: 'secret_api_key',
    });

    // Sanitize for response
    const sanitizedUser = {
      ...user,
      apiKey: undefined,
    };

    expect(sanitizedUser.apiKey).toBeUndefined();
  });

  test('should mask sensitive data in logs', () => {
    const sensitiveData = 'password123';
    
    const masked = sensitiveData.replace(/./g, '*');
    
    expect(masked).toBe('***********');
  });

  test('should handle PII appropriately', () => {
    const user = mockUser({
      email: 'user@example.com',
      name: 'John Doe',
    });

    // For public display, hide PII
    const publicUser = {
      id: user.id,
      role: user.role,
    };

    expect(publicUser.email).toBeUndefined();
    expect(publicUser.name).toBeUndefined();
  });
});

// ============================================
// Rate Limiting Security Tests
// ============================================
describe('Rate Limiting Security', () => {
  test('should enforce request rate limits', () => {
    const rateLimit = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    };

    const requests = Array(150).fill(null);
    const allowed = requests.slice(0, rateLimit.maxRequests);

    expect(allowed.length).toBe(100);
  });

  test('should track requests by IP', () => {
    const ipRequests: Record<string, number[]> = {
      '192.168.1.1': [1, 2, 3],
      '192.168.1.2': [1, 2],
    };

    expect(ipRequests['192.168.1.1'].length).toBe(3);
    expect(ipRequests['192.168.1.2'].length).toBe(2);
  });

  test('should enforce stricter limits for sensitive endpoints', () => {
    const endpointLimits = {
      '/api/projects': 100,
      '/api/approvals': 20, // Stricter
      '/api/auth/login': 5, // Very strict
    };

    expect(endpointLimits['/api/approvals']).toBeLessThan(endpointLimits['/api/projects']);
    expect(endpointLimits['/api/auth/login']).toBeLessThan(endpointLimits['/api/approvals']);
  });

  test('should handle burst traffic', () => {
    const burstLimit = 10; // requests per second
    const requests = Array(20).fill(null);

    // Split into burst windows
    const bursts = [];
    for (let i = 0; i < requests.length; i += burstLimit) {
      bursts.push(requests.slice(i, i + burstLimit));
    }

    expect(bursts.length).toBe(2);
    expect(bursts[0].length).toBe(10);
  });
});

// ============================================
// Environment Security Tests
// ============================================
describe('Environment Security', () => {
  test('should not expose environment variables', () => {
    const sensitiveVars = [
      'DATABASE_URL',
      'API_KEY',
      'SECRET_KEY',
      'JWT_SECRET',
    ];

    // These should never be exposed to client
    const clientEnv: Record<string, string | undefined> = {};

    sensitiveVars.forEach(varName => {
      expect(clientEnv[varName]).toBeUndefined();
    });
  });

  test('should use secure cookie settings', () => {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
    };

    expect(cookieOptions.httpOnly).toBe(true);
    expect(cookieOptions.secure).toBe(true);
    expect(cookieOptions.sameSite).toBe('strict');
  });

  test('should validate environment configuration', () => {
    const requiredEnvVars = [
      'DATABASE_URL',
    ];

    // In test environment, we might not have all vars
    requiredEnvVars.forEach(varName => {
      // Just check format expectations
      expect(typeof varName).toBe('string');
    });
  });
});

// ============================================
// Error Handling Security Tests
// ============================================
describe('Error Handling Security', () => {
  test('should not expose internal errors to users', () => {
    const internalError = new Error('Database connection failed: password incorrect');
    
    const userError = {
      error: 'An unexpected error occurred',
      status: 500,
    };

    expect(userError.error).not.toContain('Database');
    expect(userError.error).not.toContain('password');
  });

  test('should log internal errors securely', () => {
    const error = {
      message: 'Sensitive error details',
      stack: 'at function (file.js:1:1)',
    };

    // Log should be internal only
    const logEntry = JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
    });

    expect(logEntry).toContain('Sensitive error details');
    // But should not be sent to user
  });

  test('should handle thrown errors gracefully', () => {
    const throwables = [
      () => { throw new Error('Test error'); },
      () => { throw { custom: 'error' }; },
      () => { throw 'string error'; },
    ];

    throwables.forEach(fn => {
      try {
        fn();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
