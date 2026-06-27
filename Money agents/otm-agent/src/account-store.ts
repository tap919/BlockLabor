import crypto from "node:crypto";
// ---------------------------------------------------------------------------
// OTM Agent — Secure Account Storage
//
// Encrypted storage for platform accounts, API keys, and credentials.
// Uses AES-256-GCM encryption with machine-key derivation.
// ---------------------------------------------------------------------------
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

const ACCOUNT_DATA_DIR = join(homedir(), ".openclaw", "otm", "accounts");
const ENCRYPTION_KEY_FILE = join(homedir(), ".openclaw", "otm", ".encryption_key");

// Account types
export type AccountType =
  | "upwork"
  | "fiverr"
  | "reddit"
  | "clickworker"
  | "appen"
  | "scaleai"
  | "gumroad"
  | "etsy"
  | "makecom"
  | "notion"
  | "facebook"
  | "craigslist"
  | "ebay"
  | "other";

export interface PlatformAccount {
  id: string;
  type: AccountType;
  platform: string;
  username?: string;
  email?: string;
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  enabled: boolean;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface AccountStats {
  totalAccounts: number;
  activeAccounts: number;
  byPlatform: Record<string, number>;
  lastSync: string;
}

// Encryption utilities
async function getEncryptionKey(): Promise<Buffer> {
  try {
    // Try to read existing key
    const keyData = await readFile(ENCRYPTION_KEY_FILE, "utf8");
    const parsed = JSON.parse(keyData);

    if (parsed.version === 1 && parsed.key) {
      return Buffer.from(parsed.key, "base64");
    }
  } catch {
    // Key doesn't exist or is invalid
  }

  // Generate new key
  await mkdir(dirname(ENCRYPTION_KEY_FILE), { recursive: true });
  const key = crypto.randomBytes(32); // 256-bit key

  const keyData = {
    version: 1,
    key: key.toString("base64"),
    created: new Date().toISOString(),
    algorithm: "aes-256-gcm",
  };

  await writeFile(ENCRYPTION_KEY_FILE, JSON.stringify(keyData, null, 2), { mode: 0o600 });
  return key;
}

function encryptData(data: string, key: Buffer): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

function decryptData(
  encrypted: { ciphertext: string; iv: string; tag: string },
  key: Buffer,
): string {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(encrypted.iv, "base64"));

  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

// Account storage
export class AccountStore {
  private accounts: Map<string, PlatformAccount> = new Map();
  private encryptionKey: Buffer | null = null;
  private dataFile: string;

  constructor(dataDir?: string) {
    this.dataFile = join(dataDir || ACCOUNT_DATA_DIR, "accounts.encrypted.json");
  }

  async initialize(): Promise<void> {
    await mkdir(dirname(this.dataFile), { recursive: true });
    this.encryptionKey = await getEncryptionKey();
    await this.loadAccounts();
  }

  private async loadAccounts(): Promise<void> {
    try {
      const data = await readFile(this.dataFile, "utf8");
      const encrypted = JSON.parse(data);

      if (encrypted.version !== 1 || !this.encryptionKey) {
        throw new Error("Invalid account data format");
      }

      const decryptedJson = decryptData(encrypted.data, this.encryptionKey);
      const accounts: PlatformAccount[] = JSON.parse(decryptedJson);

      this.accounts.clear();
      for (const account of accounts) {
        this.accounts.set(account.id, account);
      }
    } catch (error) {
      // File doesn't exist or is corrupted - start fresh
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn("Failed to load accounts:", error);
      }
      this.accounts.clear();
    }
  }

  private async saveAccounts(): Promise<void> {
    if (!this.encryptionKey) {
      throw new Error("Account store not initialized");
    }

    const accounts = Array.from(this.accounts.values());
    const jsonData = JSON.stringify(accounts, null, 2);
    const encrypted = encryptData(jsonData, this.encryptionKey);

    const data = {
      version: 1,
      algorithm: "aes-256-gcm",
      created: new Date().toISOString(),
      data: encrypted,
    };

    await writeFile(this.dataFile, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  // Account CRUD operations
  async addAccount(
    account: Omit<PlatformAccount, "id" | "createdAt" | "updatedAt">,
  ): Promise<PlatformAccount> {
    const id = crypto.randomBytes(16).toString("hex");
    const now = new Date().toISOString();

    const fullAccount: PlatformAccount = {
      ...account,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(id, fullAccount);
    await this.saveAccounts();

    return fullAccount;
  }

  async updateAccount(
    id: string,
    updates: Partial<Omit<PlatformAccount, "id" | "createdAt" | "updatedAt">>,
  ): Promise<PlatformAccount | null> {
    const account = this.accounts.get(id);
    if (!account) return null;

    const updatedAccount: PlatformAccount = {
      ...account,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.accounts.set(id, updatedAccount);
    await this.saveAccounts();

    return updatedAccount;
  }

  async getAccount(id: string): Promise<PlatformAccount | null> {
    return this.accounts.get(id) || null;
  }

  async getAccountsByType(type: AccountType): Promise<PlatformAccount[]> {
    return Array.from(this.accounts.values()).filter((acc) => acc.type === type);
  }

  async getActiveAccounts(): Promise<PlatformAccount[]> {
    return Array.from(this.accounts.values()).filter((acc) => acc.enabled);
  }

  async deleteAccount(id: string): Promise<boolean> {
    const deleted = this.accounts.delete(id);
    if (deleted) {
      await this.saveAccounts();
    }
    return deleted;
  }

  async listAccounts(): Promise<PlatformAccount[]> {
    return Array.from(this.accounts.values());
  }

  async getStats(): Promise<AccountStats> {
    const accounts = Array.from(this.accounts.values());
    const byPlatform: Record<string, number> = {};

    for (const account of accounts) {
      byPlatform[account.platform] = (byPlatform[account.platform] || 0) + 1;
    }

    return {
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((acc) => acc.enabled).length,
      byPlatform,
      lastSync: new Date().toISOString(),
    };
  }

  // Platform-specific helpers
  async getUpworkAccounts(): Promise<PlatformAccount[]> {
    return this.getAccountsByType("upwork");
  }

  async getFiverrAccounts(): Promise<PlatformAccount[]> {
    return this.getAccountsByType("fiverr");
  }

  async getRedditAccounts(): Promise<PlatformAccount[]> {
    return this.getAccountsByType("reddit");
  }

  async getClickworkerAccounts(): Promise<PlatformAccount[]> {
    return this.getAccountsByType("clickworker");
  }

  // Token management
  async updateToken(
    id: string,
    tokenData: {
      accessToken?: string;
      refreshToken?: string;
      expiresAt?: string;
    },
  ): Promise<PlatformAccount | null> {
    return this.updateAccount(id, {
      ...tokenData,
      lastUsed: new Date().toISOString(),
    });
  }

  // Security utilities
  async rotateEncryptionKey(): Promise<void> {
    // Generate new key
    const newKey = crypto.randomBytes(32);

    // Save old key reference BEFORE overwriting
    const oldKeyBase64 = this.encryptionKey?.toString("base64");

    // Re-encrypt all accounts with new key
    this.encryptionKey = newKey;

    // Save new key (do NOT persist the old key to disk — security risk)
    const keyData = {
      version: 1,
      key: newKey.toString("base64"),
      created: new Date().toISOString(),
      algorithm: "aes-256-gcm",
    };

    // Write accounts first (encrypted with new key), then persist key.
    // If saveAccounts fails, we can still recover with the old key on disk.
    try {
      await this.saveAccounts();
      await writeFile(ENCRYPTION_KEY_FILE, JSON.stringify(keyData, null, 2), { mode: 0o600 });
    } catch (err) {
      // Rollback: restore old key so in-memory state is consistent
      if (oldKeyBase64) {
        this.encryptionKey = Buffer.from(oldKeyBase64, "base64");
      }
      throw err;
    }
  }

  async validateAccount(id: string): Promise<{ valid: boolean; reason?: string }> {
    const account = await this.getAccount(id);
    if (!account) {
      return { valid: false, reason: "Account not found" };
    }

    if (!account.enabled) {
      return { valid: false, reason: "Account disabled" };
    }

    // Check if token is expired
    if (account.expiresAt) {
      const expiresAt = new Date(account.expiresAt);
      if (expiresAt < new Date()) {
        return { valid: false, reason: "Token expired" };
      }
    }

    // Check if we have required credentials
    if (!account.apiKey && !account.accessToken) {
      return { valid: false, reason: "Missing credentials" };
    }

    return { valid: true };
  }
}

// Singleton instance
let accountStore: AccountStore | null = null;
let accountStoreDataDir: string | undefined;
let accountStoreInitPromise: Promise<AccountStore> | null = null;

export async function getAccountStore(dataDir?: string): Promise<AccountStore> {
  if (accountStore) {
    if (dataDir !== undefined && dataDir !== accountStoreDataDir) {
      console.warn(
        `[account-store] getAccountStore called with different dataDir ` +
          `(existing: ${accountStoreDataDir}, requested: ${dataDir}). Using existing instance.`,
      );
    }
    return accountStore;
  }

  // Guard against concurrent init: reuse the in-flight promise
  if (accountStoreInitPromise) {
    return accountStoreInitPromise;
  }

  accountStoreInitPromise = (async () => {
    const store = new AccountStore(dataDir);
    await store.initialize();
    accountStore = store;
    accountStoreDataDir = dataDir;
    return store;
  })();

  try {
    return await accountStoreInitPromise;
  } catch (err) {
    // Reset so a future call can retry
    accountStoreInitPromise = null;
    throw err;
  }
}

// Utility functions
export function maskSecret(secret: string): string {
  if (secret.length <= 8) {
    return "••••••••";
  }
  return secret.substring(0, 4) + "••••" + secret.substring(secret.length - 4);
}

export function generateAccountId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function validatePlatformCredentials(
  platform: string,
  credentials: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (platform.toLowerCase()) {
    case "upwork":
      if (!credentials.apiKey) errors.push("API key required");
      if (!credentials.apiSecret) errors.push("API secret required");
      break;

    case "fiverr":
      if (!credentials.accessToken) errors.push("Access token required");
      break;

    case "reddit":
      // H7 fix: PlatformAccount uses apiKey/apiSecret, not clientId/clientSecret
      if (!credentials.apiKey) errors.push("API key (client ID) required");
      if (!credentials.apiSecret) errors.push("API secret (client secret) required");
      if (!credentials.username) errors.push("Username required");
      break;

    case "clickworker":
    case "appen":
    case "scaleai":
      if (!credentials.username) errors.push("Username required");
      if (!credentials.password) errors.push("Password required");
      break;

    case "gumroad":
    case "etsy":
      if (!credentials.accessToken) errors.push("Access token required");
      break;

    case "facebook":
      if (!credentials.accessToken) errors.push("Facebook access token required");
      break;

    case "craigslist":
      // Craigslist uses email-based posting; no API credentials required for scanning
      if (!credentials.email) errors.push("Email address required for Craigslist posting");
      break;

    case "ebay":
      if (!credentials.apiKey) errors.push("eBay OAuth app ID (API key) required");
      if (!credentials.accessToken) errors.push("eBay user access token required");
      break;

    default:
      if (!credentials.apiKey) errors.push("API key required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
