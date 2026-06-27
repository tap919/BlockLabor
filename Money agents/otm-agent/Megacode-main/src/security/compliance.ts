/**
 * Security & Compliance for OverCoat.
 *
 * Implementation plan for security and compliance features:
 *
 * 1. Secret Detection
 *    - Warns before committing credentials
 *    - Scans files for API keys, passwords, tokens, and certificates
 *    - Implementation: Regex-based pattern scanner for common secret formats
 *      (AWS keys, GitHub tokens, private keys, .env values),
 *      git pre-commit hook integration, real-time file watching
 *
 * 2. Permission Auditor
 *    - "This script needs sudo access for 3 operations"
 *    - Analyzes commands/scripts for privilege requirements
 *    - Implementation: Static analysis of shell scripts for sudo/su/chmod/chown,
 *      file permission checks, network port binding detection,
 *      report generation with least-privilege recommendations
 *
 * 3. Compliance Checker
 *    - Ensures commands meet security policies
 *    - Configurable rule sets (e.g., no plain HTTP, no eval, no root)
 *    - Implementation: Rule engine with severity levels,
 *      policy file support (YAML/JSON), pre-execution validation hooks,
 *      audit trail logging
 *
 * 4. Encrypted Session Sharing
 *    - Share terminal sessions securely
 *    - End-to-end encryption for session replay data
 *    - Implementation: AES-256-GCM encryption for session data,
 *      key exchange via asymmetric crypto, expiring share links,
 *      viewer authentication
 */

import { createHash, randomBytes, pbkdf2, createCipheriv, createDecipheriv } from "crypto";
import { promisify } from "util";

const pbkdf2Async = promisify(pbkdf2);

/** A detected secret in source code or configuration. */
export interface SecretFinding {
  /** Type of secret detected (e.g., "aws-key", "github-token", "private-key"). */
  type: string;
  /** File where the secret was found. */
  filePath: string;
  /** Line number (1-based). */
  line: number;
  /** Matched content (redacted). */
  redactedMatch: string;
  /** Severity of the finding. */
  severity: "critical" | "high" | "medium" | "low";
  /** Recommendation for remediation. */
  recommendation: string;
}

/** Permission requirement detected in a script/command. */
export interface PermissionRequirement {
  /** Type of permission needed (e.g., "sudo", "network-bind", "file-write"). */
  type: string;
  /** The command or operation requiring this permission. */
  operation: string;
  /** Line number in the script, if applicable. */
  line?: number;
  /** Whether elevated privileges are required. */
  elevated: boolean;
  /** Description of the requirement. */
  description: string;
}

/** Result of a permission audit. */
export interface PermissionAudit {
  /** The script or command audited. */
  target: string;
  requirements: PermissionRequirement[];
  /** Count of operations requiring elevated privileges. */
  elevatedCount: number;
  /** Summary text (e.g., "This script needs sudo for 3 operations"). */
  summary: string;
}

/** A compliance rule. */
export interface ComplianceRule {
  /** Rule identifier (e.g., "no-eval", "https-only"). */
  id: string;
  /** Human-readable description. */
  description: string;
  /** Severity if the rule is violated. */
  severity: "critical" | "high" | "medium" | "low";
  /** Category (e.g., "security", "best-practice", "compliance"). */
  category: string;
  /** Pattern to detect violations. */
  pattern: RegExp;
  /** Remediation advice. */
  remediation: string;
}

/** Result of a compliance check. */
export interface ComplianceResult {
  /** Rules that were checked. */
  rulesChecked: number;
  /** Violations found. */
  violations: Array<{
    rule: ComplianceRule;
    /** Where the violation was found. */
    location: string;
    /** The matched content. */
    match: string;
  }>;
  /** Whether all rules pass. */
  compliant: boolean;
}

/** Known secret patterns with their regex and metadata. */
const SECRET_PATTERNS: Array<{
  type: string;
  pattern: RegExp;
  severity: SecretFinding["severity"];
  recommendation: string;
}> = [
  {
    type: "aws-access-key",
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
    recommendation: "Rotate this AWS access key and use environment variables or AWS IAM roles instead.",
  },
  {
    type: "github-token",
    pattern: /gh[ps]_[A-Za-z0-9_]{36,}/g,
    severity: "critical",
    recommendation: "Revoke this GitHub token and use GITHUB_TOKEN or fine-grained PATs with minimal scope.",
  },
  {
    type: "private-key",
    pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    severity: "critical",
    recommendation: "Remove private key from source code. Store in a secrets manager or environment variable.",
  },
  {
    type: "generic-api-key",
    pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9]{16,}['"]/gi,
    severity: "high",
    recommendation: "Move API keys to environment variables or a secrets manager.",
  },
  {
    type: "generic-password",
    pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    severity: "high",
    recommendation: "Never hardcode passwords. Use environment variables or a secrets manager.",
  },
  {
    type: "generic-secret",
    pattern: /(?:secret|token)\s*[:=]\s*['"][A-Za-z0-9+/=]{16,}['"]/gi,
    severity: "high",
    recommendation: "Move secrets to environment variables or a secrets manager.",
  },
  {
    type: "connection-string",
    pattern: /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+:[^\s'"]+@/gi,
    severity: "high",
    recommendation: "Store database connection strings in environment variables.",
  },
];

/** Patterns indicating elevated privilege requirements. */
const PRIVILEGE_PATTERNS: Array<{
  type: string;
  pattern: RegExp;
  description: string;
}> = [
  { type: "sudo", pattern: /\bsudo\b/g, description: "Requires superuser privileges" },
  { type: "su", pattern: /\bsu\s+-?\s/g, description: "Switches user context" },
  { type: "chmod", pattern: /\bchmod\b/g, description: "Changes file permissions" },
  { type: "chown", pattern: /\bchown\b/g, description: "Changes file ownership" },
  { type: "port-bind", pattern: /\blisten\s*\(\s*(?:[0-9]{1,4})\s*\)/g, description: "Binds to a privileged port (<1024)" },
  { type: "systemctl", pattern: /\bsystemctl\b/g, description: "Manages system services" },
  { type: "iptables", pattern: /\biptables\b/g, description: "Modifies firewall rules" },
  { type: "mount", pattern: /\bmount\b/g, description: "Mounts filesystems" },
];

/** Default compliance rules. */
const DEFAULT_RULES: ComplianceRule[] = [
  {
    id: "no-eval",
    description: "Prohibit use of eval() which can execute arbitrary code",
    severity: "critical",
    category: "security",
    pattern: /\beval\s*\(/g,
    remediation: "Replace eval() with safer alternatives like JSON.parse() or a sandboxed parser.",
  },
  {
    id: "https-only",
    description: "Require HTTPS for all HTTP requests",
    severity: "high",
    category: "security",
    pattern: /http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/g,
    remediation: "Use HTTPS for all external URLs to ensure encrypted communication.",
  },
  {
    id: "no-hardcoded-ip",
    description: "Avoid hardcoded IP addresses in production code",
    severity: "medium",
    category: "best-practice",
    pattern: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g,
    remediation: "Use configuration files or environment variables for IP addresses.",
  },
  {
    id: "no-shell-exec",
    description: "Avoid shell command execution from application code",
    severity: "high",
    category: "security",
    pattern: /\b(?:exec|execSync|spawn|spawnSync)\s*\(/g,
    remediation: "Use library APIs instead of shell commands when possible.",
  },
];

/**
 * SecretDetector scans source code and configuration files for
 * accidentally committed credentials, API keys, and other secrets.
 */
export class SecretDetector {
  /**
   * Scan a file's content for secret patterns.
   */
  scan(filePath: string, content: string): SecretFinding[] {
    const findings: SecretFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { type, pattern, severity, recommendation } of SECRET_PATTERNS) {
        // Reset regex state
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const raw = match[0];
          // Redact: show first 4 and last 4 chars
          const redacted =
            raw.length > 8
              ? `${raw.substring(0, 4)}${"*".repeat(raw.length - 8)}${raw.substring(raw.length - 4)}`
              : "*".repeat(raw.length);

          findings.push({
            type,
            filePath,
            line: i + 1,
            redactedMatch: redacted,
            severity,
            recommendation,
          });
        }
      }
    }

    return findings;
  }

  /**
   * Compute a hash of the content for change detection.
   */
  contentHash(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }
}

/**
 * PermissionAuditor analyzes scripts and commands for privilege requirements.
 */
export class PermissionAuditor {
  /**
   * Audit a script's content for permission requirements.
   */
  audit(target: string, content: string): PermissionAudit {
    const requirements: PermissionRequirement[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const { type, pattern, description } of PRIVILEGE_PATTERNS) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          requirements.push({
            type,
            operation: line.trim(),
            line: i + 1,
            elevated: type === "sudo" || type === "su",
            description,
          });
        }
      }
    }

    const elevatedCount = requirements.filter((r) => r.elevated).length;
    const summary =
      elevatedCount > 0
        ? `This script needs sudo access for ${elevatedCount} operation${elevatedCount === 1 ? "" : "s"}`
        : "No elevated privileges required";

    return { target, requirements, elevatedCount, summary };
  }
}

/**
 * ComplianceChecker validates code and commands against security policies.
 */
export class ComplianceChecker {
  private rules: ComplianceRule[];

  constructor(customRules: ComplianceRule[] = []) {
    this.rules = [...DEFAULT_RULES, ...customRules];
  }

  /**
   * Check content against all compliance rules.
   */
  check(content: string, location: string = "unknown"): ComplianceResult {
    const violations: ComplianceResult["violations"] = [];

    for (const rule of this.rules) {
      rule.pattern.lastIndex = 0;
      let match;
      while ((match = rule.pattern.exec(content)) !== null) {
        violations.push({
          rule,
          location,
          match: match[0],
        });
      }
    }

    return {
      rulesChecked: this.rules.length,
      violations,
      compliant: violations.length === 0,
    };
  }

  /** Get all configured rules. */
  getRules(): ComplianceRule[] {
    return [...this.rules];
  }

  /** Add a custom rule. */
  addRule(rule: ComplianceRule): void {
    this.rules.push(rule);
  }
}

/** Session data that can be shared securely. */
export interface SessionData {
  /** Session identifier. */
  sessionId: string;
  /** Commands executed in this session. */
  commands: Array<{
    command: string;
    output: string;
    exitCode: number;
    timestamp: number;
  }>;
  /** Session metadata. */
  metadata: {
    createdAt: number;
    updatedAt: number;
    description?: string;
    tags?: string[];
  };
}

/** An encrypted session share. */
export interface EncryptedShare {
  /** Share identifier. */
  shareId: string;
  /** Encrypted session data (base64). */
  encryptedData: string;
  /** Initialization vector (base64). */
  iv: string;
  /** Salt used for key derivation (base64). */
  salt: string;
  /** Authentication tag (base64). */
  authTag: string;
  /**
   * Key derivation function iteration count used to derive the encryption key.
   * Optional for backward compatibility; new shares SHOULD set this.
   */
  kdfIterations?: number;
  /**
   * Identifier for the KDF/hash algorithm used (e.g., "PBKDF2-SHA256").
   * Optional for backward compatibility; new shares SHOULD set this.
   */
  kdfAlgorithm?: string;
  /** Expiration timestamp (0 for no expiration). */
  expiresAt: number;
  /** Creation timestamp. */
  createdAt: number;
  /** Whether the share requires viewer authentication. */
  requiresAuth: boolean;
}

/** Configuration for encrypted session sharing. */
export interface SessionShareConfig {
  /** Default expiration time in milliseconds (0 for no expiration). */
  defaultExpirationMs: number;
  /** Whether to require viewer authentication by default. */
  requireAuthByDefault: boolean;
  /** Key derivation iterations (higher = more secure but slower). */
  keyDerivationIterations: number;
}

const DEFAULT_SHARE_CONFIG: SessionShareConfig = {
  defaultExpirationMs: 24 * 60 * 60 * 1000, // 24 hours
  requireAuthByDefault: false,
  keyDerivationIterations: 100000,
};

/**
 * EncryptedSessionSharing provides end-to-end encrypted sharing
 * of terminal session recordings and replay data.
 */
export class EncryptedSessionSharing {
  private config: SessionShareConfig;
  private shares: Map<string, EncryptedShare> = new Map();

  constructor(config: Partial<SessionShareConfig> = {}) {
    this.config = { ...DEFAULT_SHARE_CONFIG, ...config };
  }

  /**
   * Create an encrypted share from session data.
   * Returns the share object and the password needed to decrypt it.
   */
  async createShare(
    session: SessionData,
    options: {
      expiresIn?: number;
      requireAuth?: boolean;
      password?: string;
    } = {}
  ): Promise<{ share: EncryptedShare; password: string }> {
    // Generate or use provided password
    const password = options.password ?? this.generatePassword();
    
    // Generate random salt and IV
    const salt = randomBytes(32);
    const iv = randomBytes(16);

    // Derive key from password using PBKDF2 (async to avoid blocking event loop)
    const key = await pbkdf2Async(
      password,
      salt,
      this.config.keyDerivationIterations,
      32,
      "sha256"
    );

    // Encrypt the session data using AES-256-GCM
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const sessionJson = JSON.stringify(session);
    
    const encrypted = Buffer.concat([
      cipher.update(sessionJson, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Create share object
    const shareId = this.generateShareId();
    const expiresAt = options.expiresIn !== undefined
      ? options.expiresIn > 0 ? Date.now() + options.expiresIn : 0
      : this.config.defaultExpirationMs > 0
        ? Date.now() + this.config.defaultExpirationMs
        : 0;

    const share: EncryptedShare = {
      shareId,
      encryptedData: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
      authTag: authTag.toString("base64"),
      expiresAt,
      createdAt: Date.now(),
      requiresAuth: options.requireAuth ?? this.config.requireAuthByDefault,
    };

    this.shares.set(shareId, share);

    return { share, password };
  }

  /**
   * Decrypt a shared session using the provided password.
   */
  async decryptShare(
    share: EncryptedShare,
    password: string
  ): Promise<SessionData | null> {
    // Check expiration
    if (share.expiresAt > 0 && Date.now() > share.expiresAt) {
      return null; // Share has expired
    }

    try {
      // Reconstruct key from password and salt (async to avoid blocking event loop)
      const salt = Buffer.from(share.salt, "base64");
      const key = await pbkdf2Async(
        password,
        salt,
        this.config.keyDerivationIterations,
        32,
        "sha256"
      );

      // Decrypt the data
      const iv = Buffer.from(share.iv, "base64");
      const encryptedData = Buffer.from(share.encryptedData, "base64");
      const authTag = Buffer.from(share.authTag, "base64");

      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(encryptedData),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString("utf8"));
    } catch {
      // Decryption failed (wrong password or corrupted data)
      return null;
    }
  }

  /**
   * Get a share by its ID.
   * Returns a defensive copy to prevent external mutation.
   */
  getShare(shareId: string): EncryptedShare | null {
    const share = this.shares.get(shareId);
    if (!share) return null;

    // Check expiration
    if (share.expiresAt > 0 && Date.now() > share.expiresAt) {
      this.shares.delete(shareId);
      return null;
    }

    // Return defensive copy
    return { ...share };
  }

  /**
   * Revoke (delete) a share.
   */
  revokeShare(shareId: string): boolean {
    return this.shares.delete(shareId);
  }

  /**
   * List all active (non-expired) shares.
   * Returns defensive copies to prevent external mutation.
   */
  listShares(): EncryptedShare[] {
    const now = Date.now();
    const active: EncryptedShare[] = [];

    for (const [id, share] of this.shares.entries()) {
      if (share.expiresAt > 0 && now > share.expiresAt) {
        this.shares.delete(id);
      } else {
        // Return defensive copy
        active.push({ ...share });
      }
    }

    return active;
  }

  /**
   * Generate a shareable link (URL-safe format).
   */
  generateShareLink(shareId: string, baseUrl: string = "https://overcoat.dev/share"): string {
    return `${baseUrl}/${shareId}`;
  }

  /**
   * Clean up expired shares.
   */
  cleanupExpired(): number {
    const now = Date.now();
    let count = 0;

    for (const [id, share] of this.shares.entries()) {
      if (share.expiresAt > 0 && now > share.expiresAt) {
        this.shares.delete(id);
        count++;
      }
    }

    return count;
  }

  /**
   * Generate a cryptographically secure random index for character selection.
   * Uses rejection sampling to avoid modulo bias.
   */
  private secureRandomIndex(charsetLength: number): number {
    // Calculate the maximum value that divides evenly by charsetLength
    const maxValid = 256 - (256 % charsetLength);
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const byte = randomBytes(1)[0];
      // Reject values that would cause bias
      if (byte < maxValid) {
        return byte % charsetLength;
      }
    }
  }

  private generatePassword(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(this.secureRandomIndex(chars.length));
    }
    return password;
  }

  private generateShareId(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let id = "";
    for (let i = 0; i < 12; i++) {
      id += chars.charAt(this.secureRandomIndex(chars.length));
    }
    return id;
  }
}
