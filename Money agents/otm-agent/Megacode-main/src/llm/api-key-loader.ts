/**
 * API Key Loader for MegaCode CLI
 * 
 * Loads API keys from the APIs folder and environment variables.
 * Supports multiple API providers with fallback mechanisms.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { logger } from "../utils/logger";
import { validator } from "../utils/validation";

export interface APIKeys {
  deepseek?: string;
  claude?: string;
  grok?: string;
  perplexity?: string;
  openai?: string;
  mistral?: string;
  ollama?: string;
  gemini?: string;
  [key: string]: string | undefined;
}

export interface APIKeyConfig {
  /** Path to APIs folder */
  apisFolder?: string;
  /** Environment variable prefix */
  envPrefix?: string;
  /** Enable debug logging */
  debug?: boolean;
}

const DEFAULT_CONFIG: APIKeyConfig = {
  apisFolder: join(process.cwd(), "APIs"),
  envPrefix: "MEGACODE_",
  debug: false,
};

export class APIKeyLoader {
  private config: APIKeyConfig;
  private keys: APIKeys = {};

  constructor(config: Partial<APIKeyConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadKeys();
  }

  /** Load all API keys from various sources */
  private loadKeys(): void {
    // Load from environment variables first
    this.loadFromEnvironment();
    
    // Load from APIs folder
    this.loadFromAPIsFolder();
    
    // Load from default locations
    this.loadFromDefaults();
    
    if (this.config.debug) {
      console.log("[APIKeyLoader] Loaded keys for:", Object.keys(this.keys).join(", "));
    }
  }

  /** Load API keys from environment variables */
  private loadFromEnvironment(): void {
    const prefix = this.config.envPrefix || "MEGACODE_";
    
    // Standard environment variables
    const envMappings: Record<string, keyof APIKeys> = {
      DEEPSEEK_API_KEY: "deepseek",
      ANTHROPIC_API_KEY: "claude",
      XAI_API_KEY: "grok",
      PERPLEXITY_API_KEY: "perplexity",
      OPENAI_API_KEY: "openai",
      MISTRAL_API_KEY: "mistral",
      OLLAMA_API_KEY: "ollama",
      GEMINI_API_KEY: "gemini",
    };
    
    // Check both standard and prefixed versions
    for (const [envVar, keyName] of Object.entries(envMappings)) {
      const value = process.env[envVar] || process.env[`${prefix}${envVar}`];
      if (value && !this.keys[keyName]) {
        this.keys[keyName] = value;
      }
    }
  }

  /** Load API keys from APIs folder with security checks */
  private loadFromAPIsFolder(): void {
    const apisFolder = this.config.apisFolder;
    if (!apisFolder || !existsSync(apisFolder)) {
      if (this.config.debug) {
        logger.debug(`APIs folder not found: ${apisFolder}`);
      }
      return;
    }

    try {
      // Security check: Ensure folder is not a symlink to sensitive location
      this.validateFolderSecurity(apisFolder);
      
      const files = readdirSync(apisFolder);
      
      // Read text files with security checks
      for (const file of files) {
        const filePath = join(apisFolder, file);
        
        // Security check: Validate file before reading
        if (!this.isSafeFile(filePath)) {
          logger.warn(`Skipping potentially unsafe file: ${file}`);
          continue;
        }
        
        if (file.endsWith('.txt') || file.endsWith('.log')) {
          this.parseTextFile(filePath);
        }
      }
      
      // Check for specific known files
      this.checkSpecificFiles(apisFolder);
      
    } catch (error) {
      logger.error(`Error reading APIs folder: ${error}`, { error: error.message });
    }
  }

  /** Validate folder security */
  private validateFolderSecurity(folderPath: string): void {
    try {
      const stats = statSync(folderPath);
      
      // Check if it's a symlink (potential security risk)
      if (stats.isSymbolicLink()) {
        logger.warn(`APIs folder is a symlink: ${folderPath}`);
        // In production, we might want to reject symlinks
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`APIs folder cannot be a symlink in production: ${folderPath}`);
        }
      }
      
      // Check folder permissions (world-writable folders are risky)
      // Note: This check is platform-specific and simplified
      const mode = stats.mode;
      const isWorldWritable = (mode & 0o002) !== 0;
      if (isWorldWritable) {
        logger.warn(`APIs folder is world-writable: ${folderPath}`);
      }
      
    } catch (error) {
      logger.error(`Failed to validate folder security: ${error}`, { folderPath });
      throw error;
    }
  }

  /** Check if file is safe to read */
  private isSafeFile(filePath: string): boolean {
    try {
      const stats = statSync(filePath);
      
      // Check file size (very large files might be malicious)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (stats.size > maxSize) {
        logger.warn(`File too large to read safely: ${filePath} (${stats.size} bytes)`);
        return false;
      }
      
      // Check if it's a regular file (not a device, pipe, etc.)
      if (!stats.isFile()) {
        logger.warn(`Not a regular file: ${filePath}`);
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`Failed to check file safety: ${error}`, { filePath });
      return false;
    }
  }

  /** Parse text files for API keys */
  private parseTextFile(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        this.parseLineForKeys(line);
      }
    } catch (error) {
      // Ignore read errors
    }
  }

  /** Parse a single line for API keys */
  private parseLineForKeys(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Common patterns in API key files
    const patterns: Array<[RegExp, keyof APIKeys]> = [
      [/deepseek.*key.*[:=]\s*([\w-]+)/i, "deepseek"],
      [/claude.*key.*[:=]\s*([\w-]+)/i, "claude"],
      [/anthropic.*key.*[:=]\s*([\w-]+)/i, "claude"],
      [/grok.*key.*[:=]\s*([\w-]+)/i, "grok"],
      [/xai.*key.*[:=]\s*([\w-]+)/i, "grok"],
      [/perplexity.*key.*[:=]\s*([\w-]+)/i, "perplexity"],
      [/openai.*key.*[:=]\s*([\w-]+)/i, "openai"],
      [/mistral.*key.*[:=]\s*([\w-]+)/i, "mistral"],
      [/ollama.*key.*[:=]\s*([\w-]+)/i, "ollama"],
      [/gemini.*key.*[:=]\s*([\w-]+)/i, "gemini"],
      [/sk-[a-zA-Z0-9]{48,}/, "openai"], // OpenAI key pattern
      [/sk-[a-zA-Z0-9]{20,}/, "deepseek"], // DeepSeek key pattern
    ];
    
    for (const [pattern, keyName] of patterns) {
      const match = trimmed.match(pattern);
      if (match && match[1] && !this.keys[keyName]) {
        const keyValue = match[1].trim();
        
        try {
          // Validate API key format
          validator.validateAPIKey(keyValue, String(keyName));
          
          this.keys[keyName] = keyValue;
          if (this.config.debug) {
            logger.debug(`Found ${keyName} key in file`);
          }
        } catch (validationError) {
          logger.warn(`Invalid API key format for ${keyName}: ${validationError.message}`);
          // Don't store invalid keys
        }
        break;
      }
    }
  }

  /** Check for specific known files */
  private checkSpecificFiles(apisFolder: string): void {
    const specificFiles = [
      { file: "api keys.txt", parser: this.parseApiKeysTxt.bind(this) },
      { file: "mistral.txt", parser: this.parseMistralTxt.bind(this) },
      { file: "OLLAMA API.txt", parser: this.parseOllamaTxt.bind(this) },
    ];
    
    for (const { file, parser } of specificFiles) {
      const filePath = join(apisFolder, file);
      if (existsSync(filePath)) {
        parser(filePath);
      }
    }
  }

  /** Parse api keys.txt file */
  private parseApiKeysTxt(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // Look for OpenAI key (common pattern)
      for (const line of lines) {
        if (line.includes('sk-proj-') && !this.keys.openai) {
          this.keys.openai = line.trim();
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /** Parse mistral.txt file */
  private parseMistralTxt(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.includes('Mistral api:') && !this.keys.mistral) {
          const key = line.split('Mistral api:')[1]?.trim();
          if (key) {
            this.keys.mistral = key;
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /** Parse OLLAMA API.txt file */
  private parseOllamaTxt(filePath: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.includes('OLLAMA API:') && !this.keys.ollama) {
          const key = line.split('OLLAMA API:')[1]?.trim();
          if (key) {
            this.keys.ollama = key;
          }
        }
        if (line.includes('Mistral API:') && !this.keys.mistral) {
          const key = line.split('Mistral API:')[1]?.trim();
          if (key) {
            this.keys.mistral = key;
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  /** Load from default locations (hardcoded defaults) */
  private loadFromDefaults(): void {
    // Intentionally no hard-coded API keys.
    // Keys must come from env vars or the APIs/ folder.
  }

  /** Get a specific API key */
  getKey(provider: keyof APIKeys): string | undefined {
    return this.keys[provider];
  }

  /** Get all API keys */
  getAllKeys(): APIKeys {
    return { ...this.keys };
  }

  /** Check if a specific API key is available */
  hasKey(provider: keyof APIKeys): boolean {
    return !!this.keys[provider];
  }

  /** Get status of all API keys (for display) */
  getKeyStatus(): Record<string, { available: boolean; keyPreview: string }> {
    const status: Record<string, { available: boolean; keyPreview: string }> = {};
    
    for (const [provider, key] of Object.entries(this.keys)) {
      status[provider] = {
        available: !!key,
        keyPreview: key ? `${key.substring(0, 8)}...` : "",
      };
    }
    
    return status;
  }

  /** Set an API key manually */
  setKey(provider: keyof APIKeys, key: string): void {
    this.keys[provider] = key;
  }

  /** Clear all API keys */
  clearKeys(): void {
    this.keys = {};
  }

  /** Reload API keys */
  reload(): void {
    this.clearKeys();
    this.loadKeys();
  }
}