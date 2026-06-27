/**
 * Application Settings Service
 * Centralized configuration management with secrets integration
 * Supports environment-specific configurations and runtime updates
 */

import { secretsManager, getSecretValue, SecretCategory } from './secrets';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

// ============================================
// Types and Interfaces
// ============================================

export interface SettingDefinition {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'json' | 'secret';
  category: SettingCategory;
  description: string;
  defaultValue?: any;
  required: boolean;
  sensitive: boolean;
  validation?: ValidationRule[];
  environment?: ('dev' | 'staging' | 'production')[];
}

export type SettingCategory = 
  | 'database'
  | 'api'
  | 'agents'
  | 'pipelines'
  | 'security'
  | 'integrations'
  | 'notifications'
  | 'limits';

export interface ValidationRule {
  type: 'regex' | 'range' | 'enum' | 'custom';
  value: any;
  message: string;
}

export interface ApplicationSettings {
  id: string;
  environment: 'dev' | 'staging' | 'production';
  version: string;
  lastUpdated: Date;
  settings: Map<string, any>;
}

export interface SettingsAuditLog {
  id: string;
  settingKey: string;
  oldValue: any;
  newValue: any;
  changedBy: string;
  reason?: string;
  timestamp: Date;
}

// ============================================
// Default Settings Schema
// ============================================

const SETTINGS_SCHEMA: SettingDefinition[] = [
  // Database Settings
  {
    key: 'database.url',
    type: 'secret',
    category: 'database',
    description: 'Database connection URL',
    required: true,
    sensitive: true,
  },
  {
    key: 'database.poolSize',
    type: 'number',
    category: 'database',
    description: 'Connection pool size',
    defaultValue: 10,
    required: false,
    sensitive: false,
    validation: [{ type: 'range', value: { min: 1, max: 100 }, message: 'Pool size must be between 1 and 100' }],
  },
  {
    key: 'database.timeout',
    type: 'number',
    category: 'database',
    description: 'Query timeout in milliseconds',
    defaultValue: 30000,
    required: false,
    sensitive: false,
  },

  // API Settings
  {
    key: 'api.rateLimit.global',
    type: 'number',
    category: 'api',
    description: 'Global API rate limit per minute',
    defaultValue: 100,
    required: false,
    sensitive: false,
  },
  {
    key: 'api.rateLimit.approvals',
    type: 'number',
    category: 'api',
    description: 'Rate limit for approval endpoints',
    defaultValue: 20,
    required: false,
    sensitive: false,
  },
  {
    key: 'api.rateLimit.execute',
    type: 'number',
    category: 'api',
    description: 'Rate limit for execution endpoints',
    defaultValue: 50,
    required: false,
    sensitive: false,
  },
  {
    key: 'api.timeout',
    type: 'number',
    category: 'api',
    description: 'API request timeout in milliseconds',
    defaultValue: 30000,
    required: false,
    sensitive: false,
  },

  // Agent Settings
  {
    key: 'agents.maxConcurrent',
    type: 'number',
    category: 'agents',
    description: 'Maximum concurrent agent executions',
    defaultValue: 5,
    required: false,
    sensitive: false,
    validation: [{ type: 'range', value: { min: 1, max: 20 }, message: 'Max concurrent agents must be between 1 and 20' }],
  },
  {
    key: 'agents.executionTimeout',
    type: 'number',
    category: 'agents',
    description: 'Agent execution timeout in milliseconds',
    defaultValue: 300000, // 5 minutes
    required: false,
    sensitive: false,
  },
  {
    key: 'agents.retryAttempts',
    type: 'number',
    category: 'agents',
    description: 'Number of retry attempts for failed executions',
    defaultValue: 3,
    required: false,
    sensitive: false,
  },
  {
    key: 'agents.enabledAgents',
    type: 'json',
    category: 'agents',
    description: 'List of enabled agent names',
    defaultValue: ['sentinel', 'cipher', 'guardian', 'oracle', 'vector', 'ledger'],
    required: false,
    sensitive: false,
  },

  // Pipeline Settings
  {
    key: 'pipelines.maxParallel',
    type: 'number',
    category: 'pipelines',
    description: 'Maximum parallel pipeline executions',
    defaultValue: 3,
    required: false,
    sensitive: false,
  },
  {
    key: 'pipelines.defaultTimeout',
    type: 'number',
    category: 'pipelines',
    description: 'Default pipeline timeout in milliseconds',
    defaultValue: 600000, // 10 minutes
    required: false,
    sensitive: false,
  },
  {
    key: 'pipelines.heartbeatInterval',
    type: 'number',
    category: 'pipelines',
    description: 'Pipeline heartbeat interval in milliseconds',
    defaultValue: 30000,
    required: false,
    sensitive: false,
  },

  // Security Settings
  {
    key: 'security.sessionTimeout',
    type: 'number',
    category: 'security',
    description: 'Session timeout in milliseconds',
    defaultValue: 3600000, // 1 hour
    required: false,
    sensitive: false,
  },
  {
    key: 'security.csrfEnabled',
    type: 'boolean',
    category: 'security',
    description: 'Enable CSRF protection',
    defaultValue: true,
    required: false,
    sensitive: false,
  },
  {
    key: 'security.auditLogRetention',
    type: 'number',
    category: 'security',
    description: 'Audit log retention in days',
    defaultValue: 365,
    required: false,
    sensitive: false,
  },
  {
    key: 'security.maxLoginAttempts',
    type: 'number',
    category: 'security',
    description: 'Maximum login attempts before lockout',
    defaultValue: 5,
    required: false,
    sensitive: false,
  },

  // Integration Settings (Secrets)
  {
    key: 'integrations.stripe.apiKey',
    type: 'secret',
    category: 'integrations',
    description: 'Stripe API key',
    required: false,
    sensitive: true,
  },
  {
    key: 'integrations.quickbooks.clientId',
    type: 'secret',
    category: 'integrations',
    description: 'QuickBooks OAuth client ID',
    required: false,
    sensitive: true,
  },
  {
    key: 'integrations.quickbooks.clientSecret',
    type: 'secret',
    category: 'integrations',
    description: 'QuickBooks OAuth client secret',
    required: false,
    sensitive: true,
  },
  {
    key: 'integrations.slack.webhookUrl',
    type: 'secret',
    category: 'integrations',
    description: 'Slack webhook URL for notifications',
    required: false,
    sensitive: true,
  },
  {
    key: 'integrations.crm.apiKey',
    type: 'secret',
    category: 'integrations',
    description: 'CRM API key',
    required: false,
    sensitive: true,
  },
  {
    key: 'integrations.email.smtpHost',
    type: 'string',
    category: 'integrations',
    description: 'SMTP server host',
    required: false,
    sensitive: false,
  },
  {
    key: 'integrations.email.smtpUser',
    type: 'secret',
    category: 'integrations',
    description: 'SMTP username',
    required: false,
    sensitive: true,
  },
  {
    key: 'integrations.email.smtpPassword',
    type: 'secret',
    category: 'integrations',
    description: 'SMTP password',
    required: false,
    sensitive: true,
  },

  // Notification Settings
  {
    key: 'notifications.enabled',
    type: 'boolean',
    category: 'notifications',
    description: 'Enable notifications',
    defaultValue: true,
    required: false,
    sensitive: false,
  },
  {
    key: 'notifications.email.from',
    type: 'string',
    category: 'notifications',
    description: 'Default sender email address',
    required: false,
    sensitive: false,
  },

  // Limits Settings
  {
    key: 'limits.transaction.maxAmount',
    type: 'number',
    category: 'limits',
    description: 'Maximum transaction amount without approval',
    defaultValue: 10000,
    required: false,
    sensitive: false,
  },
  {
    key: 'limits.transaction.dailyLimit',
    type: 'number',
    category: 'limits',
    description: 'Daily transaction limit per agent',
    defaultValue: 50000,
    required: false,
    sensitive: false,
  },
  {
    key: 'limits.discount.maxPercent',
    type: 'number',
    category: 'limits',
    description: 'Maximum discount percentage without approval',
    defaultValue: 20,
    required: false,
    sensitive: false,
    validation: [{ type: 'range', value: { min: 0, max: 100 }, message: 'Discount must be between 0 and 100' }],
  },
  {
    key: 'limits.refund.maxAmount',
    type: 'number',
    category: 'limits',
    description: 'Maximum refund amount without approval',
    defaultValue: 5000,
    required: false,
    sensitive: false,
  },
];

// ============================================
// Settings Service Class
// ============================================

export class SettingsService {
  private settings: Map<string, any> = new Map();
  private auditLogs: SettingsAuditLog[] = [];
  private settingsPath: string;
  private environment: 'dev' | 'staging' | 'production';
  private initialized: boolean = false;

  constructor() {
    this.settingsPath = '/home/z/my-project/settings';
    this.environment = (process.env.NODE_ENV as 'dev' | 'staging' | 'production') || 'dev';
  }

  /**
   * Initialize settings from environment and storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load schema defaults
    for (const def of SETTINGS_SCHEMA) {
      if (def.defaultValue !== undefined) {
        this.settings.set(def.key, def.defaultValue);
      }
    }

    // Load from environment variables
    await this.loadFromEnvironment();

    // Load from storage
    await this.loadFromStorage();

    // Load secrets
    await this.loadSecrets();

    this.initialized = true;
  }

  /**
   * Get a setting value
   */
  async get<T = any>(key: string, defaultValue?: T): Promise<T> {
    if (!this.initialized) {
      await this.initialize();
    }

    const definition = SETTINGS_SCHEMA.find(d => d.key === key);
    
    // If it's a secret, get from secrets manager
    if (definition?.type === 'secret') {
      try {
        const result = await secretsManager.getSecret(key);
        return (result?.value as T) ?? defaultValue as T;
      } catch {
        return defaultValue as T;
      }
    }

    // Return from cache or default
    const value = this.settings.get(key);
    if (value === undefined) {
      return defaultValue as T;
    }

    return value as T;
  }

  /**
   * Set a setting value
   */
  async set(key: string, value: any, changedBy: string = 'system', reason?: string): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const definition = SETTINGS_SCHEMA.find(d => d.key === key);
    if (!definition) {
      throw new Error(`Unknown setting: ${key}`);
    }

    // Validate
    if (definition.validation) {
      for (const rule of definition.validation) {
        if (!this.validateValue(value, rule)) {
          throw new Error(rule.message);
        }
      }
    }

    // If it's a secret, store in secrets manager
    if (definition.type === 'secret') {
      await secretsManager.storeSecret({
        key,
        value: String(value),
        category: this.mapToSecretCategory(definition.category),
        description: definition.description,
      });
      return;
    }

    // Type conversion
    let typedValue = value;
    if (definition.type === 'number') {
      typedValue = Number(value);
    } else if (definition.type === 'boolean') {
      typedValue = Boolean(value);
    } else if (definition.type === 'json') {
      typedValue = typeof value === 'string' ? JSON.parse(value) : value;
    }

    // Log change
    const oldValue = this.settings.get(key);
    this.auditLogs.push({
      id: uuidv4(),
      settingKey: key,
      oldValue: definition.sensitive ? '***REDACTED***' : oldValue,
      newValue: definition.sensitive ? '***REDACTED***' : typedValue,
      changedBy,
      reason,
      timestamp: new Date(),
    });

    // Update
    this.settings.set(key, typedValue);

    // Persist
    await this.persistSettings();
  }

  /**
   * Get all settings (non-sensitive)
   */
  async getAll(): Promise<Record<string, any>> {
    if (!this.initialized) {
      await this.initialize();
    }

    const result: Record<string, any> = {};
    
    for (const [key, value] of this.settings.entries()) {
      const definition = SETTINGS_SCHEMA.find(d => d.key === key);
      if (definition && !definition.sensitive) {
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * Get settings schema
   */
  getSchema(): SettingDefinition[] {
    return SETTINGS_SCHEMA;
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit: number = 100): SettingsAuditLog[] {
    return this.auditLogs.slice(-limit);
  }

  /**
   * Reload settings from storage
   */
  async reload(): Promise<void> {
    this.settings.clear();
    this.initialized = false;
    await this.initialize();
  }

  /**
   * Export settings for backup
   */
  async export(includeSecrets: boolean = false): Promise<Record<string, any>> {
    const settings = await this.getAll();
    
    if (includeSecrets) {
      const allSecrets = await secretsManager.listSecrets();
      for (const secret of allSecrets) {
        const result = await secretsManager.getSecret(secret.key);
        if (result) {
          settings[secret.key] = result.value;
        }
      }
    }

    return settings;
  }

  // ============================================
  // Private Methods
  // ============================================

  private async loadFromEnvironment(): Promise<void> {
    for (const def of SETTINGS_SCHEMA) {
      const envKey = def.key.toUpperCase().replace(/\./g, '_');
      const envValue = process.env[envKey];

      if (envValue !== undefined) {
        if (def.type === 'secret') {
          // Store secret
          await secretsManager.storeSecret({
            key: def.key,
            value: envValue,
            category: this.mapToSecretCategory(def.category),
            description: def.description,
          });
        } else {
          // Type conversion
          let typedValue: any = envValue;
          if (def.type === 'number') {
            typedValue = Number(envValue);
          } else if (def.type === 'boolean') {
            typedValue = envValue === 'true';
          } else if (def.type === 'json') {
            try {
              typedValue = JSON.parse(envValue);
            } catch {
              console.warn(`Failed to parse JSON for setting ${def.key}`);
            }
          }
          this.settings.set(def.key, typedValue);
        }
      }
    }
  }

  private async loadFromStorage(): Promise<void> {
    try {
      const settingsFile = path.join(this.settingsPath, `${this.environment}.json`);
      const content = await fs.readFile(settingsFile, 'utf-8');
      const stored = JSON.parse(content);

      for (const [key, value] of Object.entries(stored)) {
        this.settings.set(key, value);
      }
    } catch {
      // File doesn't exist, use defaults
    }
  }

  private async loadSecrets(): Promise<void> {
    const allSecrets = await secretsManager.listSecrets();
    for (const secret of allSecrets) {
      // Secrets are accessed through secretsManager.getSecret()
      // Here we just ensure they're registered
    }
  }

  private async persistSettings(): Promise<void> {
    await fs.mkdir(this.settingsPath, { recursive: true });
    
    const settingsFile = path.join(this.settingsPath, `${this.environment}.json`);
    const nonSensitiveSettings: Record<string, any> = {};

    for (const [key, value] of this.settings.entries()) {
      const definition = SETTINGS_SCHEMA.find(d => d.key === key);
      if (definition && !definition.sensitive) {
        nonSensitiveSettings[key] = value;
      }
    }

    await fs.writeFile(settingsFile, JSON.stringify(nonSensitiveSettings, null, 2));
  }

  private validateValue(value: any, rule: ValidationRule): boolean {
    switch (rule.type) {
      case 'regex':
        return new RegExp(rule.value).test(String(value));
      case 'range':
        const num = Number(value);
        return num >= rule.value.min && num <= rule.value.max;
      case 'enum':
        return rule.value.includes(value);
      case 'custom':
        return rule.value(value);
      default:
        return true;
    }
  }

  private mapToSecretCategory(settingCategory: SettingCategory): SecretCategory {
    const mapping: Record<SettingCategory, SecretCategory> = {
      database: 'database',
      api: 'api_key',
      agents: 'custom',
      pipelines: 'custom',
      security: 'encryption',
      integrations: 'api_key',
      notifications: 'email',
      limits: 'custom',
    };
    return mapping[settingCategory] || 'custom';
  }
}

// ============================================
// Singleton Export
// ============================================

export const settingsService = new SettingsService();

// ============================================
// Convenience Functions
// ============================================

export async function getSetting<T = any>(key: string, defaultValue?: T): Promise<T> {
  return settingsService.get<T>(key, defaultValue);
}

export async function setSetting(key: string, value: any, changedBy?: string, reason?: string): Promise<void> {
  return settingsService.set(key, value, changedBy, reason);
}
