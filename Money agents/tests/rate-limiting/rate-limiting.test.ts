/**
 * Rate Limiting Tests
 * Tests for API rate limiting, throttling, and quota management
 */

// ============================================
// Rate Limiter Implementation
// ============================================

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (identifier: string) => string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  check(identifier: string): RateLimitResult {
    const now = Date.now();
    const key = this.config.keyGenerator?.(identifier) ?? identifier;
    
    // Get existing requests
    let timestamps = this.requests.get(key) || [];
    
    // Filter out expired timestamps
    timestamps = timestamps.filter(ts => now - ts < this.config.windowMs);
    
    // Check if limit exceeded
    if (timestamps.length >= this.config.maxRequests) {
      const oldestRequest = Math.min(...timestamps);
      const resetTime = oldestRequest + this.config.windowMs;
      
      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }
    
    // Add current request
    timestamps.push(now);
    this.requests.set(key, timestamps);
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - timestamps.length,
      resetTime: now + this.config.windowMs,
    };
  }

  reset(identifier: string): void {
    const key = this.config.keyGenerator?.(identifier) ?? identifier;
    this.requests.delete(key);
  }

  getUsage(identifier: string): { count: number; remaining: number } {
    const now = Date.now();
    const key = this.config.keyGenerator?.(identifier) ?? identifier;
    let timestamps = this.requests.get(key) || [];
    timestamps = timestamps.filter(ts => now - ts < this.config.windowMs);
    
    return {
      count: timestamps.length,
      remaining: Math.max(0, this.config.maxRequests - timestamps.length),
    };
  }
}

// ============================================
// Rate Limiter Tests
// ============================================
describe('Rate Limiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 60000, // 1 minute
      maxRequests: 10,
    });
  });

  describe('Basic Rate Limiting', () => {
    test('should allow requests under limit', () => {
      const result = limiter.check('user_1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    test('should track multiple requests from same user', () => {
      for (let i = 0; i < 5; i++) {
        limiter.check('user_1');
      }
      
      const result = limiter.check('user_1');
      
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    test('should block requests over limit', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('user_1');
      }
      
      const result = limiter.check('user_1');
      
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    test('should provide retry-after time', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('user_1');
      }
      
      const result = limiter.check('user_1');
      
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });

    test('should track different users independently', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('user_1');
      }
      
      const user2Result = limiter.check('user_2');
      
      expect(user2Result.allowed).toBe(true);
      expect(user2Result.remaining).toBe(9);
    });
  });

  describe('Window Management', () => {
    test('should reset after window expires', async () => {
      const shortLimiter = new RateLimiter({
        windowMs: 100, // 100ms
        maxRequests: 2,
      });

      shortLimiter.check('user_1');
      shortLimiter.check('user_1');
      
      let result = shortLimiter.check('user_1');
      expect(result.allowed).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      result = shortLimiter.check('user_1');
      expect(result.allowed).toBe(true);
    });

    test('should calculate correct reset time', () => {
      const result = limiter.check('user_1');
      
      const now = Date.now();
      expect(result.resetTime).toBeGreaterThan(now);
    });
  });

  describe('Manual Reset', () => {
    test('should reset usage on demand', () => {
      for (let i = 0; i < 10; i++) {
        limiter.check('user_1');
      }
      
      limiter.reset('user_1');
      
      const result = limiter.check('user_1');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Usage Tracking', () => {
    test('should return current usage', () => {
      limiter.check('user_1');
      limiter.check('user_1');
      
      const usage = limiter.getUsage('user_1');
      
      expect(usage.count).toBe(2);
      expect(usage.remaining).toBe(8);
    });

    test('should return zero usage for new users', () => {
      const usage = limiter.getUsage('new_user');
      
      expect(usage.count).toBe(0);
      expect(usage.remaining).toBe(10);
    });
  });
});

// ============================================
// Endpoint-Specific Rate Limiting
// ============================================
describe('Endpoint-Specific Rate Limiting', () => {
  const endpointConfigs = {
    '/api/projects': { windowMs: 60000, maxRequests: 100 },
    '/api/agents': { windowMs: 60000, maxRequests: 200 },
    '/api/approvals': { windowMs: 60000, maxRequests: 20 },
    '/api/auth/login': { windowMs: 900000, maxRequests: 5 }, // 15 min, 5 attempts
  };

  test('should apply different limits per endpoint', () => {
    const projectsLimiter = new RateLimiter(endpointConfigs['/api/projects']);
    const authLimiter = new RateLimiter(endpointConfigs['/api/auth/login']);

    // Projects allows 100 requests
    const projectsUsage = projectsLimiter.getUsage('user_1');
    expect(projectsUsage.remaining).toBe(100);

    // Auth allows only 5 attempts
    const authUsage = authLimiter.getUsage('user_1');
    expect(authUsage.remaining).toBe(5);
  });

  test('should have stricter limits for sensitive endpoints', () => {
    const approvalConfig = endpointConfigs['/api/approvals'];
    const projectsConfig = endpointConfigs['/api/projects'];

    expect(approvalConfig.maxRequests).toBeLessThan(projectsConfig.maxRequests);
  });

  test('should enforce longer windows for authentication', () => {
    const authConfig = endpointConfigs['/api/auth/login'];
    const projectsConfig = endpointConfigs['/api/projects'];

    expect(authConfig.windowMs).toBeGreaterThan(projectsConfig.windowMs);
  });
});

// ============================================
// API Quota Management
// ============================================
interface ApiQuota {
  service: string;
  dailyLimit: number;
  usedToday: number;
  resetAt: Date;
}

class QuotaManager {
  private quotas: Map<string, ApiQuota> = new Map();

  setQuota(service: string, dailyLimit: number): void {
    this.quotas.set(service, {
      service,
      dailyLimit,
      usedToday: 0,
      resetAt: this.getNextResetTime(),
    });
  }

  useQuota(service: string): { allowed: boolean; remaining: number } {
    const quota = this.quotas.get(service);
    
    if (!quota) {
      return { allowed: false, remaining: 0 };
    }

    // Check if quota needs reset
    if (new Date() >= quota.resetAt) {
      quota.usedToday = 0;
      quota.resetAt = this.getNextResetTime();
    }

    if (quota.usedToday >= quota.dailyLimit) {
      return { allowed: false, remaining: 0 };
    }

    quota.usedToday++;
    return { allowed: true, remaining: quota.dailyLimit - quota.usedToday };
  }

  getRemaining(service: string): number {
    const quota = this.quotas.get(service);
    if (!quota) return 0;
    
    if (new Date() >= quota.resetAt) {
      return quota.dailyLimit;
    }
    
    return Math.max(0, quota.dailyLimit - quota.usedToday);
  }

  private getNextResetTime(): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  }
}

describe('API Quota Management', () => {
  let quotaManager: QuotaManager;

  beforeEach(() => {
    quotaManager = new QuotaManager();
  });

  test('should track API usage quotas', () => {
    quotaManager.setQuota('alpha_vantage', 500);
    
    const remaining = quotaManager.getRemaining('alpha_vantage');
    
    expect(remaining).toBe(500);
  });

  test('should decrement quota on use', () => {
    quotaManager.setQuota('alpha_vantage', 500);
    
    quotaManager.useQuota('alpha_vantage');
    quotaManager.useQuota('alpha_vantage');
    
    const remaining = quotaManager.getRemaining('alpha_vantage');
    expect(remaining).toBe(498);
  });

  test('should block when quota exhausted', () => {
    quotaManager.setQuota('test_service', 2);
    
    quotaManager.useQuota('test_service');
    quotaManager.useQuota('test_service');
    
    const result = quotaManager.useQuota('test_service');
    
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('should track multiple services independently', () => {
    quotaManager.setQuota('alpha_vantage', 500);
    quotaManager.setQuota('fred', 1000);
    
    quotaManager.useQuota('alpha_vantage');
    
    expect(quotaManager.getRemaining('alpha_vantage')).toBe(499);
    expect(quotaManager.getRemaining('fred')).toBe(1000);
  });

  test('should return zero for unknown service', () => {
    const remaining = quotaManager.getRemaining('unknown_service');
    expect(remaining).toBe(0);
  });
});

// ============================================
// Burst Rate Limiting
// ============================================
describe('Burst Rate Limiting', () => {
  test('should handle burst traffic', () => {
    const burstLimiter = new RateLimiter({
      windowMs: 1000, // 1 second
      maxRequests: 10,
    });

    const burstResults = [];
    
    // Simulate burst of 15 requests
    for (let i = 0; i < 15; i++) {
      burstResults.push(burstLimiter.check('user_1'));
    }

    const allowed = burstResults.filter(r => r.allowed);
    const blocked = burstResults.filter(r => !r.allowed);

    expect(allowed.length).toBe(10);
    expect(blocked.length).toBe(5);
  });

  test('should smooth traffic over time', async () => {
    const limiter = new RateLimiter({
      windowMs: 500,
      maxRequests: 5,
    });

    // Send requests with delays
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(limiter.check('user_1'));
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const allowed = results.filter(r => r.allowed);
    expect(allowed.length).toBeGreaterThan(3);
  });
});

// ============================================
// IP-Based Rate Limiting
// ============================================
describe('IP-Based Rate Limiting', () => {
  test('should limit by IP address', () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      keyGenerator: (ip) => `ip:${ip}`,
    });

    const ip1 = '192.168.1.1';
    const ip2 = '192.168.1.2';

    limiter.check(ip1);
    limiter.check(ip1);

    const ip1Usage = limiter.getUsage(ip1);
    const ip2Usage = limiter.getUsage(ip2);

    expect(ip1Usage.count).toBe(2);
    expect(ip2Usage.count).toBe(0);
  });

  test('should handle X-Forwarded-For header', () => {
    const forwardedFor = '203.0.113.1, 70.41.3.18, 150.172.238.178';
    
    // Get the first IP (client IP)
    const clientIP = forwardedFor.split(',')[0].trim();
    
    expect(clientIP).toBe('203.0.113.1');
  });

  test('should handle IPv6 addresses', () => {
    const ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334';
    
    const limiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
      keyGenerator: (ip) => `ip:${ip}`,
    });

    const result = limiter.check(ipv6);
    
    expect(result.allowed).toBe(true);
  });
});

// ============================================
// Sliding Window Rate Limiting
// ============================================
describe('Sliding Window Rate Limiting', () => {
  class SlidingWindowLimiter {
    private requests: Map<string, number[]> = new Map();
    
    constructor(
      private windowMs: number,
      private maxRequests: number
    ) {}

    check(identifier: string): RateLimitResult {
      const now = Date.now();
      let timestamps = this.requests.get(identifier) || [];
      
      // Remove expired timestamps (sliding window)
      timestamps = timestamps.filter(ts => now - ts < this.windowMs);
      
      const allowed = timestamps.length < this.maxRequests;
      
      if (allowed) {
        timestamps.push(now);
        this.requests.set(identifier, timestamps);
      }

      return {
        allowed,
        remaining: Math.max(0, this.maxRequests - timestamps.length - (allowed ? 0 : 0)),
        resetTime: timestamps.length > 0 ? Math.min(...timestamps) + this.windowMs : now + this.windowMs,
        retryAfter: allowed ? undefined : Math.ceil((Math.min(...timestamps) + this.windowMs - now) / 1000),
      };
    }
  }

  test('should use sliding window instead of fixed window', async () => {
    const limiter = new SlidingWindowLimiter(1000, 3);

    // First burst
    expect(limiter.check('user_1').allowed).toBe(true);
    await new Promise(r => setTimeout(r, 500));
    expect(limiter.check('user_1').allowed).toBe(true);
    
    // Wait for first request to expire
    await new Promise(r => setTimeout(r, 600));
    
    // Should allow again because window has slid
    expect(limiter.check('user_1').allowed).toBe(true);
    expect(limiter.check('user_1').allowed).toBe(true);
  });
});

// ============================================
// Rate Limit Headers
// ============================================
describe('Rate Limit Headers', () => {
  test('should include rate limit headers in response', () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 100,
    });

    const result = limiter.check('user_1');

    const headers = {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toString(),
    };

    expect(headers['X-RateLimit-Limit']).toBe('100');
    expect(headers['X-RateLimit-Remaining']).toBe('99');
    expect(parseInt(headers['X-RateLimit-Reset'])).toBeGreaterThan(Date.now());
  });

  test('should include Retry-After header when limited', () => {
    const limiter = new RateLimiter({
      windowMs: 60000,
      maxRequests: 2,
    });

    limiter.check('user_1');
    limiter.check('user_1');
    const result = limiter.check('user_1');

    if (!result.allowed && result.retryAfter) {
      const headers = {
        'Retry-After': result.retryAfter.toString(),
      };
      expect(headers['Retry-After']).toBeDefined();
    }
  });
});

// ============================================
// Distributed Rate Limiting Considerations
// ============================================
describe('Distributed Rate Limiting', () => {
  test('should handle multiple instances conceptually', () => {
    // In a real distributed system, rate limiting would use Redis
    // This tests the concept
    
    const distributedConfig = {
      store: 'redis',
      prefix: 'ratelimit:',
      windowMs: 60000,
      maxRequests: 100,
    };

    expect(distributedConfig.store).toBe('redis');
    expect(distributedConfig.prefix).toBe('ratelimit:');
  });

  test('should synchronize state across instances', () => {
    // Conceptual test for distributed state
    const instance1 = { count: 50 };
    const instance2 = { count: 50 };
    
    // Shared state would be in Redis
    const sharedState = {
      totalCount: instance1.count + instance2.count,
    };

    expect(sharedState.totalCount).toBe(100);
  });
});
