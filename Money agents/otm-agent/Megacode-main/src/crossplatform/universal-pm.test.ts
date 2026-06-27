import {
  UniversalPackageManager,
  EnvironmentParityChecker,
  CrossPlatformCompat,
} from "./universal-pm";

describe("UniversalPackageManager", () => {
  const pm = new UniversalPackageManager();

  describe("detect", () => {
    it("detects npm from package-lock.json", () => {
      expect(pm.detect(["package-lock.json"])).toBe("npm");
    });

    it("detects yarn from yarn.lock", () => {
      expect(pm.detect(["yarn.lock"])).toBe("yarn");
    });

    it("detects pip from requirements.txt", () => {
      expect(pm.detect(["requirements.txt"])).toBe("pip");
    });

    it("detects cargo from Cargo.lock", () => {
      expect(pm.detect(["Cargo.lock"])).toBe("cargo");
    });

    it("returns null when no lockfile found", () => {
      expect(pm.detect(["README.md"])).toBeNull();
    });
  });

  describe("buildCommand", () => {
    it("builds npm install command", () => {
      expect(pm.buildCommand("npm", "install", ["express"])).toBe(
        "npm install express"
      );
    });

    it("builds pip install command", () => {
      expect(pm.buildCommand("pip", "install", ["flask", "django"])).toBe(
        "pip install flask django"
      );
    });

    it("builds list command without packages", () => {
      expect(pm.buildCommand("npm", "list")).toBe("npm list --depth=0");
    });
  });

  describe("getSupportedManagers", () => {
    it("returns all supported managers", () => {
      const managers = pm.getSupportedManagers();
      expect(managers).toContain("npm");
      expect(managers).toContain("pip");
      expect(managers).toContain("cargo");
    });
  });
});

describe("EnvironmentParityChecker", () => {
  const checker = new EnvironmentParityChecker();

  it("captures a snapshot", () => {
    const snapshot = checker.captureSnapshot(
      "dev",
      { express: "4.18.0" },
      ["NODE_ENV"]
    );
    expect(snapshot.name).toBe("dev");
    expect(snapshot.dependencies.express).toBe("4.18.0");
  });

  it("detects parity between identical environments", () => {
    const a = checker.captureSnapshot("dev", { react: "18.0" }, ["NODE_ENV"]);
    const b = checker.captureSnapshot("staging", { react: "18.0" }, ["NODE_ENV"]);
    const diff = checker.compare(a, b);
    expect(diff.inParity).toBe(true);
  });

  it("detects version mismatches", () => {
    const a = checker.captureSnapshot("dev", { react: "17.0" }, []);
    const b = checker.captureSnapshot("prod", { react: "18.0" }, []);
    const diff = checker.compare(a, b);
    expect(diff.inParity).toBe(false);
    expect(diff.versionMismatches).toHaveLength(1);
  });

  it("detects missing dependencies", () => {
    const a = checker.captureSnapshot("dev", { react: "18.0", lodash: "4.0" }, []);
    const b = checker.captureSnapshot("prod", { react: "18.0" }, []);
    const diff = checker.compare(a, b);
    expect(Object.keys(diff.onlyInFirst)).toContain("lodash");
  });
});

describe("CrossPlatformCompat", () => {
  const compat = new CrossPlatformCompat();

  it("returns current platform", () => {
    expect(compat.currentPlatform()).toBeTruthy();
  });

  it("normalizes paths", () => {
    const result = compat.normalizePath("src\\index.ts");
    // On Linux/Mac, should convert to forward slashes
    if (process.platform !== "win32") {
      expect(result).toBe("src/index.ts");
    }
  });

  it("translates commands to win32", () => {
    const result = compat.translateCommand("ls -la", "win32");
    if (process.platform !== "win32") {
      expect(result.translated).toContain("dir");
    }
  });
});

describe("CrossPlatformCompat - env var translation", () => {
  const compat = new CrossPlatformCompat();

  it("translates Unix $VAR to Windows %VAR%", () => {
    const result = compat.translateEnvVars("echo $HOME", "win32");
    expect(result).toBe("echo %HOME%");
  });

  it("translates Unix ${VAR} to Windows %VAR%", () => {
    const result = compat.translateEnvVars("echo ${NODE_ENV}", "win32");
    expect(result).toBe("echo %NODE_ENV%");
  });

  it("translates Unix $VAR to PowerShell $env:VAR", () => {
    const result = compat.translateEnvVars("echo $PATH", "powershell");
    expect(result).toBe("echo $env:PATH");
  });

  it("translates multiple vars in one string", () => {
    const result = compat.translateEnvVars("$USER@$HOST", "win32");
    expect(result).toBe("%USER%@%HOST%");
  });

  it("translates Windows %VAR% to Unix $VAR", () => {
    const result = compat.translateEnvVars("echo %USERPROFILE%", "unix");
    expect(result).toBe("echo $USERPROFILE");
  });
});
