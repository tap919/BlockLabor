import {
  SecretDetector,
  PermissionAuditor,
  ComplianceChecker,
  EncryptedSessionSharing,
} from "./compliance";

describe("SecretDetector", () => {
  const detector = new SecretDetector();

  it("detects AWS access keys", () => {
    const findings = detector.scan("config.js", 'const key = "AKIAIOSFODNN7EXAMPLE";');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe("aws-access-key");
    expect(findings[0].severity).toBe("critical");
  });

  it("detects GitHub tokens", () => {
    const findings = detector.scan("env.js", 'const token = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij";');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].type).toBe("github-token");
  });

  it("detects generic passwords", () => {
    const findings = detector.scan("config.ts", 'password = "myS3cur3P@ss"');
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].severity).toBe("high");
  });

  it("returns empty for clean files", () => {
    const findings = detector.scan("clean.ts", 'const x = 42;\nconsole.log(x);');
    expect(findings).toEqual([]);
  });

  it("redacts matched content", () => {
    const findings = detector.scan("key.js", 'const k = "AKIAIOSFODNN7EXAMPLE";');
    expect(findings[0].redactedMatch).not.toBe("AKIAIOSFODNN7EXAMPLE");
    expect(findings[0].redactedMatch).toContain("****");
  });
});

describe("PermissionAuditor", () => {
  const auditor = new PermissionAuditor();

  it("detects sudo usage", () => {
    const result = auditor.audit("deploy.sh", "sudo systemctl restart app\nsudo chmod 755 /opt/app");
    expect(result.elevatedCount).toBe(2);
    expect(result.summary).toContain("sudo access for 2 operations");
  });

  it("reports no elevated privileges for safe scripts", () => {
    const result = auditor.audit("build.sh", "npm run build\nnpm test");
    expect(result.elevatedCount).toBe(0);
    expect(result.summary).toContain("No elevated privileges required");
  });

  it("detects permission-related commands", () => {
    const result = auditor.audit("setup.sh", "chmod 700 /secret\nchown root:root /etc/config");
    expect(result.requirements.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ComplianceChecker", () => {
  const checker = new ComplianceChecker();

  it("detects eval() usage", () => {
    const result = checker.check('eval("dangerous code")', "app.js");
    expect(result.compliant).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].rule.id).toBe("no-eval");
  });

  it("detects plain HTTP URLs", () => {
    const result = checker.check('fetch("http://api.example.com/data")', "client.js");
    expect(result.compliant).toBe(false);
    expect(result.violations.some((v) => v.rule.id === "https-only")).toBe(true);
  });

  it("allows localhost HTTP", () => {
    const result = checker.check('fetch("http://localhost:3000")', "dev.js");
    // localhost HTTP should not trigger https-only
    expect(result.violations.every((v) => v.rule.id !== "https-only")).toBe(true);
  });

  it("passes for compliant code", () => {
    const result = checker.check('const x = 1 + 2;', "safe.ts");
    expect(result.compliant).toBe(true);
  });

  it("supports custom rules", () => {
    const custom = new ComplianceChecker([
      {
        id: "no-console",
        description: "No console.log",
        severity: "medium",
        category: "quality",
        pattern: /console\.log/g,
        remediation: "Use a proper logger",
      },
    ]);
    const result = custom.check('console.log("hi")', "app.ts");
    expect(result.violations.some((v) => v.rule.id === "no-console")).toBe(true);
  });
});

describe("EncryptedSessionSharing", () => {
  let sharing: EncryptedSessionSharing;

  const testSession = {
    sessionId: "test-session-123",
    commands: [
      { command: "npm test", output: "All tests passed", exitCode: 0, timestamp: Date.now() },
    ],
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      description: "Test session",
      tags: ["test"],
    },
  };

  beforeEach(() => {
    sharing = new EncryptedSessionSharing();
  });

  describe("createShare", () => {
    it("creates an encrypted share with generated password", async () => {
      const { share, password } = await sharing.createShare(testSession);
      expect(share.shareId).toBeTruthy();
      expect(share.encryptedData).toBeTruthy();
      expect(share.iv).toBeTruthy();
      expect(share.salt).toBeTruthy();
      expect(share.authTag).toBeTruthy();
      expect(password).toHaveLength(16);
    });

    it("creates an encrypted share with custom password", async () => {
      const customPassword = "myCustomPassword123";
      const { share, password } = await sharing.createShare(testSession, {
        password: customPassword,
      });
      expect(password).toBe(customPassword);
      expect(share.encryptedData).toBeTruthy();
    });

    it("sets expiration based on config default", async () => {
      const { share } = await sharing.createShare(testSession);
      expect(share.expiresAt).toBeGreaterThan(Date.now());
    });

    it("allows custom expiration", async () => {
      const { share } = await sharing.createShare(testSession, {
        expiresIn: 3600000, // 1 hour
      });
      const expectedExpiry = Date.now() + 3600000;
      expect(share.expiresAt).toBeLessThanOrEqual(expectedExpiry + 100);
      expect(share.expiresAt).toBeGreaterThanOrEqual(expectedExpiry - 100);
    });

    it("allows no expiration", async () => {
      const { share } = await sharing.createShare(testSession, {
        expiresIn: 0,
      });
      expect(share.expiresAt).toBe(0);
    });
  });

  describe("decryptShare", () => {
    it("decrypts share with correct password", async () => {
      const { share, password } = await sharing.createShare(testSession);
      const decrypted = await sharing.decryptShare(share, password);
      expect(decrypted).not.toBeNull();
      expect(decrypted?.sessionId).toBe(testSession.sessionId);
      expect(decrypted?.commands).toEqual(testSession.commands);
    });

    it("returns null for wrong password", async () => {
      const { share } = await sharing.createShare(testSession);
      const decrypted = await sharing.decryptShare(share, "wrong-password");
      expect(decrypted).toBeNull();
    });

    it("returns null for expired share", async () => {
      const { share, password } = await sharing.createShare(testSession, {
        expiresIn: 1, // 1ms
      });
      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 10));
      const decrypted = await sharing.decryptShare(share, password);
      expect(decrypted).toBeNull();
    });
  });

  describe("getShare", () => {
    it("retrieves an existing share", async () => {
      const { share } = await sharing.createShare(testSession);
      const retrieved = sharing.getShare(share.shareId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.shareId).toBe(share.shareId);
    });

    it("returns null for non-existent share", () => {
      const retrieved = sharing.getShare("nonexistent");
      expect(retrieved).toBeNull();
    });
  });

  describe("revokeShare", () => {
    it("removes an existing share", async () => {
      const { share } = await sharing.createShare(testSession);
      const result = sharing.revokeShare(share.shareId);
      expect(result).toBe(true);
      expect(sharing.getShare(share.shareId)).toBeNull();
    });

    it("returns false for non-existent share", () => {
      const result = sharing.revokeShare("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("listShares", () => {
    it("lists all active shares", async () => {
      await sharing.createShare(testSession);
      await sharing.createShare(testSession);
      const shares = sharing.listShares();
      expect(shares).toHaveLength(2);
    });
  });

  describe("generateShareLink", () => {
    it("generates a share link", async () => {
      const { share } = await sharing.createShare(testSession);
      const link = sharing.generateShareLink(share.shareId);
      expect(link).toContain(share.shareId);
      expect(link).toContain("overcoat.dev/share");
    });

    it("uses custom base URL", async () => {
      const { share } = await sharing.createShare(testSession);
      const link = sharing.generateShareLink(share.shareId, "https://custom.dev/s");
      expect(link).toContain("custom.dev/s");
    });
  });
});
