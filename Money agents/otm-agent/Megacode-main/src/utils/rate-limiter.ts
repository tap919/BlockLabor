/**
 * Rate Limiter for MegaCode CLI
 * 
 * Provides rate limiting and timeout handling to prevent:
 * - API abuse
 * - Resource exhaustion
 * - Denial of service
 */

import { logger } from "./logger";

export interface RateLimitConfig {
  /** Maximum requests per time window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum concurrent requests */
  maxConcurrent: number;
  /** Request timeout in milliseconds */
  requestTimeout: number;
  /** Enable/disable rate limiting */
  enabled: boolean;
}

export interface RateLimitStats {
  currentRequests: number;
  concurrentRequests: number;
  blockedRequests: number;
  totalRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 100, // 100 requests per window
  windowMs: 60000, // 1 minute
  maxConcurrent: 10, // 10 concurrent requests
  requestTimeout: 30000, // 30 seconds
  enabled: true,
};

export class RateLimiter {
  private config: RateLimitConfig;
  private requestTimestamps: number[] = [];
  private concurrentRequests = 0;
  private blockedRequests = 0;
  private totalRequests = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Setup cleanup interval to remove old timestamps
    this.setupCleanup();
  }

  private setupCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Clean up old timestamps every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldTimestamps();
    }, 60000);
    
    // Ensure cleanup on process exit
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  private cleanupOldTimestamps(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    
    this.requestTimestamps = this.requestTimestamps.filter(
      timestamp => timestamp > cutoff
    );
    
    logger.debug(`Rate limiter cleanup: ${this.requestTimestamps.length} requests in window`);
  }

  /** Check if a request is allowed */
  async checkLimit(identifier: string = 'default'): Promise<boolean> {
    this.totalRequests++;
    
    if (!this.config.enabled) {
      return true;
    }

    const now = Date.now();
    
    // Check concurrent requests
    if (this.concurrentRequests >= this.config.maxConcurrent) {
      this.blockedRequests++;
      logger.warn(`Rate limit exceeded: too many concurrent requests`, {
        identifier,
        concurrent: this.concurrentRequests,
        maxConcurrent: this.config.maxConcurrent,
      });
      return false;
    }
    
    // Clean up old timestamps for this check
    const cutoff = now - this.config.windowMs;
    const recentRequests = this.requestTimestamps.filter(
      timestamp => timestamp > cutoff
    );
    
    // Check requests per window
    if (recentRequests.length >= this.config.maxRequests) {
      this.blockedRequests++;
      logger.warn(`Rate limit exceeded: too many requests in time window`, {
        identifier,
        recentRequests: recentRequests.length,
        maxRequests: this.config.maxRequests,
        windowMs: this.config.windowMs,
      });
      return false;
    }
    
    // Add current request timestamp
    this.requestTimestamps.push(now);
    this.concurrentRequests++;
    
    logger.debug(`Request allowed`, {
      identifier,
      recentRequests: recentRequests.length + 1,
      concurrent: this.concurrentRequests,
    });
    
    return true;
  }

  /** Release a request slot (call when request completes) */
  release(): void {
    if (this.concurrentRequests > 0) {
      this.concurrentRequests--;
    }
  }

  /** Execute a function with rate limiting and timeout */
  async execute<T>(
    fn: () => Promise<T>,
    identifier: string = 'default',
    timeoutMs?: number
  ): Promise<T> {
    const timeout = timeoutMs || this.config.requestTimeout;
    
    // Check rate limit
    const allowed = await this.checkLimit(identifier);
    if (!allowed) {
      throw new Error(`Rate limit exceeded for ${identifier}`);
    }
    
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`Request timeout after ${timeout}ms`));
        }, timeout);
      });
      
      // Execute function with timeout
      const result = await Promise.race([
        fn(),
        timeoutPromise,
      ]);
      
      return result;
      
    } catch (error) {
      logger.error(`Request failed: ${error.message}`, {
        identifier,
        error: error.message,
      });
      throw error;
      
    } finally {
      // Cleanup
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.release();
    }
  }

  /** Get current statistics */
  getStats(): RateLimitStats {
    const now = Date.now();
    const cutoff = now - this.config.windowMs;
    const recentRequests = this.requestTimestamps.filter(
      timestamp => timestamp > cutoff
    );
    
    return {
      currentRequests: recentRequests.length,
      concurrentRequests: this.concurrentRequests,
      blockedRequests: this.blockedRequests,
      totalRequests: this.totalRequests,
    };
  }

  /** Update configuration */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    this.setupCleanup();
  }

  /** Get current configuration */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  /** Reset all counters */
  reset(): void {
    this.requestTimestamps = [];
    this.concurrentRequests = 0;
    this.blockedRequests = 0;
    this.totalRequests = 0;
  }

  /** Cleanup resources */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Default rate limiter instance
export const rateLimiter = new RateLimiter();

// Convenience function for rate-limited execution
export async function rateLimited<T>(
  fn: () => Promise<T>,
  identifier?: string,
  timeoutMs?: number
): Promise<T> {
  return rateLimiter.execute(fn, identifier, timeoutMs);
}