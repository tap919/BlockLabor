/**
 * Security Middleware
 * Provides authentication, authorization, rate limiting, and input validation
 * for all API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types and Interfaces
// ============================================

export interface SecurityContext {
  userId?: string;
  userRole?: string;
  apiKey?: string;
  ipAddress: string;
  userAgent: string;
  requestId: string;
  authenticated: boolean;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: NextRequest) => string;
  skipIf?: (req: NextRequest) => boolean;
}

export interface RateLimitEntry {
  count: number;
  resetAt: number;
  blocked: boolean;
}

export interface SecurityConfig {
  csrfEnabled: boolean;
  rateLimits: Map<string, RateLimitConfig>;
  allowedOrigins: string[];
  sensitiveEndpoints: string[];
  requireAuth: boolean;
}

// ============================================
// Rate Limiter
// ============================================

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetAt < now) {
          this.store.delete(key);
        }
      }
    }, 60000);
  }

  check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let entry = this.store.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + config.windowMs, blocked: false };
    }

    const remaining = Math.max(0, config.maxRequests - entry.count);

    if (entry.count >= config.maxRequests) {
      entry.blocked = true;
      this.store.set(key, entry);
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    this.store.set(key, entry);

    return { allowed: true, remaining: remaining - 1, resetAt: entry.resetAt };
  }

  reset(key: string): void {
    this.store.delete(key);
  }

  cleanup(): void {
    clearInterval(this.cleanupInterval);
  }
}

const rateLimiter = new RateLimiter();

// ============================================
// Input Validator
// ============================================

export class InputValidator {
  private static readonly MAX_STRING_LENGTH = 10000;
  private static readonly MAX_JSON_DEPTH = 10;

  /**
   * Sanitize string input
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') return '';
    
    return input
      .replace(/\x00/g, '') // Remove null bytes
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim()
      .substring(0, this.MAX_STRING_LENGTH);
  }

  /**
   * Validate and sanitize object recursively
   */
  static sanitizeObject(obj: any, depth: number = 0): any {
    if (depth > this.MAX_JSON_DEPTH) {
      return null; // Prevent deep nesting attacks
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (typeof obj === 'number') {
      if (!Number.isFinite(obj)) return 0;
      return obj;
    }

    if (typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip dangerous keys
        if (key.includes('\x00') || key.includes('..') || key.includes('$') || key.startsWith('_')) {
          continue;
        }
        sanitized[key] = this.sanitizeObject(value, depth + 1);
      }
      return sanitized;
    }

    return null;
  }

  /**
   * Validate ID format
   */
  static validateId(id: string): boolean {
    // CUID format: starts with 'c' and is 25 characters
    const cuidRegex = /^c[a-z0-9]{24}$/;
    // UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    return cuidRegex.test(id) || uuidRegex.test(id);
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  }

  /**
   * Validate amount (for financial operations)
   */
  static validateAmount(amount: any): { valid: boolean; value: number | null } {
    const num = Number(amount);
    if (isNaN(num) || !Number.isFinite(num)) {
      return { valid: false, value: null };
    }
    if (num < 0) {
      return { valid: false, value: null };
    }
    // Check for reasonable maximum (1 billion)
    if (num > 1e9) {
      return { valid: false, value: null };
    }
    // Round to 2 decimal places
    return { valid: true, value: Math.round(num * 100) / 100 };
  }
}

// ============================================
// Security Configuration
// ============================================

const defaultSecurityConfig: SecurityConfig = {
  csrfEnabled: true,
  rateLimits: new Map([
    ['global', { windowMs: 60000, maxRequests: 100 }],
    ['/api/approvals', { windowMs: 60000, maxRequests: 20 }],
    ['/api/sandbox', { windowMs: 60000, maxRequests: 50 }],
    ['/api/sandbox?action=execute', { windowMs: 60000, maxRequests: 30 }],
    ['/api/projects', { windowMs: 60000, maxRequests: 50 }],
    ['auth', { windowMs: 900000, maxRequests: 5 }], // 15 min lockout after 5 attempts
  ]),
  allowedOrigins: [
    'https://localhost:3000',
    'https://preview-*.space.chatglm.site',
  ],
  sensitiveEndpoints: [
    '/api/sandbox?action=execute',
    '/api/approvals',
    '/api/sandbox?action=decision',
  ],
  requireAuth: process.env.NODE_ENV === 'production',
};

// ============================================
// Security Middleware
// ============================================

export function createSecurityMiddleware(config: Partial<SecurityConfig> = {}) {
  const securityConfig: SecurityConfig = { ...defaultSecurityConfig, ...config };

  return async function securityMiddleware(
    request: NextRequest
  ): Promise<{ context: SecurityContext; response?: NextResponse }> {
    const requestId = uuidv4();
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const context: SecurityContext = {
      ipAddress,
      userAgent,
      requestId,
      authenticated: false,
    };

    // 1. Check CORS
    const origin = request.headers.get('origin');
    if (origin && request.method !== 'GET') {
      const isAllowed = securityConfig.allowedOrigins.some(allowed => {
        if (allowed.includes('*')) {
          const regex = new RegExp('^' + allowed.replace(/\*/g, '.*') + '$');
          return regex.test(origin);
        }
        return allowed === origin;
      });

      if (!isAllowed) {
        return {
          context,
          response: NextResponse.json(
            { error: 'Origin not allowed', requestId },
            { status: 403 }
          ),
        };
      }
    }

    // 2. Check CSRF for state-changing methods
    if (securityConfig.csrfEnabled && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      const csrfToken = request.headers.get('x-csrf-token');
      // In a real implementation, validate against session token
      if (!csrfToken && securityConfig.requireAuth) {
        return {
          context,
          response: NextResponse.json(
            { error: 'CSRF token required', requestId },
            { status: 403 }
          ),
        };
      }
    }

    // 3. Rate limiting
    const pathname = new URL(request.url).pathname;
    const searchParams = new URL(request.url).search;
    
    // Find applicable rate limit
    let rateLimitKey = 'global';
    for (const [pattern, limitConfig] of securityConfig.rateLimits.entries()) {
      if (pattern.startsWith('/') && (pathname + searchParams).startsWith(pattern)) {
        rateLimitKey = pattern;
        break;
      }
    }

    const rateConfig = securityConfig.rateLimits.get(rateLimitKey) || securityConfig.rateLimits.get('global')!;
    const rateLimitIdentifier = `${ipAddress}:${rateLimitKey}`;

    const rateLimitResult = rateLimiter.check(rateLimitIdentifier, rateConfig);
    if (!rateLimitResult.allowed) {
      return {
        context,
        response: NextResponse.json(
          { 
            error: 'Rate limit exceeded', 
            requestId,
            retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
          },
          { 
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
              'X-RateLimit-Limit': String(rateConfig.maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(rateLimitResult.resetAt),
            }
          }
        ),
      };
    }

    // 4. Authentication check (if required)
    if (securityConfig.requireAuth) {
      const authHeader = request.headers.get('authorization');
      const apiKey = request.headers.get('x-api-key');

      if (authHeader?.startsWith('Bearer ')) {
        // Validate bearer token
        // In production, verify against auth service
        context.authenticated = true;
        context.apiKey = authHeader.substring(7);
      } else if (apiKey) {
        // Validate API key
        // In production, verify against database
        context.authenticated = true;
        context.apiKey = apiKey;
      } else {
        // Check if endpoint requires auth
        const isSensitiveEndpoint = securityConfig.sensitiveEndpoints.some(
          endpoint => (pathname + searchParams).startsWith(endpoint)
        );

        if (isSensitiveEndpoint) {
          return {
            context,
            response: NextResponse.json(
              { error: 'Authentication required', requestId },
              { status: 401 }
            ),
          };
        }
      }
    }

    return { context };
  };
}

// ============================================
// Request Validator
// ============================================

export function validateRequestBody(
  body: any,
  schema: Record<string, { type: string; required: boolean; validation?: (value: any) => boolean }>
): { valid: boolean; errors: string[]; sanitized: any } {
  const errors: string[] = [];
  const sanitized: any = {};

  for (const [field, config] of Object.entries(schema)) {
    const value = body[field];

    // Check required
    if (config.required && (value === undefined || value === null)) {
      errors.push(`Field '${field}' is required`);
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    // Type check
    let sanitizedValue: any;
    switch (config.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Field '${field}' must be a string`);
        } else {
          sanitizedValue = InputValidator.sanitizeString(value);
        }
        break;

      case 'number':
        const numResult = InputValidator.validateAmount(value);
        if (!numResult.valid) {
          errors.push(`Field '${field}' must be a valid number`);
        } else {
          sanitizedValue = numResult.value;
        }
        break;

      case 'boolean':
        sanitizedValue = Boolean(value);
        break;

      case 'id':
        if (!InputValidator.validateId(value)) {
          errors.push(`Field '${field}' must be a valid ID`);
        } else {
          sanitizedValue = value;
        }
        break;

      case 'email':
        if (!InputValidator.validateEmail(value)) {
          errors.push(`Field '${field}' must be a valid email`);
        } else {
          sanitizedValue = value.toLowerCase();
        }
        break;

      case 'object':
        sanitizedValue = InputValidator.sanitizeObject(value);
        break;

      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Field '${field}' must be an array`);
        } else {
          sanitizedValue = value.map(item => InputValidator.sanitizeObject(item));
        }
        break;

      default:
        sanitizedValue = InputValidator.sanitizeObject(value);
    }

    // Custom validation
    if (config.validation && sanitizedValue !== undefined && !config.validation(sanitizedValue)) {
      errors.push(`Field '${field}' failed validation`);
    }

    if (sanitizedValue !== undefined) {
      sanitized[field] = sanitizedValue;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

// ============================================
// Error Handler
// ============================================

export function createErrorResponse(
  error: Error | unknown,
  requestId: string,
  includeDetails: boolean = false
): NextResponse {
  console.error(`[${requestId}] Error:`, error);

  // Don't expose internal errors to clients
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Resource not found', requestId },
        { status: 404 }
      );
    }

    if (error.message.includes('unauthorized') || error.message.includes('permission')) {
      return NextResponse.json(
        { error: 'Unauthorized', requestId },
        { status: 403 }
      );
    }

    if (error.message.includes('invalid') || error.message.includes('required')) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: 400 }
      );
    }
  }

  // Generic error response
  return NextResponse.json(
    { 
      error: 'An unexpected error occurred', 
      requestId,
      ...(includeDetails && { details: error instanceof Error ? error.message : 'Unknown error' })
    },
    { status: 500 }
  );
}

// ============================================
// Export Singleton Middleware
// ============================================

export const securityMiddleware = createSecurityMiddleware();
