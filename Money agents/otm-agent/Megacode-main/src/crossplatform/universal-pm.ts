/**
 * Cross-Platform Intelligence for OverCoat.
 *
 * Implementation plan for cross-platform compatibility:
 *
 * 1. Universal Package Manager
 *    - One interface for npm/pip/brew/apt/cargo
 *    - Detects the appropriate package manager for the current project
 *    - Normalizes install/uninstall/update/search commands
 *    - Implementation: Package manager registry with command templates,
 *      auto-detection based on lockfiles and project type,
 *      unified CLI interface with package manager abstraction
 *
 * 2. Environment Parity Checker
 *    - Ensures dev/staging/prod environments match
 *    - Compares dependency versions, env vars, and system configs
 *    - Generates diff reports between environments
 *    - Implementation: Environment snapshot capture (deps, env vars, OS info),
 *      diff engine for comparing snapshots, alert system for drift detection
 *
 * 3. Cross-Platform Compatibility Layer
 *    - Writes commands that work on any OS
 *    - Translates OS-specific commands between platforms
 *    - Path normalization, shell compatibility
 *    - Implementation: Command translation tables per OS/shell,
 *      path separator handling, environment variable syntax conversion
 */

import { platform } from "os";

/** Supported package manager types. */
export type PackageManagerType =
  | "npm"
  | "yarn"
  | "pnpm"
  | "pip"
  | "pip3"
  | "brew"
  | "apt"
  | "cargo"
  | "go";

/** Unified package operation. */
export type PackageOperation =
  | "install"
  | "uninstall"
  | "update"
  | "search"
  | "list";

/** Result of a package manager operation. */
export interface PackageResult {
  manager: PackageManagerType;
  operation: PackageOperation;
  packages: string[];
  /** The actual command that was (or would be) executed. */
  command: string;
  success: boolean;
  output?: string;
}

/** Environment snapshot for parity checking. */
export interface EnvironmentSnapshot {
  name: string;
  /** Operating system (e.g., "linux", "darwin", "win32"). */
  os: string;
  /** Node.js version if available. */
  nodeVersion?: string;
  /** Package dependencies and their versions. */
  dependencies: Record<string, string>;
  /** Environment variables (names only, values optionally included). */
  envVars: string[];
  /** Captured timestamp. */
  capturedAt: number;
}

/** Difference between two environment snapshots. */
export interface EnvironmentDiff {
  /** Environment names being compared. */
  environments: [string, string];
  /** Dependencies only in the first environment. */
  onlyInFirst: Record<string, string>;
  /** Dependencies only in the second environment. */
  onlyInSecond: Record<string, string>;
  /** Dependencies with version mismatches. */
  versionMismatches: Array<{
    package: string;
    firstVersion: string;
    secondVersion: string;
  }>;
  /** Env vars only in first. */
  envOnlyInFirst: string[];
  /** Env vars only in second. */
  envOnlyInSecond: string[];
  /** Whether the environments are in parity. */
  inParity: boolean;
}

/** OS-specific command translation. */
export interface CommandTranslation {
  /** The original command. */
  original: string;
  /** The platform it was written for. */
  sourcePlatform: string;
  /** The translated command for the target platform. */
  translated: string;
  /** The target platform. */
  targetPlatform: string;
  /** Any warnings about the translation. */
  warnings: string[];
}

/** Command templates for each package manager. */
const PM_COMMANDS: Record<
  PackageManagerType,
  Record<PackageOperation, string>
> = {
  npm: {
    install: "npm install",
    uninstall: "npm uninstall",
    update: "npm update",
    search: "npm search",
    list: "npm list --depth=0",
  },
  yarn: {
    install: "yarn add",
    uninstall: "yarn remove",
    update: "yarn upgrade",
    search: "yarn info",
    list: "yarn list --depth=0",
  },
  pnpm: {
    install: "pnpm add",
    uninstall: "pnpm remove",
    update: "pnpm update",
    search: "pnpm search",
    list: "pnpm list --depth=0",
  },
  pip: {
    install: "pip install",
    uninstall: "pip uninstall -y",
    update: "pip install --upgrade",
    search: "pip index versions",
    list: "pip list",
  },
  pip3: {
    install: "pip3 install",
    uninstall: "pip3 uninstall -y",
    update: "pip3 install --upgrade",
    search: "pip3 index versions",
    list: "pip3 list",
  },
  brew: {
    install: "brew install",
    uninstall: "brew uninstall",
    update: "brew upgrade",
    search: "brew search",
    list: "brew list",
  },
  apt: {
    install: "sudo apt-get install -y",
    uninstall: "sudo apt-get remove -y",
    update: "sudo apt-get upgrade -y",
    search: "apt-cache search",
    list: "dpkg --list",
  },
  cargo: {
    install: "cargo install",
    uninstall: "cargo uninstall",
    update: "cargo install --force",
    search: "cargo search",
    list: "cargo install --list",
  },
  go: {
    install: "go install",
    uninstall: "go clean -i",
    update: "go get -u",
    search: "go list -m",
    list: "go list -m all",
  },
};

/** Lockfile-to-package-manager detection map. */
const LOCKFILE_MAP: Record<string, PackageManagerType> = {
  "package-lock.json": "npm",
  "yarn.lock": "yarn",
  "pnpm-lock.yaml": "pnpm",
  "Pipfile.lock": "pip",
  "requirements.txt": "pip",
  "Cargo.lock": "cargo",
  "go.sum": "go",
};

/**
 * UniversalPackageManager provides a unified interface across
 * npm, pip, brew, apt, cargo, and other package managers.
 */
export class UniversalPackageManager {
  /**
   * Detect the appropriate package manager based on lockfiles present.
   */
  detect(files: string[]): PackageManagerType | null {
    for (const file of files) {
      const basename = file.split("/").pop() ?? "";
      if (basename in LOCKFILE_MAP) {
        return LOCKFILE_MAP[basename];
      }
    }
    return null;
  }

  /**
   * Build the command string for a given operation.
   */
  buildCommand(
    manager: PackageManagerType,
    operation: PackageOperation,
    packages: string[] = []
  ): string {
    const base = PM_COMMANDS[manager]?.[operation];
    if (!base) return "";
    return packages.length > 0
      ? `${base} ${packages.join(" ")}`
      : base;
  }

  /** Get supported package managers. */
  getSupportedManagers(): PackageManagerType[] {
    return Object.keys(PM_COMMANDS) as PackageManagerType[];
  }
}

/**
 * EnvironmentParityChecker compares environment snapshots to
 * detect drift between dev, staging, and production.
 */
export class EnvironmentParityChecker {
  /**
   * Create a snapshot of the current environment.
   */
  captureSnapshot(
    name: string,
    dependencies: Record<string, string>,
    envVarNames: string[]
  ): EnvironmentSnapshot {
    return {
      name,
      os: platform(),
      nodeVersion: process.version,
      dependencies,
      envVars: envVarNames,
      capturedAt: Date.now(),
    };
  }

  /**
   * Compare two environment snapshots and produce a diff.
   */
  compare(
    first: EnvironmentSnapshot,
    second: EnvironmentSnapshot
  ): EnvironmentDiff {
    const onlyInFirst: Record<string, string> = {};
    const onlyInSecond: Record<string, string> = {};
    const versionMismatches: EnvironmentDiff["versionMismatches"] = [];

    // Compare dependencies
    for (const [pkg, ver] of Object.entries(first.dependencies)) {
      if (!(pkg in second.dependencies)) {
        onlyInFirst[pkg] = ver;
      } else if (second.dependencies[pkg] !== ver) {
        versionMismatches.push({
          package: pkg,
          firstVersion: ver,
          secondVersion: second.dependencies[pkg],
        });
      }
    }
    for (const [pkg, ver] of Object.entries(second.dependencies)) {
      if (!(pkg in first.dependencies)) {
        onlyInSecond[pkg] = ver;
      }
    }

    // Compare env vars
    const envOnlyInFirst = first.envVars.filter(
      (v) => !second.envVars.includes(v)
    );
    const envOnlyInSecond = second.envVars.filter(
      (v) => !first.envVars.includes(v)
    );

    const inParity =
      Object.keys(onlyInFirst).length === 0 &&
      Object.keys(onlyInSecond).length === 0 &&
      versionMismatches.length === 0 &&
      envOnlyInFirst.length === 0 &&
      envOnlyInSecond.length === 0;

    return {
      environments: [first.name, second.name],
      onlyInFirst,
      onlyInSecond,
      versionMismatches,
      envOnlyInFirst,
      envOnlyInSecond,
      inParity,
    };
  }
}

/**
 * CrossPlatformCompat translates OS-specific commands between platforms.
 */
export class CrossPlatformCompat {
  /**
   * Get the current platform identifier.
   */
  currentPlatform(): string {
    return platform();
  }

  /**
   * Normalize a file path for the current OS.
   */
  normalizePath(filePath: string): string {
    if (platform() === "win32") {
      return filePath.replace(/\//g, "\\");
    }
    return filePath.replace(/\\/g, "/");
  }

  /**
   * Translate common command patterns between platforms.
   */
  translateCommand(
    command: string,
    targetPlatform: string
  ): CommandTranslation {
    const sourcePlatform = platform();
    let translated = command;
    const warnings: string[] = [];

    if (targetPlatform === "win32" && sourcePlatform !== "win32") {
      // Unix → Windows translations
      translated = translated.replace(/\bls\b/g, "dir");
      translated = translated.replace(/\bcat\b/g, "type");
      translated = translated.replace(/\brm\b/g, "del");
      translated = translated.replace(/\bcp\b/g, "copy");
      translated = translated.replace(/\bmv\b/g, "move");
      translated = translated.replace(/\bmkdir -p\b/g, "mkdir");
      if (command.includes("|") || command.includes("&&")) {
        warnings.push(
          "Pipe and chaining operators may behave differently in cmd.exe"
        );
      }
    } else if (targetPlatform !== "win32" && sourcePlatform === "win32") {
      // Windows → Unix translations
      translated = translated.replace(/\bdir\b/g, "ls");
      translated = translated.replace(/\btype\b/g, "cat");
      translated = translated.replace(/\bdel\b/g, "rm");
      translated = translated.replace(/\bcopy\b/g, "cp");
      translated = translated.replace(/\bmove\b/g, "mv");
    }

    return {
      original: command,
      sourcePlatform,
      translated,
      targetPlatform,
      warnings,
    };
  }

  /**
   * Translate environment variable syntax between platforms.
   *
   * - Unix syntax uses `$VAR` or `${VAR}`
   * - Windows cmd.exe syntax uses `%VAR%`
   * - PowerShell syntax uses `$env:VAR`
   *
   * @param text          The text containing environment variable references.
   * @param targetPlatform  Target platform: "win32", "powershell", or "unix".
   * @returns The text with env var references translated for the target platform.
   */
  translateEnvVars(text: string, targetPlatform: string): string {
    if (targetPlatform === "win32") {
      // Unix $VAR and ${VAR} → Windows %VAR%
      return text
        .replace(/\$\{(\w+)\}/g, "%$1%")
        .replace(/\$(\w+)/g, "%$1%");
    }
    if (targetPlatform === "powershell") {
      // Unix $VAR and ${VAR} → PowerShell $env:VAR
      return text
        .replace(/\$\{(\w+)\}/g, "$$env:$1")
        .replace(/\$(\w+)/g, "$$env:$1");
    }
    // Windows %VAR% → Unix $VAR
    if (platform() === "win32" || text.includes("%")) {
      return text.replace(/%(\w+)%/g, "$$$1");
    }
    return text;
  }
}
