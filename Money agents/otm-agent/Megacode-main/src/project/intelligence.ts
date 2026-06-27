/**
 * Project-Specific Intelligence for OverCoat.
 *
 * Implementation plan for project intelligence features:
 *
 * 1. Framework Detection
 *    - Auto-configures for React/Django/Spring/etc
 *    - Detects framework from config files, dependencies, and structure
 *    - Implementation: Config file pattern matching, dependency analysis,
 *      directory structure heuristics, framework-specific configuration
 *      generation, IDE settings auto-population
 *
 * 2. Best Practice Enforcer
 *    - Suggests improvements based on project type
 *    - Framework-specific linting rules and recommendations
 *    - Implementation: Rule sets per framework/language,
 *      project structure validation, dependency health checks,
 *      coding convention enforcement, documentation coverage
 *
 * 3. Migration Assistant
 *    - Helps upgrade dependencies automatically
 *    - Detects breaking changes and generates migration plans
 *    - Implementation: Version comparison with changelogs,
 *      breaking change detection from release notes,
 *      automated code modifications (codemods),
 *      rollback support for failed migrations
 *
 * 4. Technical Debt Tracker
 *    - Identifies and prioritizes refactoring opportunities
 *    - Tracks code smells, complexity, and maintenance burden
 *    - Implementation: Code complexity analysis (cyclomatic/cognitive),
 *      TODO/FIXME/HACK counter with trending, dependency age tracking,
 *      file churn analysis from git history, prioritized debt backlog
 */

/** A detected framework with its configuration. */
export interface DetectedFramework {
  /** Framework identifier (e.g., "react", "django", "spring"). */
  id: string;
  /** Display name. */
  name: string;
  /** Framework version, if detected. */
  version?: string;
  /** Confidence of detection (0-1). */
  confidence: number;
  /** Detection source (e.g., "package.json", "requirements.txt"). */
  detectedFrom: string;
  /** Category (e.g., "frontend", "backend", "fullstack", "library"). */
  category: string;
}

/** A best practice recommendation. */
export interface BestPractice {
  /** Rule identifier. */
  id: string;
  /** Category (e.g., "structure", "security", "performance", "testing"). */
  category: string;
  /** The recommendation text. */
  recommendation: string;
  /** Current state (what was found). */
  current: string;
  /** Ideal state. */
  ideal: string;
  /** Priority (1-10, higher = more important). */
  priority: number;
  /** Effort to fix ("low", "medium", "high"). */
  effort: "low" | "medium" | "high";
  /** Applicable framework/project type. */
  appliesTo: string;
}

/** A dependency migration plan. */
export interface MigrationPlan {
  /** Package/dependency name. */
  package: string;
  /** Current version. */
  fromVersion: string;
  /** Target version. */
  toVersion: string;
  /** Whether there are breaking changes. */
  hasBreakingChanges: boolean;
  /** Description of changes. */
  changes: string[];
  /** Migration steps. */
  steps: MigrationStep[];
  /** Risk level. */
  risk: "low" | "medium" | "high";
}

export interface MigrationStep {
  /** Step description. */
  description: string;
  /** Type of step. */
  type: "update-dependency" | "code-change" | "config-change" | "manual";
  /** Files affected. */
  files: string[];
  /** Whether this step is automated. */
  automated: boolean;
}

/** A technical debt item. */
export interface TechDebtItem {
  /** Unique identifier. */
  id: string;
  /** Type of debt (e.g., "code-smell", "outdated-dep", "missing-test", "complexity"). */
  type: string;
  /** Human-readable description. */
  description: string;
  /** Affected file or component. */
  location: string;
  /** Severity (1-10). */
  severity: number;
  /** Estimated effort to resolve (in hours). */
  estimatedHours: number;
  /** When this item was first detected. */
  detectedAt: number;
  /** Category for grouping. */
  category: string;
}

/** Summary of technical debt in a project. */
export interface TechDebtSummary {
  /** Total number of debt items. */
  totalItems: number;
  /** Total estimated hours to resolve all debt. */
  totalEstimatedHours: number;
  /** Breakdown by type. */
  byType: Record<string, number>;
  /** Breakdown by severity. */
  bySeverity: Record<string, number>;
  /** Top priority items. */
  topPriority: TechDebtItem[];
  /** Trend (is debt increasing or decreasing). */
  trend: "increasing" | "stable" | "decreasing";
}

/** Framework detection patterns. */
const FRAMEWORK_PATTERNS: Array<{
  id: string;
  name: string;
  category: string;
  indicators: Array<{
    type: "file" | "dependency" | "devDependency";
    value: string;
  }>;
}> = [
  {
    id: "react",
    name: "React",
    category: "frontend",
    indicators: [
      { type: "dependency", value: "react" },
      { type: "dependency", value: "react-dom" },
    ],
  },
  {
    id: "nextjs",
    name: "Next.js",
    category: "fullstack",
    indicators: [
      { type: "dependency", value: "next" },
      { type: "file", value: "next.config.js" },
    ],
  },
  {
    id: "vue",
    name: "Vue.js",
    category: "frontend",
    indicators: [
      { type: "dependency", value: "vue" },
      { type: "file", value: "vue.config.js" },
    ],
  },
  {
    id: "angular",
    name: "Angular",
    category: "frontend",
    indicators: [
      { type: "dependency", value: "@angular/core" },
      { type: "file", value: "angular.json" },
    ],
  },
  {
    id: "express",
    name: "Express.js",
    category: "backend",
    indicators: [{ type: "dependency", value: "express" }],
  },
  {
    id: "django",
    name: "Django",
    category: "backend",
    indicators: [
      { type: "dependency", value: "django" },
      { type: "file", value: "manage.py" },
    ],
  },
  {
    id: "flask",
    name: "Flask",
    category: "backend",
    indicators: [{ type: "dependency", value: "flask" }],
  },
  {
    id: "spring",
    name: "Spring Boot",
    category: "backend",
    indicators: [{ type: "file", value: "pom.xml" }],
  },
  {
    id: "rails",
    name: "Ruby on Rails",
    category: "fullstack",
    indicators: [
      { type: "file", value: "Gemfile" },
      { type: "file", value: "config/routes.rb" },
    ],
  },
  {
    id: "svelte",
    name: "Svelte",
    category: "frontend",
    indicators: [
      { type: "dependency", value: "svelte" },
      { type: "file", value: "svelte.config.js" },
    ],
  },
];

/**
 * FrameworkDetector identifies frameworks used in a project.
 */
export class FrameworkDetector {
  /**
   * Detect frameworks based on files and dependencies.
   */
  detect(
    files: string[],
    dependencies: Record<string, string> = {},
    devDependencies: Record<string, string> = {}
  ): DetectedFramework[] {
    const detected: DetectedFramework[] = [];

    for (const framework of FRAMEWORK_PATTERNS) {
      let matchCount = 0;
      let detectedFrom = "";

      for (const indicator of framework.indicators) {
        if (indicator.type === "file" && files.includes(indicator.value)) {
          matchCount++;
          detectedFrom = indicator.value;
        } else if (
          indicator.type === "dependency" &&
          indicator.value in dependencies
        ) {
          matchCount++;
          detectedFrom = "dependencies";
        } else if (
          indicator.type === "devDependency" &&
          indicator.value in devDependencies
        ) {
          matchCount++;
          detectedFrom = "devDependencies";
        }
      }

      if (matchCount > 0) {
        const confidence = matchCount / framework.indicators.length;
        detected.push({
          id: framework.id,
          name: framework.name,
          version: dependencies[framework.indicators[0]?.value ?? ""],
          confidence,
          detectedFrom,
          category: framework.category,
        });
      }
    }

    return detected.sort((a, b) => b.confidence - a.confidence);
  }
}

/**
 * BestPracticeEnforcer checks projects against best practices
 * for their detected framework/language.
 */
export class BestPracticeEnforcer {
  /**
   * Check a project for best practice violations.
   */
  check(
    projectType: string,
    files: string[],
    dependencies: Record<string, string> = {}
  ): BestPractice[] {
    const practices: BestPractice[] = [];

    // Universal best practices
    if (!files.includes("README.md") && !files.includes("readme.md")) {
      practices.push({
        id: "missing-readme",
        category: "documentation",
        recommendation: "Add a README.md file with project description, setup, and usage instructions",
        current: "No README.md found",
        ideal: "Comprehensive README with setup instructions",
        priority: 8,
        effort: "low",
        appliesTo: "all",
      });
    }

    if (!files.includes(".gitignore")) {
      practices.push({
        id: "missing-gitignore",
        category: "structure",
        recommendation: "Add a .gitignore file to exclude build artifacts and dependencies",
        current: "No .gitignore found",
        ideal: ".gitignore with appropriate patterns for your project type",
        priority: 7,
        effort: "low",
        appliesTo: "all",
      });
    }

    if (!files.some((f) => f.includes("LICENSE"))) {
      practices.push({
        id: "missing-license",
        category: "documentation",
        recommendation: "Add a LICENSE file to clarify how your code can be used",
        current: "No LICENSE file found",
        ideal: "LICENSE file with appropriate open source license",
        priority: 6,
        effort: "low",
        appliesTo: "all",
      });
    }

    // Node.js specific
    if (projectType === "node" || files.includes("package.json")) {
      if (!files.some((f) => f.includes(".lock") || f.includes("lock."))) {
        practices.push({
          id: "missing-lockfile",
          category: "reliability",
          recommendation: "Commit your lockfile (package-lock.json, yarn.lock, or pnpm-lock.yaml)",
          current: "No lockfile found",
          ideal: "Lockfile committed for reproducible installs",
          priority: 9,
          effort: "low",
          appliesTo: "node",
        });
      }

      if (!files.some((f) => f.includes("tsconfig") || f.includes(".eslintrc"))) {
        practices.push({
          id: "missing-linting",
          category: "quality",
          recommendation: "Add TypeScript or ESLint configuration for code quality",
          current: "No linting configuration found",
          ideal: "ESLint and/or TypeScript strict mode configured",
          priority: 7,
          effort: "medium",
          appliesTo: "node",
        });
      }
    }

    // Python specific
    if (projectType === "python" || files.some((f) => f.endsWith(".py"))) {
      if (!files.includes("requirements.txt") && !files.includes("pyproject.toml")) {
        practices.push({
          id: "missing-requirements",
          category: "reliability",
          recommendation: "Add a requirements.txt or pyproject.toml to declare dependencies",
          current: "No dependency file found",
          ideal: "requirements.txt or pyproject.toml with pinned dependencies",
          priority: 9,
          effort: "low",
          appliesTo: "python",
        });
      }

      if (!files.some((f) => f.includes("test_") || f.includes("_test.py"))) {
        practices.push({
          id: "missing-python-tests",
          category: "testing",
          recommendation: "Add Python tests using pytest (files named test_*.py)",
          current: "No test files found",
          ideal: "Test files following pytest conventions",
          priority: 8,
          effort: "medium",
          appliesTo: "python",
        });
      }

      if (!files.includes(".flake8") && !files.includes("setup.cfg") && !dependencies["black"] && !dependencies["ruff"]) {
        practices.push({
          id: "missing-python-linting",
          category: "quality",
          recommendation: "Add a Python linter/formatter such as ruff, flake8, or black",
          current: "No linting configuration found",
          ideal: "ruff, flake8, or black configured in pyproject.toml or setup.cfg",
          priority: 6,
          effort: "low",
          appliesTo: "python",
        });
      }
    }

    // Rust specific
    if (projectType === "rust" || files.includes("Cargo.toml")) {
      if (!files.includes("Cargo.lock")) {
        practices.push({
          id: "missing-cargo-lock",
          category: "reliability",
          recommendation: "Commit Cargo.lock for reproducible builds (applications only)",
          current: "No Cargo.lock found",
          ideal: "Cargo.lock committed for binary crates",
          priority: 7,
          effort: "low",
          appliesTo: "rust",
        });
      }

      if (!files.includes("rustfmt.toml") && !files.includes(".rustfmt.toml")) {
        practices.push({
          id: "missing-rustfmt-config",
          category: "quality",
          recommendation: "Add a rustfmt.toml to enforce consistent code formatting",
          current: "No rustfmt configuration found",
          ideal: "rustfmt.toml with project formatting preferences",
          priority: 5,
          effort: "low",
          appliesTo: "rust",
        });
      }
    }

    // Go specific
    if (projectType === "go" || files.includes("go.mod")) {
      if (!files.includes("go.sum")) {
        practices.push({
          id: "missing-go-sum",
          category: "reliability",
          recommendation: "Commit go.sum for dependency verification",
          current: "No go.sum found",
          ideal: "go.sum committed alongside go.mod",
          priority: 9,
          effort: "low",
          appliesTo: "go",
        });
      }

      if (!files.some((f) => f.endsWith("_test.go"))) {
        practices.push({
          id: "missing-go-tests",
          category: "testing",
          recommendation: "Add Go tests in files named *_test.go",
          current: "No test files found",
          ideal: "Test files following Go testing conventions",
          priority: 8,
          effort: "medium",
          appliesTo: "go",
        });
      }
    }

    return practices.sort((a, b) => b.priority - a.priority);
  }
}

/**
 * TechDebtTracker identifies and tracks technical debt items.
 */
export class TechDebtTracker {
  private items: Map<string, TechDebtItem> = new Map();
  private counter: number = 0;

  /**
   * Add a tech debt item.
   */
  add(
    type: string,
    description: string,
    location: string,
    severity: number = 5,
    estimatedHours: number = 1,
    category: string = "general"
  ): TechDebtItem {
    const id = `debt-${++this.counter}`;
    const item: TechDebtItem = {
      id,
      type,
      description,
      location,
      severity,
      estimatedHours,
      detectedAt: Date.now(),
      category,
    };
    this.items.set(id, item);
    return item;
  }

  /**
   * Scan code content for common tech debt indicators.
   */
  scanContent(filePath: string, content: string): TechDebtItem[] {
    const found: TechDebtItem[] = [];
    const lines = content.split("\n");

    let functionLineStart = -1;
    let functionLineCount = 0;
    let braceDepth = 0;
    const LONG_LINE_THRESHOLD = 120;
    const LONG_FUNCTION_THRESHOLD = 50;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // TODO/FIXME/HACK/XXX markers
      const todoMatch = line.match(/\b(TODO|FIXME|HACK|XXX)\b:?\s*(.+)/i);
      if (todoMatch) {
        found.push(
          this.add(
            "code-smell",
            `${todoMatch[1]}: ${todoMatch[2].trim()}`,
            `${filePath}:${i + 1}`,
            todoMatch[1].toUpperCase() === "HACK" ? 7 : 5,
            0.5,
            "maintenance"
          )
        );
      }

      // Long lines
      if (line.length > LONG_LINE_THRESHOLD) {
        found.push(
          this.add(
            "long-line",
            `Line is ${line.length} characters (threshold: ${LONG_LINE_THRESHOLD})`,
            `${filePath}:${i + 1}`,
            3,
            0.1,
            "readability"
          )
        );
      }

      // Track brace depth to detect long functions.
      // Only match lines that look like genuine function/method declarations,
      // excluding control-flow keywords (if, for, while, switch, try, catch, else)
      // and class/namespace declarations so we don't count their bodies.
      const openBraces = (line.match(/\{/g) ?? []).length;
      const closeBraces = (line.match(/\}/g) ?? []).length;

      const isFunctionStart =
        openBraces > closeBraces &&
        // Match TS/JS named functions, arrow functions assigned to const/let/var,
        // or method definitions with a return-type annotation
        /(?:\bfunction\s+\w+|\bfunction\s*\(|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(.*\)\s*(?::\s*\S+\s*)?=>|\)\s*:\s*\w[\w<>[\],\s|]*\s*\{$)/.test(line) &&
        // Exclude control flow and class constructs
        !/^\s*(?:if|else|for|while|do|switch|try|catch|finally|class|namespace|interface|enum)\b/.test(line);

      if (isFunctionStart && braceDepth === 0) {
        functionLineStart = i;
        functionLineCount = 1;
        braceDepth = openBraces - closeBraces;
      } else if (functionLineStart >= 0) {
        functionLineCount++;
        braceDepth += openBraces - closeBraces;
        if (braceDepth <= 0) {
          // Function ended
          if (functionLineCount > LONG_FUNCTION_THRESHOLD) {
            found.push(
              this.add(
                "complexity",
                `Function is ${functionLineCount} lines long (threshold: ${LONG_FUNCTION_THRESHOLD})`,
                `${filePath}:${functionLineStart + 1}`,
                6,
                2,
                "complexity"
              )
            );
          }
          functionLineStart = -1;
          functionLineCount = 0;
          braceDepth = 0;
        }
      }
    }

    return found;
  }

  /** Get all debt items. */
  getAll(): TechDebtItem[] {
    return Array.from(this.items.values());
  }

  /** Get a summary of technical debt. */
  getSummary(): TechDebtSummary {
    const items = Array.from(this.items.values());
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const item of items) {
      byType[item.type] = (byType[item.type] ?? 0) + 1;
      const sevBucket = item.severity <= 3 ? "low" : item.severity <= 6 ? "medium" : "high";
      bySeverity[sevBucket] = (bySeverity[sevBucket] ?? 0) + 1;
    }

    return {
      totalItems: items.length,
      totalEstimatedHours: items.reduce((s, i) => s + i.estimatedHours, 0),
      byType,
      bySeverity,
      topPriority: items
        .sort((a, b) => b.severity - a.severity)
        .slice(0, 5),
      trend: "stable",
    };
  }

  /** Remove a resolved debt item. */
  resolve(id: string): boolean {
    return this.items.delete(id);
  }
}

/** A package with version information for migration. */
export interface PackageInfo {
  /** Package name. */
  name: string;
  /** Current version. */
  currentVersion: string;
  /** Latest available version. */
  latestVersion?: string;
  /** Whether there are updates available. */
  hasUpdate: boolean;
  /** Whether the update contains breaking changes. */
  hasBreakingChanges: boolean;
  /** Package type. */
  type: "dependency" | "devDependency" | "peerDependency";
}

/** A breaking change in a package update. */
export interface BreakingChange {
  /** Version where the breaking change was introduced. */
  version: string;
  /** Description of the breaking change. */
  description: string;
  /** Migration guide or link. */
  migrationGuide?: string;
  /** Affected API/feature. */
  affectedArea: string;
  /** Severity of the change. */
  severity: "minor" | "major" | "critical";
}

/** Result of a migration attempt. */
export interface MigrationResult {
  /** Package that was migrated. */
  package: string;
  /** Version migrated from. */
  fromVersion: string;
  /** Version migrated to. */
  toVersion: string;
  /** Whether the migration was successful. */
  success: boolean;
  /** Steps that were executed. */
  executedSteps: MigrationStep[];
  /** Files that were modified. */
  modifiedFiles: string[];
  /** Errors encountered, if any. */
  errors: string[];
  /** Warnings generated. */
  warnings: string[];
  /** Timestamp of the migration. */
  timestamp: number;
  /** Backup information for rollback. */
  backup?: {
    id: string;
    files: Array<{ path: string; content: string }>;
  };
}

/** Configuration for the migration assistant. */
export interface MigrationAssistantConfig {
  /** Whether to create backups before migration. */
  createBackups: boolean;
  /** Whether to automatically run codemods. */
  autoRunCodemods: boolean;
  /** Whether to update lockfiles automatically. */
  updateLockfiles: boolean;
  /** Maximum number of concurrent package updates. */
  maxConcurrentUpdates: number;
}

const DEFAULT_MIGRATION_CONFIG: MigrationAssistantConfig = {
  createBackups: true,
  autoRunCodemods: false,
  updateLockfiles: true,
  maxConcurrentUpdates: 3,
};

/** Known breaking changes database (simplified). */
const KNOWN_BREAKING_CHANGES: Record<string, BreakingChange[]> = {
  react: [
    {
      version: "18.0.0",
      description: "Automatic batching for all state updates",
      migrationGuide: "https://react.dev/blog/2022/03/29/react-v18#new-feature-automatic-batching",
      affectedArea: "State updates",
      severity: "minor",
    },
    {
      version: "18.0.0",
      description: "New root API (createRoot instead of ReactDOM.render)",
      migrationGuide: "https://react.dev/blog/2022/03/29/react-v18#new-root-api",
      affectedArea: "Application bootstrap",
      severity: "major",
    },
  ],
  typescript: [
    {
      version: "5.0.0",
      description: "Stricter type checking for enums",
      migrationGuide: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/",
      affectedArea: "Enum handling",
      severity: "minor",
    },
  ],
  webpack: [
    {
      version: "5.0.0",
      description: "Node.js polyfills are no longer automatically included",
      migrationGuide: "https://webpack.js.org/migrate/5/",
      affectedArea: "Node.js modules",
      severity: "major",
    },
  ],
  jest: [
    {
      version: "29.0.0",
      description: "Snapshots now include surrounding whitespace by default",
      migrationGuide: "https://jestjs.io/blog/2022/08/25/jest-29",
      affectedArea: "Snapshot testing",
      severity: "minor",
    },
  ],
  express: [
    {
      version: "5.0.0",
      description: "Promises in route handlers are now properly caught",
      migrationGuide: "https://expressjs.com/en/guide/migrating-5.html",
      affectedArea: "Error handling",
      severity: "minor",
    },
  ],
};

/**
 * MigrationAssistant helps upgrade dependencies automatically,
 * detecting breaking changes and generating migration plans.
 */
export class MigrationAssistant {
  private config: MigrationAssistantConfig;
  private migrationHistory: MigrationResult[] = [];
  private backups: Map<string, MigrationResult["backup"]> = new Map();

  constructor(config: Partial<MigrationAssistantConfig> = {}) {
    this.config = { ...DEFAULT_MIGRATION_CONFIG, ...config };
  }

  /**
   * Analyze dependencies and identify available updates.
   */
  analyzePackages(
    dependencies: Record<string, string>,
    latestVersions: Record<string, string> = {},
    type: PackageInfo["type"] = "dependency"
  ): PackageInfo[] {
    const packages: PackageInfo[] = [];

    for (const [name, currentVersion] of Object.entries(dependencies)) {
      const latestVersion = latestVersions[name];
      const normalizedCurrentVersion = this.normalizeVersion(currentVersion);
      const normalizedLatestVersion = latestVersion
        ? this.normalizeVersion(latestVersion)
        : undefined;
      const hasUpdate = normalizedLatestVersion
        ? this.isNewerVersion(normalizedCurrentVersion, normalizedLatestVersion)
        : false;

      const breakingChanges = this.getBreakingChanges(
        name,
        normalizedCurrentVersion,
        normalizedLatestVersion ?? normalizedCurrentVersion
      );

      packages.push({
        name,
        currentVersion: normalizedCurrentVersion,
        latestVersion: normalizedLatestVersion,
        hasUpdate,
        hasBreakingChanges: breakingChanges.length > 0,
        type,
      });
    }

    return packages.sort((a, b) => {
      // Sort by: breaking changes first, then by update available, then by name
      if (a.hasBreakingChanges !== b.hasBreakingChanges) {
        return a.hasBreakingChanges ? -1 : 1;
      }
      if (a.hasUpdate !== b.hasUpdate) {
        return a.hasUpdate ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Get known breaking changes between two versions.
   */
  getBreakingChanges(
    packageName: string,
    fromVersion: string,
    toVersion: string
  ): BreakingChange[] {
    const changes = KNOWN_BREAKING_CHANGES[packageName] ?? [];
    const fromMajor = this.getMajorVersion(fromVersion);
    const toMajor = this.getMajorVersion(toVersion);

    return changes.filter((change) => {
      const changeMajor = this.getMajorVersion(change.version);
      return changeMajor > fromMajor && changeMajor <= toMajor;
    });
  }

  /**
   * Generate a migration plan for upgrading a package.
   */
  generatePlan(
    packageName: string,
    fromVersion: string,
    toVersion: string,
    affectedFiles: string[] = []
  ): MigrationPlan {
    const breakingChanges = this.getBreakingChanges(
      packageName,
      fromVersion,
      toVersion
    );

    const steps: MigrationStep[] = [];

    // Step 1: Backup (if enabled)
    if (this.config.createBackups) {
      steps.push({
        description: "Create backup of affected files",
        type: "manual",
        files: affectedFiles,
        automated: true,
      });
    }

    // Step 2: Update package.json
    steps.push({
      description: `Update ${packageName} from ${fromVersion} to ${toVersion} in package.json`,
      type: "update-dependency",
      files: ["package.json"],
      automated: true,
    });

    // Step 3: Handle breaking changes
    for (const change of breakingChanges) {
      steps.push({
        description: `Address breaking change: ${change.description}`,
        type: change.severity === "critical" ? "manual" : "code-change",
        files: affectedFiles,
        automated: this.config.autoRunCodemods && change.severity !== "critical",
      });
    }

    // Step 4: Update lockfile
    if (this.config.updateLockfiles) {
      steps.push({
        description: "Run package manager to update lockfile",
        type: "update-dependency",
        files: ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"],
        automated: true,
      });
    }

    // Step 5: Run tests
    steps.push({
      description: "Run test suite to verify migration",
      type: "manual",
      files: [],
      automated: false,
    });

    const risk: MigrationPlan["risk"] = breakingChanges.some(
      (c) => c.severity === "critical"
    )
      ? "high"
      : breakingChanges.some((c) => c.severity === "major")
        ? "medium"
        : "low";

    return {
      package: packageName,
      fromVersion,
      toVersion,
      hasBreakingChanges: breakingChanges.length > 0,
      changes: breakingChanges.map((c) => c.description),
      steps,
      risk,
    };
  }

  /**
   * Execute a migration plan (simulation mode by default).
   */
  executePlan(
    plan: MigrationPlan,
    dryRun: boolean = true
  ): MigrationResult {
    const result: MigrationResult = {
      package: plan.package,
      fromVersion: plan.fromVersion,
      toVersion: plan.toVersion,
      success: true,
      executedSteps: [],
      modifiedFiles: [],
      errors: [],
      warnings: [],
      timestamp: Date.now(),
    };

    // In dry-run mode, just simulate the steps
    if (dryRun) {
      result.warnings.push("Dry run mode - no changes were made");
      result.executedSteps = plan.steps.map((step) => ({
        ...step,
        automated: false, // Mark all as not automated in dry run
      }));
      return result;
    }

    // Create backup if enabled
    if (this.config.createBackups) {
      const backupId = `backup-${Date.now()}`;
      result.backup = {
        id: backupId,
        files: [], // Would contain actual file contents
      };
      this.backups.set(backupId, result.backup);
    }

    // Execute automated steps
    for (const step of plan.steps) {
      if (step.automated) {
        result.executedSteps.push(step);
        result.modifiedFiles.push(...step.files);
      } else {
        result.warnings.push(`Manual step required: ${step.description}`);
      }
    }

    // Store in history
    this.migrationHistory.push(result);

    return result;
  }

  /**
   * Rollback a migration using its backup.
   */
  rollback(backupId: string): boolean {
    const backup = this.backups.get(backupId);
    if (!backup) return false;

    // In a real implementation, this would restore the backed-up files
    this.backups.delete(backupId);
    return true;
  }

  /**
   * Get migration history.
   */
  getHistory(): MigrationResult[] {
    return [...this.migrationHistory];
  }

  /**
   * Get a summary of all available updates.
   */
  getUpdateSummary(packages: PackageInfo[]): {
    total: number;
    withUpdates: number;
    withBreakingChanges: number;
    byRisk: Record<"low" | "medium" | "high", number>;
  } {
    const withUpdates = packages.filter((p) => p.hasUpdate);
    const withBreakingChanges = packages.filter((p) => p.hasBreakingChanges);

    // Categorize by risk
    const byRisk = { low: 0, medium: 0, high: 0 };
    for (const pkg of withUpdates) {
      if (pkg.hasBreakingChanges) {
        const changes = this.getBreakingChanges(
          pkg.name,
          pkg.currentVersion,
          pkg.latestVersion ?? pkg.currentVersion
        );
        if (changes.some((c) => c.severity === "critical")) {
          byRisk.high++;
        } else if (changes.some((c) => c.severity === "major")) {
          byRisk.medium++;
        } else {
          byRisk.low++;
        }
      } else {
        byRisk.low++;
      }
    }

    return {
      total: packages.length,
      withUpdates: withUpdates.length,
      withBreakingChanges: withBreakingChanges.length,
      byRisk,
    };
  }

  private normalizeVersion(version: string): string {
    // Remove semver range specifiers (^, ~, etc.)
    return version.replace(/^[\^~>=<]+/, "");
  }

  private getMajorVersion(version: string): number {
    const normalized = this.normalizeVersion(version);
    const match = normalized.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  private isNewerVersion(current: string, latest: string): boolean {
    const currentParts = this.normalizeVersion(current)
      .split(".")
      .map((p) => parseInt(p, 10) || 0);
    const latestParts = this.normalizeVersion(latest)
      .split(".")
      .map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const c = currentParts[i] ?? 0;
      const l = latestParts[i] ?? 0;
      if (l > c) return true;
      if (l < c) return false;
    }

    return false;
  }
}
