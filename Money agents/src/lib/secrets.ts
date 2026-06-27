/**
 * Secrets Management Service
 * Provides secure storage, retrieval, and rotation of sensitive configuration
 * Implements encryption at rest and access logging
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// ============================================
// Types and Interfaces
// ============================================

export interface SecretMetadata {
  id: string;
  key: string;
  description?: string;
  category: SecretCategory;
  environment: 'dev' | 'staging' | 'production' | 'all';
  rotationDays?: number;
  lastRotated?: Date;
  lastAccessed?: Date;
  accessCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  tags?: string[];
}

export type SecretCategory = 
  | 'database'
  | 'api_key'
  | 'oauth'
  | 'encryption'
  | 'payment'
  | 'email'
  | 'storage'
  | 'webhook'
  | 'custom';

export interface SecretValue {
  id: string;
  value: string;
  version: number;
  encrypted: boolean;
  checksum: string;
  createdAt: Date;
  expiresAt?: Date;
}

export interface SecretAccessLog {
  id: string;
  secretId: string;
  action: 'read' | 'write' | 'delete' | 'rotate';
  actor: string;
  actorType: 'user' | 'agent' | 'system' | 'pipeline';
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  timestamp: Date;
}

export interface SecretPolicy {
  category: SecretCategory;
  minRotationDays?: number;
  maxAge?: number;
  requireEncryption: boolean;
  allowedEnvironments: string[];
  requireApproval: boolean;
  approvers?: string[];
}

// ============================================
// Secrets Manager Class
// ============================================

export class SecretsManager {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-gcm';
  private keyLength = 32;
  private ivLength = 16;
  private authTagLength = 16;
  private secretsPath: string;
  private accessLogPath: string;
  private metadataCache: Map<string, SecretMetadata> = new Map();
  private policies: Map<SecretCategory, SecretPolicy> = new Map();
  private accessLogs: SecretAccessLog[] = [];

  constructor() {
    this.secretsPath = '/home/z/my-project/secrets';
    this.accessLogPath = '/home/z/my-project/secrets/logs';
    
    // Initialize encryption key from environment or generate
    const envKey = process.env.SECRETS_ENCRYPTION_KEY;
    if (envKey) {
      this.encryptionKey = Buffer.from(envKey, 'hex');
    } else {
      // In development, use a derived key (in production, this should come from a KMS)
      const baseKey = process.env.DATABASE_URL || 'default-dev-key-not-for-production';
      this.encryptionKey = crypto.createHash('sha256').update(baseKey).digest();
    }

    // Initialize default policies
    this.initializePolicies();
    this.initializeDirectories();
  }

  /**
   * Initialize secret policies
   */
  private initializePolicies(): void {
    const defaultPolicies: [SecretCategory, SecretPolicy][] = [
      ['database', {
        category: 'database',
        minRotationDays: 90,
        requireEncryption: true,
        allowedEnvironments: ['dev', 'staging', 'production'],
        requireApproval: true,
        approvers: ['admin', 'security'],
      }],
      ['api_key', {
        category: 'api_key',
        minRotationDays: 30,
        requireEncryption: true,
        allowedEnvironments: ['dev', 'staging', 'production'],
        requireApproval: false,
      }],
      ['payment', {
        category: 'payment',
        minRotationDays: 30,
        maxAge: 365,
        requireEncryption: true,
        allowedEnvironments: ['production'],
        requireApproval: true,
        approvers: ['admin', 'finance'],
      }],
      ['oauth', {
        category: 'oauth',
        minRotationDays: 180,
        requireEncryption: true,
        allowedEnvironments: ['all'],
        requireApproval: true,
        approvers: ['admin'],
      }],
      ['encryption', {
        category: 'encryption',
        minRotationDays: 365,
        requireEncryption: true,
        allowedEnvironments: ['all'],
        requireApproval: true,
        approvers: ['admin', 'security'],
      }],
      ['email', {
        category: 'email',
        minRotationDays: 90,
        requireEncryption: true,
        allowedEnvironments: ['all'],
        requireApproval: false,
      }],
    ];

    defaultPolicies.forEach(([category, policy]) => {
      this.policies.set(category, policy);
    });
  }

  /**
   * Initialize storage directories
   */
  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.secretsPath, { recursive: true });
      await fs.mkdir(this.accessLogPath, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize secrets directories:', error);
    }
  }

  /**
   * Encrypt a secret value
   */
  private encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.encryptionKey,
      iv,
      { authTagLength: this.authTagLength }
    );

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag,
    };
  }

  /**
   * Decrypt a secret value
   */
  private decrypt(encrypted: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex'),
      { authTagLength: this.authTagLength }
    );

    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Generate checksum for integrity verification
   */
  private generateChecksum(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex').substring(0, 16);
  }

  /**
   * Store a secret
   */
  async storeSecret(params: {
    key: string;
    value: string;
    category: SecretCategory;
    description?: string;
    environment?: 'dev' | 'staging' | 'production' | 'all';
    rotationDays?: number;
    createdBy?: string;
    tags?: string[];
  }): Promise<SecretMetadata> {
    const { key, value, category, description, environment = 'all', rotationDays, createdBy, tags } = params;

    // Check policy
    const policy = this.policies.get(category);
    if (policy) {
      if (policy.requireEncryption) {
        // Already encrypting by default
      }
    }

    // Generate ID
    const id = uuidv4();

    // Encrypt the value
    const { encrypted, iv, authTag } = this.encrypt(value);
    const checksum = this.generateChecksum(value);

    // Create secret value
    const secretValue: SecretValue = {
      id: uuidv4(),
      value: JSON.stringify({ encrypted, iv, authTag }),
      version: 1,
      encrypted: true,
      checksum,
      createdAt: new Date(),
    };

    // Create metadata
    const metadata: SecretMetadata = {
      id,
      key,
      description,
      category,
      environment,
      rotationDays: rotationDays || policy?.minRotationDays,
      lastRotated: new Date(),
      accessCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy,
      tags,
    };

    // Store
    await this.persistSecret(id, metadata, secretValue);
    this.metadataCache.set(key, metadata);

    // Log access
    await this.logAccess({
      secretId: id,
      action: 'write',
      actor: createdBy || 'system',
      actorType: createdBy ? 'user' : 'system',
      success: true,
    });

    return metadata;
  }

  /**
   * Retrieve a secret
   */
  async getSecret(key: string, actor?: string): Promise<{ value: string; metadata: SecretMetadata } | null> {
    const metadata = this.metadataCache.get(key);
    if (!metadata) {
      // Try to load from disk
      const loaded = await this.loadSecretMetadata(key);
      if (!loaded) {
        await this.logAccess({
          secretId: 'unknown',
          action: 'read',
          actor: actor || 'system',
          actorType: actor ? 'user' : 'system',
          success: false,
          errorMessage: 'Secret not found',
        });
        return null;
      }
    }

    const meta = metadata || await this.loadSecretMetadata(key);
    if (!meta) return null;

    // Load secret value
    const secretValue = await this.loadSecretValue(meta.id);
    if (!secretValue) {
      return null;
    }

    // Decrypt
    const { encrypted, iv, authTag } = JSON.parse(secretValue.value);
    const decryptedValue = this.decrypt(encrypted, iv, authTag);

    // Verify checksum
    const checksum = this.generateChecksum(decryptedValue);
    if (checksum !== secretValue.checksum) {
      await this.logAccess({
        secretId: meta.id,
        action: 'read',
        actor: actor || 'system',
        actorType: actor ? 'user' : 'system',
        success: false,
        errorMessage: 'Checksum mismatch - possible tampering',
      });
      throw new Error('Secret integrity check failed');
    }

    // Update access metadata
    meta.lastAccessed = new Date();
    meta.accessCount++;
    await this.updateMetadata(meta);

    // Log access
    await this.logAccess({
      secretId: meta.id,
      action: 'read',
      actor: actor || 'system',
      actorType: actor ? 'user' : 'system',
      success: true,
    });

    return { value: decryptedValue, metadata: meta };
  }

  /**
   * Rotate a secret
   */
  async rotateSecret(key: string, newValue: string, rotatedBy?: string): Promise<SecretMetadata> {
    const metadata = this.metadataCache.get(key) || await this.loadSecretMetadata(key);
    if (!metadata) {
      throw new Error('Secret not found');
    }

    // Check policy for rotation requirements
    const policy = this.policies.get(metadata.category);
    if (policy?.requireApproval) {
      // In production, this would create an approval request
      console.log(`Rotation of ${key} requires approval from: ${policy.approvers?.join(', ')}`);
    }

    // Encrypt new value
    const { encrypted, iv, authTag } = this.encrypt(newValue);
    const checksum = this.generateChecksum(newValue);

    // Create new version
    const secretValue: SecretValue = {
      id: uuidv4(),
      value: JSON.stringify({ encrypted, iv, authTag }),
      version: (await this.getLatestVersion(metadata.id)) + 1,
      encrypted: true,
      checksum,
      createdAt: new Date(),
    };

    // Store new version
    await this.persistSecretValue(metadata.id, secretValue);

    // Update metadata
    metadata.lastRotated = new Date();
    metadata.updatedAt = new Date();
    await this.updateMetadata(metadata);

    // Log rotation
    await this.logAccess({
      secretId: metadata.id,
      action: 'rotate',
      actor: rotatedBy || 'system',
      actorType: rotatedBy ? 'user' : 'system',
      success: true,
    });

    return metadata;
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string, deletedBy?: string): Promise<boolean> {
    const metadata = this.metadataCache.get(key) || await this.loadSecretMetadata(key);
    if (!metadata) {
      return false;
    }

    // Check policy for deletion requirements
    const policy = this.policies.get(metadata.category);
    if (policy?.requireApproval) {
      console.log(`Deletion of ${key} requires approval from: ${policy.approvers?.join(', ')}`);
    }

    // Delete from storage
    const secretDir = path.join(this.secretsPath, metadata.id);
    try {
      await fs.rm(secretDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore if doesn't exist
    }

    // Remove from cache
    this.metadataCache.delete(key);

    // Log deletion
    await this.logAccess({
      secretId: metadata.id,
      action: 'delete',
      actor: deletedBy || 'system',
      actorType: deletedBy ? 'user' : 'system',
      success: true,
    });

    return true;
  }

  /**
   * List all secrets (metadata only, no values)
   */
  async listSecrets(category?: SecretCategory): Promise<SecretMetadata[]> {
    const allMetadata: SecretMetadata[] = [];

    try {
      const entries = await fs.readdir(this.secretsPath);
      for (const entry of entries) {
        if (entry === 'logs') continue;
        
        const metaPath = path.join(this.secretsPath, entry, 'metadata.json');
        try {
          const content = await fs.readFile(metaPath, 'utf-8');
          const meta = JSON.parse(content);
          if (!category || meta.category === category) {
            allMetadata.push(meta);
          }
        } catch {
          // Skip invalid entries
        }
      }
    } catch {
      // Directory doesn't exist
    }

    return allMetadata;
  }

  /**
   * Get access logs for a secret
   */
  async getAccessLogs(secretId?: string, limit: number = 100): Promise<SecretAccessLog[]> {
    if (secretId) {
      return this.accessLogs.filter(log => log.secretId === secretId).slice(-limit);
    }
    return this.accessLogs.slice(-limit);
  }

  /**
   * Check if secrets need rotation
   */
  async checkRotationNeeded(): Promise<SecretMetadata[]> {
    const allSecrets = await this.listSecrets();
    const needsRotation: SecretMetadata[] = [];
    const now = new Date();

    for (const secret of allSecrets) {
      if (!secret.rotationDays || !secret.lastRotated) continue;

      const rotationDate = new Date(secret.lastRotated);
      rotationDate.setDate(rotationDate.getDate() + secret.rotationDays);

      if (now > rotationDate) {
        needsRotation.push(secret);
      }
    }

    return needsRotation;
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private async persistSecret(id: string, metadata: SecretMetadata, value: SecretValue): Promise<void> {
    const secretDir = path.join(this.secretsPath, id);
    await fs.mkdir(secretDir, { recursive: true });

    // Save metadata
    await fs.writeFile(
      path.join(secretDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Save value
    await this.persistSecretValue(id, value);
  }

  private async persistSecretValue(secretId: string, value: SecretValue): Promise<void> {
    const secretDir = path.join(this.secretsPath, secretId);
    const versionFile = path.join(secretDir, `v${value.version}.json`);
    
    await fs.writeFile(versionFile, JSON.stringify(value, null, 2));
    
    // Also update current pointer
    await fs.writeFile(
      path.join(secretDir, 'current.json'),
      JSON.stringify({ version: value.version }, null, 2)
    );
  }

  private async loadSecretMetadata(key: string): Promise<SecretMetadata | null> {
    const allSecrets = await this.listSecrets();
    const secret = allSecrets.find(s => s.key === key);
    if (secret) {
      this.metadataCache.set(key, secret);
    }
    return secret || null;
  }

  private async loadSecretValue(secretId: string): Promise<SecretValue | null> {
    try {
      // Get current version
      const currentPath = path.join(this.secretsPath, secretId, 'current.json');
      const current = JSON.parse(await fs.readFile(currentPath, 'utf-8'));
      
      // Load that version
      const versionPath = path.join(this.secretsPath, secretId, `v${current.version}.json`);
      return JSON.parse(await fs.readFile(versionPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private async getLatestVersion(secretId: string): Promise<number> {
    try {
      const currentPath = path.join(this.secretsPath, secretId, 'current.json');
      const current = JSON.parse(await fs.readFile(currentPath, 'utf-8'));
      return current.version;
    } catch {
      return 0;
    }
  }

  private async updateMetadata(metadata: SecretMetadata): Promise<void> {
    const metaPath = path.join(this.secretsPath, metadata.id, 'metadata.json');
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2));
  }

  private async logAccess(log: Omit<SecretAccessLog, 'id' | 'timestamp'>): Promise<void> {
    const accessLog: SecretAccessLog = {
      ...log,
      id: uuidv4(),
      timestamp: new Date(),
    };

    this.accessLogs.push(accessLog);

    // Persist log
    const logFile = path.join(this.accessLogPath, `${new Date().toISOString().split('T')[0]}.json`);
    try {
      let logs: SecretAccessLog[] = [];
      try {
        logs = JSON.parse(await fs.readFile(logFile, 'utf-8'));
      } catch {
        // File doesn't exist
      }
      logs.push(accessLog);
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to persist access log:', error);
    }
  }
}

// ============================================
// Singleton Export
// ============================================

export const secretsManager = new SecretsManager();

// ============================================
// Helper Functions
// ============================================

/**
 * Get a secret value with error handling
 */
export async function getSecretValue(key: string, defaultValue?: string): Promise<string> {
  try {
    const result = await secretsManager.getSecret(key);
    return result?.value || defaultValue || '';
  } catch (error) {
    console.error(`Failed to get secret ${key}:`, error);
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Secret ${key} not found and no default provided`);
  }
}

/**
 * Store a secret from environment variable
 */
export async function importFromEnv(envKey: string, secretKey?: string): Promise<void> {
  const value = process.env[envKey];
  if (!value) {
    console.warn(`Environment variable ${envKey} not set`);
    return;
  }

  await secretsManager.storeSecret({
    key: secretKey || envKey.toLowerCase().replace(/_/g, '.'),
    value,
    category: 'custom',
    description: `Imported from environment variable ${envKey}`,
  });
}
