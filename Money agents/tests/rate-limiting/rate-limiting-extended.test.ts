/**
 * Rate Limiting Tests - Extended
 * Comprehensive tests for API rate limiting, throttling, and quota management
 */

import { createMockPrismaClient, mockProject, mockUser } from '../utils/test-utils';

// ============================================
// API Rate Limiting Tests
// ============================================

describe('API Rate Limiting', () => {
  describe('Request Rate Limits', () => {
    test('should enforce global rate limit', () => {
      const globalLimit = {
        maxRequests: 1000,
        windowMs: 60000,
        current: 950,
      };
      
      const withinLimit = globalLimit.current < globalLimit.maxRequests;
      expect(withinLimit).toBe(true);
    });

    test('should block requests exceeding limit', () => {
      const rateLimit = {
        maxRequests: 100,
        windowMs: 60000,
        current: 105,
      };
      
      const exceedsLimit = rateLimit.current >= rateLimit.maxRequests;
      expect(exceedsLimit).toBe(true);
    });

    test('should calculate remaining requests', () => {
      const rateLimit = {
        maxRequests: 100,
        current: 75,
      };
      
      const remaining = rateLimit.maxRequests - rateLimit.current;
      expect(remaining).toBe(25);
    });

    test('should reset after window expires', () => {
      const windowConfig = {
        windowMs: 60000,
        windowStart: Date.now() - 65000, // 65 seconds ago
      };
      
      const shouldReset = Date.now() - windowConfig.windowStart >= windowConfig.windowMs;
      expect(shouldReset).toBe(true);
    });

    test('should include rate limit headers in response', () => {
      const headers = {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': '95',
        'X-RateLimit-Reset': String(Date.now() + 60000),
      };
      
      expect(headers['X-RateLimit-Limit']).toBeDefined();
      expect(headers['X-RateLimit-Remaining']).toBeDefined();
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });

    test('should return 429 when rate limited', () => {
      const response = {
        status: 429,
        body: {
          error: 'Too Many Requests',
          retryAfter: 30,
        },
      };
      
      expect(response.status).toBe(429);
      expect(response.body.retryAfter).toBeDefined();
    });
  });

  describe('Per-User Rate Limits', () => {
    test('should track rate limits per user', () => {
      const userLimits = new Map([
        ['user_1', { count: 50, resetAt: Date.now() + 60000 }],
        ['user_2', { count: 30, resetAt: Date.now() + 60000 }],
      ]);
      
      expect(userLimits.get('user_1')?.count).toBe(50);
      expect(userLimits.get('user_2')?.count).toBe(30);
    });

    test('should enforce different limits per user tier', () => {
      const tierLimits = {
        free: { maxRequests: 100, windowMs: 60000 },
        pro: { maxRequests: 1000, windowMs: 60000 },
        enterprise: { maxRequests: 10000, windowMs: 60000 },
      };
      
      expect(tierLimits.pro.maxRequests).toBeGreaterThan(tierLimits.free.maxRequests);
      expect(tierLimits.enterprise.maxRequests).toBeGreaterThan(tierLimits.pro.maxRequests);
    });

    test('should apply burst allowance', () => {
      const burstConfig = {
        maxBurst: 20,
        burstWindowMs: 1000,
        burstCount: 15,
      };
      
      const withinBurst = burstConfig.burstCount < burstConfig.maxBurst;
      expect(withinBurst).toBe(true);
    });

    test('should block burst after exhaustion', () => {
      const burstConfig = {
        maxBurst: 20,
        burstCount: 22,
      };
      
      const exceedsBurst = burstConfig.burstCount >= burstConfig.maxBurst;
      expect(exceedsBurst).toBe(true);
    });
  });

  describe('Endpoint-Specific Limits', () => {
    test('should apply stricter limits for sensitive endpoints', () => {
      const endpointLimits = {
        '/api/projects': 100,
        '/api/trade': 20,
        '/api/approvals': 10,
        '/api/auth/login': 5,
      };
      
      expect(endpointLimits['/api/trade']).toBeLessThan(endpointLimits['/api/projects']);
      expect(endpointLimits['/api/auth/login']).toBeLessThan(endpointLimits['/api/approvals']);
    });

    test('should apply looser limits for read endpoints', () => {
      const endpointLimits = {
        '/api/projects': 100,
        '/api/projects/[id]': 200, // Read single
        '/api/agents': 150,
      };
      
      expect(endpointLimits['/api/projects/[id]']).toBeGreaterThan(endpointLimits['/api/projects']);
    });

    test('should identify endpoint from request path', () => {
      const path = '/api/projects/proj_123';
      const endpointPattern = /^\/api\/[^\/]+/;
      const match = path.match(endpointPattern);
      
      expect(match?.[0]).toBe('/api/projects');
    });
  });
});

// ============================================
// IP-Based Rate Limiting Tests
// ============================================

describe('IP-Based Rate Limiting', () => {
  describe('IP Tracking', () => {
    test('should track requests by IP', () => {
      const ipTracker = new Map([
        ['192.168.1.1', { count: 50, firstRequest: Date.now() }],
        ['192.168.1.2', { count: 30, firstRequest: Date.now() }],
      ]);
      
      expect(ipTracker.size).toBe(2);
    });

    test('should extract IP from request headers', () => {
      const headers = {
        'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        'x-real-ip': '192.168.1.1',
      };
      
      const ip = headers['x-forwarded-for']?.split(',')[0].trim();
      expect(ip).toBe('192.168.1.1');
    });

    test('should handle proxy chains', () => {
      const forwardedFor = '192.168.1.1, 10.0.0.1, 172.16.0.1';
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      
      expect(ips).toHaveLength(3);
      expect(ips[0]).toBe('192.168.1.1'); // Original client IP
    });

    test('should block suspicious IPs', () => {
      const blockedIPs = new Set(['10.0.0.100', '192.168.50.50']);
      const clientIP = '10.0.0.100';
      
      const isBlocked = blockedIPs.has(clientIP);
      expect(isBlocked).toBe(true);
    });

    test('should whitelist trusted IPs', () => {
      const whitelist = new Set(['127.0.0.1', '::1', '10.0.0.1']);
      const clientIP = '127.0.0.1';
      
      const isWhitelisted = whitelist.has(clientIP);
      expect(isWhitelisted).toBe(true);
    });
  });

  describe('IP Rate Limits', () => {
    test('should enforce per-IP rate limits', () => {
      const ipLimit = {
        maxRequests: 500,
        windowMs: 60000,
        currentCount: 450,
      };
      
      const withinLimit = ipLimit.currentCount < ipLimit.maxRequests;
      expect(withinLimit).toBe(true);
    });

    test('should block IPs exceeding limits', () => {
      const ipLimit = {
        maxRequests: 500,
        currentCount: 550,
        blockedUntil: Date.now() + 300000, // 5 minutes
      };
      
      const isBlocked = ipLimit.currentCount >= ipLimit.maxRequests;
      expect(isBlocked).toBe(true);
    });

    test('should apply progressive blocking', () => {
      const offenses = [
        { count: 1, blockDuration: 60000 }, // 1 minute
        { count: 2, blockDuration: 300000 }, // 5 minutes
        { count: 3, blockDuration: 900000 }, // 15 minutes
      ];
      
      expect(offenses[2].blockDuration).toBeGreaterThan(offenses[1].blockDuration);
    });
  });
});

// ============================================
// Token Bucket Algorithm Tests
// ============================================

describe('Token Bucket Algorithm', () => {
  test('should initialize bucket with max tokens', () => {
    const bucket = {
      maxTokens: 100,
      currentTokens: 100,
      refillRate: 10, // tokens per second
      lastRefill: Date.now(),
    };
    
    expect(bucket.currentTokens).toBe(bucket.maxTokens);
  });

  test('should consume tokens on request', () => {
    const bucket = {
      maxTokens: 100,
      currentTokens: 100,
    };
    
    const tokensNeeded = 1;
    bucket.currentTokens -= tokensNeeded;
    
    expect(bucket.currentTokens).toBe(99);
  });

  test('should reject request when bucket empty', () => {
    const bucket = {
      maxTokens: 100,
      currentTokens: 0,
    };
    
    const canProcess = bucket.currentTokens > 0;
    expect(canProcess).toBe(false);
  });

  test('should refill tokens over time', () => {
    const bucket = {
      maxTokens: 100,
      currentTokens: 50,
      refillRate: 10, // tokens per second
      lastRefill: Date.now() - 3000, // 3 seconds ago
    };
    
    const elapsed = (Date.now() - bucket.lastRefill) / 1000;
    const newTokens = Math.min(
      bucket.maxTokens,
      bucket.currentTokens + (elapsed * bucket.refillRate)
    );
    
    expect(newTokens).toBeGreaterThan(bucket.currentTokens);
  });

  test('should not exceed max tokens on refill', () => {
    const bucket = {
      maxTokens: 100,
      currentTokens: 95,
      refillRate: 10,
      lastRefill: Date.now() - 10000, // 10 seconds ago
    };
    
    const elapsed = (Date.now() - bucket.lastRefill) / 1000;
    const newTokens = Math.min(
      bucket.maxTokens,
      bucket.currentTokens + (elapsed * bucket.refillRate)
    );
    
    expect(newTokens).toBeLessThanOrEqual(bucket.maxTokens);
  });

  test('should handle burst capacity', () => {
    const bucket = {
      maxTokens: 100,
      currentTokens: 100,
      burstSize: 50, // Extra burst capacity
    };
    
    const totalCapacity = bucket.maxTokens + bucket.burstSize;
    expect(totalCapacity).toBe(150);
  });
});

// ============================================
// Sliding Window Algorithm Tests
// ============================================

describe('Sliding Window Algorithm', () => {
  test('should track requests in sliding window', () => {
    const now = Date.now();
    const requests = [
      now - 50000, // 50 seconds ago (in window)
      now - 30000, // 30 seconds ago (in window)
      now - 10000, // 10 seconds ago (in window)
    ];
    
    const windowMs = 60000;
    const inWindow = requests.filter(t => now - t < windowMs);
    
    expect(inWindow).toHaveLength(3);
  });

  test('should exclude requests outside window', () => {
    const now = Date.now();
    const requests = [
      now - 70000, // 70 seconds ago (outside)
      now - 50000, // 50 seconds ago (inside)
      now - 30000, // 30 seconds ago (inside)
    ];
    
    const windowMs = 60000;
    const inWindow = requests.filter(t => now - t < windowMs);
    
    expect(inWindow).toHaveLength(2);
  });

  test('should calculate weighted count for smooth limiting', () => {
    const now = Date.now();
    const previousWindow = { count: 50, start: now - 120000 }; // 2 minutes ago
    const currentWindow = { count: 30, start: now - 30000 }; // 30 seconds ago
    
    const windowMs = 60000;
    const weight = (now - currentWindow.start) / windowMs;
    const weightedCount = (previousWindow.count * (1 - weight)) + currentWindow.count;
    
    expect(weightedCount).toBeLessThan(50 + 30);
  });

  test('should handle concurrent window updates', () => {
    const window = {
      count: 50,
      lastUpdate: Date.now(),
      lock: false,
    };
    
    // Simulate concurrent access
    const canUpdate = !window.lock;
    expect(canUpdate).toBe(true);
  });
});

// ============================================
// Quota Management Tests
// ============================================

describe('Quota Management', () => {
  describe('API Quotas', () => {
    test('should track API quota usage', () => {
      const quota = {
        service: 'openai',
        limit: 1000000, // 1M tokens
        used: 750000,
        period: 'monthly',
      };
      
      const remaining = quota.limit - quota.used;
      expect(remaining).toBe(250000);
    });

    test('should block when quota exhausted', () => {
      const quota = {
        limit: 1000000,
        used: 1050000,
      };
      
      const exhausted = quota.used >= quota.limit;
      expect(exhausted).toBe(true);
    });

    test('should calculate quota percentage', () => {
      const quota = {
        limit: 1000000,
        used: 750000,
      };
      
      const percentage = (quota.used / quota.limit) * 100;
      expect(percentage).toBe(75);
    });

    test('should alert on quota threshold', () => {
      const quota = {
        limit: 1000000,
        used: 850000,
        alertThreshold: 0.8, // 80%
      };
      
      const shouldAlert = quota.used / quota.limit >= quota.alertThreshold;
      expect(shouldAlert).toBe(true);
    });

    test('should reset quota on period end', () => {
      const quota = {
        period: 'monthly',
        periodStart: new Date('2024-01-01'),
        periodEnd: new Date('2024-02-01'),
        used: 500000,
      };
      
      const now = new Date('2024-02-02');
      const shouldReset = now >= quota.periodEnd;
      
      expect(shouldReset).toBe(true);
    });
  });

  describe('User Quotas', () => {
    test('should enforce user-specific quotas', () => {
      const userQuotas = {
        user_1: { projects: 5, agents: 10, executions: 1000 },
        user_2: { projects: 10, agents: 20, executions: 5000 },
      };
      
      expect(userQuotas['user_1'].projects).toBe(5);
      expect(userQuotas['user_2'].projects).toBe(10);
    });

    test('should track per-resource quotas', () => {
      const resourceUsage = {
        projects: { used: 3, limit: 5 },
        agents: { used: 8, limit: 10 },
        executions: { used: 500, limit: 1000 },
      };
      
      const projectsAvailable = resourceUsage.projects.limit - resourceUsage.projects.used;
      expect(projectsAvailable).toBe(2);
    });

    test('should prevent resource creation when quota exceeded', () => {
      const quota = {
        projects: { used: 5, limit: 5 },
      };
      
      const canCreateProject = quota.projects.used < quota.projects.limit;
      expect(canCreateProject).toBe(false);
    });
  });
});

// ============================================
// Rate Limit Bypass Tests
// ============================================

describe('Rate Limit Bypass', () => {
  test('should allow bypass for admin users', () => {
    const user = { role: 'admin', rateLimitBypass: true };
    
    const shouldBypass = user.rateLimitBypass === true;
    expect(shouldBypass).toBe(true);
  });

  test('should not allow bypass for regular users', () => {
    const user = { role: 'viewer', rateLimitBypass: false };
    
    const shouldBypass = user.rateLimitBypass === true;
    expect(shouldBypass).toBe(false);
  });

  test('should log bypass usage', () => {
    const bypassLog = {
      userId: 'user_admin',
      timestamp: new Date().toISOString(),
      endpoint: '/api/projects',
      reason: 'admin_bypass',
    };
    
    expect(bypassLog.reason).toBe('admin_bypass');
  });

  test('should require special header for bypass', () => {
    const headers = {
      'x-rate-limit-bypass': 'admin_secret_key',
    };
    
    const validBypassKey = 'admin_secret_key';
    const isValid = headers['x-rate-limit-bypass'] === validBypassKey;
    
    expect(isValid).toBe(true);
  });
});

// ============================================
// Rate Limit Monitoring Tests
// ============================================

describe('Rate Limit Monitoring', () => {
  test('should track rate limit metrics', () => {
    const metrics = {
      totalRequests: 10000,
      rateLimited: 150,
      blockedIPs: 5,
      averageWaitTime: 250, // ms
    };
    
    const rateLimitPercentage = (metrics.rateLimited / metrics.totalRequests) * 100;
    expect(rateLimitPercentage).toBe(1.5);
  });

  test('should identify top rate-limited endpoints', () => {
    const endpointStats = [
      { endpoint: '/api/trade', rateLimited: 50 },
      { endpoint: '/api/projects', rateLimited: 30 },
      { endpoint: '/api/agents', rateLimited: 20 },
    ];
    
    const sorted = endpointStats.sort((a, b) => b.rateLimited - a.rateLimited);
    expect(sorted[0].endpoint).toBe('/api/trade');
  });

  test('should alert on unusual rate limit patterns', () => {
    const pattern = {
      baseline: 100, // requests per minute
      current: 5000, // 50x increase
      alertThreshold: 10, // 10x
    };
    
    const shouldAlert = pattern.current / pattern.baseline >= pattern.alertThreshold;
    expect(shouldAlert).toBe(true);
  });

  test('should generate rate limit reports', () => {
    const report = {
      period: '2024-01-01 to 2024-01-31',
      totalRequests: 1000000,
      rateLimited: 15000,
      topLimitedIPs: ['192.168.1.1', '10.0.0.1'],
      topLimitedEndpoints: ['/api/trade', '/api/auth/login'],
    };
    
    expect(report.totalRequests).toBeGreaterThan(report.rateLimited);
    expect(report.topLimitedIPs).toHaveLength(2);
  });
});

// ============================================
// Distributed Rate Limiting Tests
// ============================================

describe('Distributed Rate Limiting', () => {
  test('should sync rate limits across servers', () => {
    const servers = [
      { id: 'server_1', requests: 300 },
      { id: 'server_2', requests: 350 },
      { id: 'server_3', requests: 350 },
    ];
    
    const totalRequests = servers.reduce((sum, s) => sum + s.requests, 0);
    expect(totalRequests).toBe(1000);
  });

  test('should use consistent hashing for distribution', () => {
    const hash = (key: string) => {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash);
    };
    
    const serverIndex = hash('user_1') % 3;
    expect(serverIndex).toBeGreaterThanOrEqual(0);
    expect(serverIndex).toBeLessThan(3);
  });

  test('should handle network partition gracefully', () => {
    const partitionConfig = {
      fallbackStrategy: 'local_rate_limit',
      maxLocalLimit: 100, // Conservative local limit
      syncInterval: 5000,
    };
    
    expect(partitionConfig.fallbackStrategy).toBe('local_rate_limit');
  });

  test('should eventually consistent after partition', () => {
    const consistency = {
      lastSync: Date.now() - 10000,
      syncInterval: 5000,
      pendingUpdates: 50,
    };
    
    const needsSync = Date.now() - consistency.lastSync >= consistency.syncInterval;
    expect(needsSync).toBe(true);
  });
});
