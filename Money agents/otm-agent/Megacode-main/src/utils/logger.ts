/**
 * Secure Logger for MegaCode CLI
 * 
 * Provides structured logging with security considerations:
 * - Redacts sensitive information (API keys, tokens)
 * - Configurable log levels
 * - File and console output options
 * - No sensitive data in production logs
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Enable console output */
  console: boolean;
  /** File path for log output (optional) */
  file?: string;
  /** Redact sensitive information */
  redactSensitive: boolean;
  /** Application name for log context */
  appName: string;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
  console: true,
  redactSensitive: true,
  appName: 'megacode',
};

const LOG_LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/** Patterns for sensitive data that should be redacted */
const SENSITIVE_PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g, // OpenAI/DeepSeek keys
  /[A-Za-z0-9]{32,}\.[A-Za-z0-9_-]+/g, // JWT/OAuth tokens
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, // UUIDs
  /[A-Za-z0-9+/]{40,}/g, // Base64 encoded secrets
  /password=["']?[^"'\s]+["']?/gi,
  /api[_-]?key=["']?[^"'\s]+["']?/gi,
  /token=["']?[^"'\s]+["']?/gi,
  /secret=["']?[^"'\s]+["']?/gi,
];

export class Logger {
  private config: LoggerConfig;
  private fileStream: NodeJS.WriteStream | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    if (this.config.file) {
      this.setupFileLogging();
    }
  }

  private setupFileLogging(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const logDir = path.dirname(this.config.file!);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      
      this.fileStream = fs.createWriteStream(this.config.file!, { flags: 'a' });
      
      // Handle stream errors
      this.fileStream.on('error', (err) => {
        this.internalLog('error', `File logging error: ${err.message}`, {}, false);
      });
    } catch (error) {
      this.internalLog('error', `Failed to setup file logging: ${error}`, {}, false);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] <= LOG_LEVELS[this.config.level];
  }

  private redactSensitive(text: string): string {
    if (!this.config.redactSensitive) return text;
    
    let redacted = text;
    for (const pattern of SENSITIVE_PATTERNS) {
      redacted = redacted.replace(pattern, '[REDACTED]');
    }
    return redacted;
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    meta: Record<string, unknown> = {}
  ): string {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 
      ? ` ${JSON.stringify(this.redactSensitive(JSON.stringify(meta)))}`
      : '';
    
    const redactedMessage = this.redactSensitive(message);
    return `[${timestamp}] [${this.config.appName}] [${level.toUpperCase()}] ${redactedMessage}${metaStr}`;
  }

  private internalLog(
    level: LogLevel,
    message: string,
    meta: Record<string, unknown> = {},
    redact: boolean = true
  ): void {
    if (!this.shouldLog(level)) return;
    
    const formatted = this.formatMessage(level, message, meta);
    
    if (this.config.console) {
      const consoleMethod = level === 'error' ? console.error :
                          level === 'warn' ? console.warn :
                          level === 'info' ? console.info :
                          console.log;
      consoleMethod(formatted);
    }
    
    if (this.fileStream) {
      this.fileStream.write(formatted + '\n');
    }
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.internalLog('debug', message, meta);
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.internalLog('info', message, meta);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.internalLog('warn', message, meta);
  }

  error(message: string, meta: Record<string, unknown> = {}): void {
    this.internalLog('error', message, meta);
  }

  /** Log without redaction (use carefully) */
  secure(message: string, meta: Record<string, unknown> = {}): void {
    this.internalLog('info', message, meta, false);
  }

  /** Update configuration */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get current configuration */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /** Cleanup resources */
  close(): void {
    if (this.fileStream) {
      this.fileStream.end();
      this.fileStream = null;
    }
  }
}

// Default logger instance
export const logger = new Logger();

// Convenience functions
export const debug = (message: string, meta?: Record<string, unknown>) => logger.debug(message, meta);
export const info = (message: string, meta?: Record<string, unknown>) => logger.info(message, meta);
export const warn = (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta);
export const error = (message: string, meta?: Record<string, unknown>) => logger.error(message, meta);
export const secure = (message: string, meta?: Record<string, unknown>) => logger.secure(message, meta);