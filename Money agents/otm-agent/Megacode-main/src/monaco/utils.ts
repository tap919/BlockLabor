import * as crypto from "crypto";

export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

export interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface HealthStatus {
  isHealthy: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  latencyMs?: number;
}

export interface ConnectionPoolConfig {
  minConnections: number;
  maxConnections: number;
  acquireTimeoutMs: number;
  idleTimeoutMs: number;
  healthCheckIntervalMs: number;
}

export interface ValidationRule {
  type: "required" | "pattern" | "range" | "enum" | "custom";
  value?: unknown;
  message?: string;
  validator?: (value: unknown) => boolean;
}

export interface ValidationSchema {
  [key: string]: ValidationRule[];
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export class RetryableError extends Error {
  constructor(
    message: string,
    public retryable: boolean = true,
  ) {
    super(message);
    this.name = "RetryableError";
  }
}

export function validateInput(data: unknown, schema: ValidationSchema): void {
  if (typeof data !== "object" || data === null) {
    throw new ValidationError("Input must be an object");
  }

  const dataObj = data as Record<string, unknown>;

  for (const [field, rules] of Object.entries(schema)) {
    const value = dataObj[field];

    for (const rule of rules) {
      switch (rule.type) {
        case "required":
          if (value === undefined || value === null) {
            throw new ValidationError(
              rule.message || `${field} is required`,
              field,
            );
          }
          break;

        case "pattern":
          if (typeof value === "string" && rule.value) {
            const regex = new RegExp(rule.value as string);
            if (!regex.test(value)) {
              throw new ValidationError(
                rule.message || `${field} must match pattern`,
                field,
              );
            }
          }
          break;

        case "range":
          if (
            typeof value === "number" &&
            rule.value &&
            typeof rule.value === "object"
          ) {
            const { min, max } = rule.value as { min?: number; max?: number };
            if (min !== undefined && value < min) {
              throw new ValidationError(
                rule.message || `${field} must be at least ${min}`,
                field,
              );
            }
            if (max !== undefined && value > max) {
              throw new ValidationError(
                rule.message || `${field} must be at most ${max}`,
                field,
              );
            }
          }
          break;

        case "enum":
          if (!Array.isArray(rule.value) || !rule.value.includes(value)) {
            throw new ValidationError(
              rule.message ||
                `${field} must be one of ${(rule.value as string[])?.join(", ")}`,
              field,
            );
          }
          break;

        case "custom":
          if (rule.validator && !rule.validator(value)) {
            throw new ValidationError(
              rule.message || `${field} failed validation`,
              field,
            );
          }
          break;
      }
    }
  }
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  let lastError: Error | undefined;
  let delay = options.initialDelayMs;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isRetryable =
        !options.retryableErrors ||
        options.retryableErrors.some((e) => lastError?.message.includes(e));

      if (!isRetryable || attempt === options.maxAttempts) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * options.backoffMultiplier, options.maxDelayMs);
    }
  }

  throw lastError;
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtlMs: number;

  constructor(defaultTtlMs: number = 60000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }

  size(): number {
    return this.cache.size;
  }
}

export class SecureConfig {
  private encryptionKey: Buffer | null = null;

  constructor(encryptionKey?: string) {
    if (encryptionKey) {
      this.encryptionKey = crypto
        .createHash("sha256")
        .update(encryptionKey)
        .digest();
    }
  }

  encrypt(value: string): string {
    if (!this.encryptionKey) {
      return value;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv("aes-256-cbc", this.encryptionKey, iv);
    let encrypted = cipher.update(value, "utf8", "hex");
    encrypted += cipher.final("hex");

    return iv.toString("hex") + ":" + encrypted;
  }

  decrypt(encryptedValue: string): string {
    if (!this.encryptionKey) {
      return encryptedValue;
    }

    const parts = encryptedValue.split(":");
    if (parts.length !== 2) {
      throw new Error("Invalid encrypted value format");
    }

    const iv = Buffer.from(parts[0], "hex");
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      this.encryptionKey,
      iv,
    );
    let decrypted = decipher.update(parts[1], "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  getApiKey(keyName: string): string | undefined {
    const value = process.env[keyName];
    if (!value) return undefined;

    if (value.startsWith("enc:")) {
      return this.decrypt(value.substring(4));
    }

    return value;
  }

  setApiKey(keyName: string, value: string, encrypt: boolean = false): void {
    if (encrypt) {
      process.env[keyName] = "enc:" + this.encrypt(value);
    } else {
      process.env[keyName] = value;
    }
  }
}

export class HealthMonitor {
  private status: HealthStatus = {
    isHealthy: true,
    lastCheck: Date.now(),
    consecutiveFailures: 0,
  };

  private failureThreshold: number;
  private recoveryThreshold: number;

  constructor(failureThreshold: number = 5, recoveryThreshold: number = 3) {
    this.failureThreshold = failureThreshold;
    this.recoveryThreshold = recoveryThreshold;
  }

  recordSuccess(latencyMs?: number): void {
    this.status.consecutiveFailures = Math.max(
      0,
      this.status.consecutiveFailures - 1,
    );
    this.status.isHealthy =
      this.status.consecutiveFailures < this.failureThreshold;
    this.status.lastCheck = Date.now();
    this.status.latencyMs = latencyMs;
  }

  recordFailure(): void {
    this.status.consecutiveFailures++;
    this.status.isHealthy =
      this.status.consecutiveFailures >= this.failureThreshold;
    this.status.lastCheck = Date.now();
  }

  getStatus(): HealthStatus {
    return { ...this.status };
  }

  isHealthy(): boolean {
    return this.status.isHealthy;
  }

  reset(): void {
    this.status = {
      isHealthy: true,
      lastCheck: Date.now(),
      consecutiveFailures: 0,
    };
  }
}

export class LazyLoader<T> {
  private instance: T | null = null;
  private loading: Promise<T> | null = null;
  private loader: () => Promise<T>;

  constructor(loader: () => Promise<T>) {
    this.loader = loader;
  }

  async get(): Promise<T> {
    if (this.instance) {
      return this.instance;
    }

    if (this.loading) {
      return this.loading;
    }

    this.loading = this.loader().then((instance) => {
      this.instance = instance;
      this.loading = null;
      return instance;
    });

    return this.loading;
  }

  isLoaded(): boolean {
    return this.instance !== null;
  }

  reset(): void {
    this.instance = null;
    this.loading = null;
  }
}

export class ConnectionPool {
  private connections: unknown[] = [];
  private available: unknown[] = [];
  private pending: Array<{
    resolve: (conn: unknown) => void;
    reject: (error: Error) => void;
  }> = [];
  private config: ConnectionPoolConfig;
  private creating: number = 0;
  private healthMonitor: HealthMonitor;
  private closed: boolean = false;

  constructor(
    config: ConnectionPoolConfig,
    private factory: () => Promise<unknown>,
    private destroyer?: (conn: unknown) => Promise<void>,
  ) {
    this.config = config;
    this.healthMonitor = new HealthMonitor();
  }

  async acquire(): Promise<unknown> {
    if (this.closed) {
      throw new Error("Connection pool is closed");
    }

    if (this.available.length > 0) {
      const conn = this.available.pop()!;
      return conn;
    }

    if (
      this.connections.length < this.config.maxConnections &&
      this.creating < this.config.maxConnections - this.connections.length
    ) {
      this.creating++;
      try {
        const conn = await Promise.race([
          this.factory(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Connection creation timeout")),
              this.config.acquireTimeoutMs,
            ),
          ),
        ]);
        this.connections.push(conn);
        this.creating--;
        return conn;
      } catch (error) {
        this.creating--;
        throw error;
      }
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.pending.findIndex((p) => p.resolve === resolve);
        if (index !== -1) {
          this.pending.splice(index, 1);
        }
        reject(new Error("Connection acquisition timeout"));
      }, this.config.acquireTimeoutMs);

      this.pending.push({
        resolve: (conn) => {
          clearTimeout(timeout);
          resolve(conn);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
      });
    });
  }

  release(conn: unknown): void {
    if (this.closed) {
      if (this.destroyer) {
        this.destroyer(conn);
      }
      return;
    }

    const pending = this.pending.shift();
    if (pending) {
      pending.resolve(conn);
    } else {
      this.available.push(conn);
    }
  }

  async close(): Promise<void> {
    this.closed = true;

    for (const conn of this.connections) {
      if (this.destroyer) {
        await this.destroyer(conn);
      }
    }

    this.connections = [];
    this.available = [];
    this.pending = [];
  }

  getStats(): {
    total: number;
    available: number;
    pending: number;
    creating: number;
  } {
    return {
      total: this.connections.length,
      available: this.available.length,
      pending: this.pending.length,
      creating: this.creating,
    };
  }
}

export function createConfigProfile(
  base: Record<string, unknown>,
  env: string,
): Record<string, unknown> {
  const profiles: Record<string, Record<string, unknown>> = {
    development: {
      logLevel: "debug",
      port: 9876,
      webResearch: true,
      autoDiscoverTools: true,
      connectionTimeout: 30000,
      retryAttempts: 3,
    },
    production: {
      logLevel: "warn",
      port: 9876,
      webResearch: false,
      autoDiscoverTools: true,
      connectionTimeout: 10000,
      retryAttempts: 5,
    },
    test: {
      logLevel: "error",
      port: 9877,
      webResearch: false,
      autoDiscoverTools: false,
      connectionTimeout: 5000,
      retryAttempts: 1,
    },
  };

  const profile = profiles[env] || profiles.development;
  return { ...base, ...profile };
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => fn(...args), delayMs);
  };
}

export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number,
): (...args: Parameters<T>) => void {
  let lastRun = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limitMs) {
      lastRun = now;
      fn(...args);
    }
  };
}
