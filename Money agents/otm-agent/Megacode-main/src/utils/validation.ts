/**
 * Input Validation and Sanitization for MegaCode CLI
 * 
 * Provides security-focused validation for:
 * - LLM request validation
 * - API key validation
 * - Input sanitization
 * - Rate limiting
 */

import { LLMCompletionRequest, LLMMessage } from "../llm/provider";
import { logger } from "./logger";

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export interface ValidationOptions {
  /** Maximum message length in characters */
  maxMessageLength?: number;
  /** Maximum messages per request */
  maxMessages?: number;
  /** Allowed model names (if empty, all models allowed) */
  allowedModels?: string[];
  /** Maximum temperature value */
  maxTemperature?: number;
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Enable strict validation (throws on warnings) */
  strict?: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  maxMessageLength: 100000, // 100k characters
  maxMessages: 100,
  maxTemperature: 2.0,
  maxTokens: 1000000, // 1M tokens
  strict: false,
};

export class InputValidator {
  private options: ValidationOptions;

  constructor(options: ValidationOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /** Validate LLM completion request */
  validateCompletionRequest(request: LLMCompletionRequest): void {
    const errors: string[] = [];

    // Validate messages
    if (!request.messages || !Array.isArray(request.messages)) {
      errors.push("Messages must be an array");
    } else {
      if (request.messages.length === 0) {
        errors.push("At least one message is required");
      }
      
      if (request.messages.length > (this.options.maxMessages || 100)) {
        errors.push(`Too many messages (max: ${this.options.maxMessages})`);
      }

      // Validate each message
      request.messages.forEach((msg, index) => {
        const msgErrors = this.validateMessage(msg, index);
        errors.push(...msgErrors);
      });
    }

    // Validate model
    if (request.model) {
      const modelErrors = this.validateModel(request.model);
      errors.push(...modelErrors);
    }

    // Validate temperature
    if (request.temperature !== undefined) {
      const tempErrors = this.validateTemperature(request.temperature);
      errors.push(...tempErrors);
    }

    // Validate max tokens
    if (request.maxTokens !== undefined) {
      const tokenErrors = this.validateMaxTokens(request.maxTokens);
      errors.push(...tokenErrors);
    }

    // Log validation warnings
    if (errors.length > 0) {
      const errorMessage = `Validation failed: ${errors.join("; ")}`;
      logger.warn("LLM request validation warnings", {
        errors,
        request: this.sanitizeRequestForLogging(request),
      });

      if (this.options.strict) {
        throw new ValidationError(errorMessage);
      }
    }
  }

  /** Validate individual message */
  private validateMessage(message: LLMMessage, index: number): string[] {
    const errors: string[] = [];

    // Validate role
    if (!["system", "user", "assistant"].includes(message.role)) {
      errors.push(`Message ${index}: Invalid role '${message.role}'`);
    }

    // Validate content
    if (typeof message.content !== "string") {
      errors.push(`Message ${index}: Content must be a string`);
    } else {
      if (message.content.length === 0) {
        errors.push(`Message ${index}: Content cannot be empty`);
      }
      
      if (message.content.length > (this.options.maxMessageLength || 100000)) {
        errors.push(`Message ${index}: Content too long (max: ${this.options.maxMessageLength} chars)`);
      }

      // Check for potentially malicious content
      const securityErrors = this.checkContentSecurity(message.content, index);
      errors.push(...securityErrors);
    }

    return errors;
  }

  /** Check message content for security issues */
  private checkContentSecurity(content: string, index: number): string[] {
    const warnings: string[] = [];
    
    // Check for excessive whitespace (potential DoS)
    const whitespaceRatio = (content.match(/\s/g) || []).length / content.length;
    if (whitespaceRatio > 0.8) {
      warnings.push(`Message ${index}: High whitespace ratio (${whitespaceRatio.toFixed(2)})`);
    }

    // Check for repeated patterns
    const repeatedPattern = this.detectRepeatedPatterns(content);
    if (repeatedPattern) {
      warnings.push(`Message ${index}: Detected repeated pattern '${repeatedPattern}'`);
    }

    // Check for potential injection attempts
    const injectionPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /eval\s*\(/i,
      /document\./i,
      /window\./i,
      /alert\s*\(/i,
      /prompt\s*\(/i,
      /confirm\s*\(/i,
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(content)) {
        warnings.push(`Message ${index}: Potential injection pattern detected`);
        break;
      }
    }

    return warnings;
  }

  /** Detect repeated patterns in content */
  private detectRepeatedPatterns(content: string): string | null {
    // Simple pattern detection for repeated strings
    const maxPatternLength = 100;
    for (let length = 10; length <= maxPatternLength; length++) {
      if (content.length < length * 3) break;
      
      for (let i = 0; i <= content.length - length * 3; i++) {
        const pattern = content.substring(i, i + length);
        const next = content.substring(i + length, i + length * 2);
        const next2 = content.substring(i + length * 2, i + length * 3);
        
        if (pattern === next && pattern === next2) {
          return pattern.length > 50 ? pattern.substring(0, 50) + "..." : pattern;
        }
      }
    }
    return null;
  }

  /** Validate model name */
  private validateModel(model: string): string[] {
    const errors: string[] = [];

    if (typeof model !== "string") {
      errors.push("Model must be a string");
      return errors;
    }

    if (model.length > 100) {
      errors.push("Model name too long");
    }

    // Check for suspicious characters in model name
    if (!/^[a-zA-Z0-9\-_\.]+$/.test(model)) {
      errors.push("Model name contains invalid characters");
    }

    // Check against allowed models if specified
    if (this.options.allowedModels && this.options.allowedModels.length > 0) {
      if (!this.options.allowedModels.includes(model)) {
        errors.push(`Model '${model}' is not in allowed list`);
      }
    }

    return errors;
  }

  /** Validate temperature */
  private validateTemperature(temperature: number): string[] {
    const errors: string[] = [];

    if (typeof temperature !== "number") {
      errors.push("Temperature must be a number");
      return errors;
    }

    if (temperature < 0) {
      errors.push("Temperature cannot be negative");
    }

    if (temperature > (this.options.maxTemperature || 2.0)) {
      errors.push(`Temperature too high (max: ${this.options.maxTemperature})`);
    }

    return errors;
  }

  /** Validate max tokens */
  private validateMaxTokens(maxTokens: number): string[] {
    const errors: string[] = [];

    if (typeof maxTokens !== "number") {
      errors.push("Max tokens must be a number");
      return errors;
    }

    if (maxTokens < 1) {
      errors.push("Max tokens must be at least 1");
    }

    if (maxTokens > (this.options.maxTokens || 1000000)) {
      errors.push(`Max tokens too high (max: ${this.options.maxTokens})`);
    }

    return errors;
  }

  /** Validate API key format */
  validateAPIKey(key: string, provider: string): void {
    if (typeof key !== "string") {
      throw new ValidationError("API key must be a string", "apiKey", key);
    }

    if (key.length === 0) {
      throw new ValidationError("API key cannot be empty", "apiKey", "[empty]");
    }

    // Provider-specific validation
    switch (provider.toLowerCase()) {
      case "openai":
      case "deepseek":
        if (!key.startsWith("sk-")) {
          throw new ValidationError("Invalid OpenAI/DeepSeek API key format", "apiKey", key.substring(0, 10) + "...");
        }
        if (key.length < 20) {
          throw new ValidationError("API key too short", "apiKey", key.substring(0, 10) + "...");
        }
        break;
      
      case "anthropic":
      case "claude":
        if (!/^sk-[a-zA-Z0-9\-_]+$/.test(key)) {
          throw new ValidationError("Invalid Anthropic API key format", "apiKey", key.substring(0, 10) + "...");
        }
        break;
      
      case "perplexity":
        if (key.length < 20) {
          throw new ValidationError("Perplexity API key too short", "apiKey", key.substring(0, 10) + "...");
        }
        break;
      
      // Add more provider validations as needed
    }

    // Check for obvious fake keys
    if (key.includes("example") || key.includes("test") || key.includes("fake")) {
      logger.warn("Potential fake API key detected", { provider });
    }
  }

  /** Sanitize request for logging (remove sensitive data) */
  sanitizeRequestForLogging(request: LLMCompletionRequest): Partial<LLMCompletionRequest> {
    const sanitized: Partial<LLMCompletionRequest> = {
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      stream: request.stream,
    };

    // Include message count but not content
    if (request.messages) {
      sanitized.messages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content ? `[${msg.content.length} chars]` : "[empty]",
      }));
    }

    return sanitized;
  }

  /** Sanitize error message (remove sensitive data) */
  sanitizeErrorMessage(error: Error): string {
    let message = error.message;
    
    // Remove API keys from error messages
    message = message.replace(/sk-[a-zA-Z0-9]{20,}/g, "[REDACTED_API_KEY]");
    message = message.replace(/[A-Za-z0-9]{32,}\.[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]");
    
    return message;
  }

  /** Update validation options */
  updateOptions(options: Partial<ValidationOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /** Get current validation options */
  getOptions(): ValidationOptions {
    return { ...this.options };
  }
}

// Default validator instance
export const validator = new InputValidator();