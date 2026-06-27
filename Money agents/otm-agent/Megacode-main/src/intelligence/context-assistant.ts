/**
 * AI & Intelligence Layer for OverCoat.
 *
 * Implementation plan for intelligent, context-aware features:
 *
 * 1. Context-Aware Assistance
 *    - Remembers project structure, past commands, and coding patterns
 *    - Maintains a persistent context store per-project
 *    - Tracks file relationships, import graphs, and usage history
 *    - Implementation: Store project context in a local JSON/SQLite DB,
 *      index file metadata on workspace open, update on file change events
 *
 * 2. Proactive Suggestions
 *    - Analyzes current workflow to offer relevant suggestions
 *    - Example: "I notice you're about to deploy, would you like me to run tests first?"
 *    - Triggered by file-save events, git operations, terminal commands
 *    - Implementation: Event-based rule engine with configurable triggers,
 *      pattern matching on recent actions, LLM-powered suggestion generation
 *
 * 3. Natural Language Command Generation
 *    - Translates plain English into executable commands
 *    - Example: "deploy the backend to production with canary rollout" → actual commands
 *    - Implementation: LLM prompt template with system context (OS, shell, project type),
 *      command validation before execution, history-aware refinement
 *
 * 4. Self-Healing Commands
 *    - Auto-fixes typos and suggests corrections based on intent
 *    - Detects failed commands and proposes alternatives
 *    - Implementation: Levenshtein distance matching against known commands,
 *      error output parsing with pattern-based fix suggestions,
 *      LLM fallback for complex error interpretation
 *
 * 5. Code Review Automation
 *    - Reviews your changes before commit
 *    - Analyzes diffs for common issues, style violations, and potential bugs
 *    - Implementation: Git diff parsing, AST-based analysis for supported languages,
 *      configurable rule sets, integration with pre-commit hooks
 */

/** Represents a piece of remembered project context. */
export interface ProjectContext {
  /** Unique project identifier (derived from workspace root path). */
  projectId: string;
  /** Root directory of the project. */
  workspaceRoot: string;
  /** Detected project type (e.g., "node", "python", "rust"). */
  projectType: string;
  /** Key files and their roles in the project. */
  fileIndex: FileEntry[];
  /** Recent commands executed in this project context. */
  commandHistory: CommandEntry[];
  /** Coding patterns detected across the project. */
  patterns: CodingPattern[];
  /** Last updated timestamp. */
  updatedAt: number;
}

export interface FileEntry {
  path: string;
  language: string;
  /** Role in the project (e.g., "entry-point", "config", "test", "component"). */
  role: string;
  lastModified: number;
  /** Files this file imports or depends on. */
  dependencies: string[];
}

export interface CommandEntry {
  command: string;
  timestamp: number;
  exitCode: number;
  /** Working directory when the command was run. */
  cwd: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

export interface CodingPattern {
  /** Pattern identifier (e.g., "test-before-commit", "feature-branch-workflow"). */
  id: string;
  description: string;
  /** How many times this pattern has been observed. */
  occurrences: number;
  lastSeen: number;
}

/** A proactive suggestion offered to the developer. */
export interface Suggestion {
  id: string;
  /** What triggered this suggestion (e.g., "pre-deploy", "test-missing"). */
  trigger: string;
  message: string;
  /** Suggested action to take. */
  action: string;
  /** Confidence score 0-1. */
  confidence: number;
  timestamp: number;
}

/** Result of a natural language command translation. */
export interface CommandTranslation {
  /** The original natural language input. */
  naturalLanguage: string;
  /** The generated executable command(s). */
  commands: string[];
  /** Explanation of what each command does. */
  explanation: string;
  /** Confidence in the translation 0-1. */
  confidence: number;
  /** Whether the commands are considered safe to run. */
  safe: boolean;
}

/** A proposed fix for a failed or mistyped command. */
export interface CommandFix {
  /** The original (failed) command. */
  original: string;
  /** The suggested corrected command. */
  suggested: string;
  /** Reason for the suggestion. */
  reason: string;
  /** Confidence in the fix 0-1. */
  confidence: number;
}

export interface ContextAssistantConfig {
  /** Directory to store persistent context data. */
  storageDir: string;
  /** Maximum number of command history entries to retain. */
  maxHistorySize: number;
  /** Whether proactive suggestions are enabled. */
  suggestionsEnabled: boolean;
  /** Minimum confidence threshold for suggestions (0-1). */
  suggestionThreshold: number;
}

const DEFAULT_CONFIG: ContextAssistantConfig = {
  storageDir: ".overcoat/context",
  maxHistorySize: 1000,
  suggestionsEnabled: true,
  suggestionThreshold: 0.7,
};

/**
 * ContextAssistant provides intelligent, context-aware assistance
 * by tracking project structure, command history, and coding patterns.
 */
export class ContextAssistant {
  private config: ContextAssistantConfig;
  private context: ProjectContext | null = null;
  private suggestionHandlers: Array<(suggestion: Suggestion) => void> = [];

  constructor(config: Partial<ContextAssistantConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the assistant for a given workspace.
   * Loads persisted context or creates a new one.
   */
  async initialize(workspaceRoot: string): Promise<ProjectContext> {
    this.context = {
      projectId: this.deriveProjectId(workspaceRoot),
      workspaceRoot,
      projectType: "unknown",
      fileIndex: [],
      commandHistory: [],
      patterns: [],
      updatedAt: Date.now(),
    };
    return this.context;
  }

  /** Get the current project context, if initialized. */
  getContext(): ProjectContext | null {
    return this.context;
  }

  /**
   * Record a command execution for pattern learning.
   */
  recordCommand(entry: CommandEntry): void {
    if (!this.context) return;
    this.context.commandHistory.push(entry);
    if (this.context.commandHistory.length > this.config.maxHistorySize) {
      this.context.commandHistory.shift();
    }
    this.context.updatedAt = Date.now();
  }

  /**
   * Index a file in the project context.
   */
  indexFile(entry: FileEntry): void {
    if (!this.context) return;
    const existing = this.context.fileIndex.findIndex(
      (f) => f.path === entry.path
    );
    if (existing >= 0) {
      this.context.fileIndex[existing] = entry;
    } else {
      this.context.fileIndex.push(entry);
    }
    this.context.updatedAt = Date.now();
  }

  /**
   * Generate proactive suggestions based on current context.
   * Analyzes recent commands and file changes to identify relevant suggestions.
   */
  async generateSuggestions(): Promise<Suggestion[]> {
    if (!this.context || !this.config.suggestionsEnabled) return [];

    const suggestions: Suggestion[] = [];
    const history = this.context.commandHistory;

    // Check for common patterns and suggest improvements
    if (history.length > 0) {
      const lastCommand = history[history.length - 1];

      // Detect deploy without test pattern
      if (
        lastCommand.command.includes("deploy") &&
        !history.slice(-5).some((c) => c.command.includes("test"))
      ) {
        suggestions.push({
          id: `suggest-${Date.now()}`,
          trigger: "pre-deploy",
          message:
            "You're about to deploy without running tests recently. Would you like to run tests first?",
          action: "npm test",
          confidence: 0.85,
          timestamp: Date.now(),
        });
      }
    }

    // Notify handlers
    for (const suggestion of suggestions) {
      if (suggestion.confidence >= this.config.suggestionThreshold) {
        this.suggestionHandlers.forEach((h) => h(suggestion));
      }
    }

    return suggestions.filter(
      (s) => s.confidence >= this.config.suggestionThreshold
    );
  }

  /**
   * Translate natural language into executable commands.
   */
  async translateCommand(
    naturalLanguage: string
  ): Promise<CommandTranslation> {
    // Stub: In production, this would call the LLM router
    return {
      naturalLanguage,
      commands: [],
      explanation: "Command translation requires LLM connection",
      confidence: 0,
      safe: true,
    };
  }

  /**
   * Suggest a fix for a failed command.
   */
  suggestFix(failedCommand: string, errorOutput: string): CommandFix | null {
    // Check for common typos and known fixes
    const fixes: Array<{ pattern: RegExp; fix: (cmd: string) => string; reason: string }> = [
      {
        pattern: /^gti\s/,
        fix: (cmd) => cmd.replace(/^gti/, "git"),
        reason: "Common typo: 'gti' → 'git'",
      },
      {
        pattern: /^nmp\s/,
        fix: (cmd) => cmd.replace(/^nmp/, "npm"),
        reason: "Common typo: 'nmp' → 'npm'",
      },
      {
        pattern: /^ndoe\s/,
        fix: (cmd) => cmd.replace(/^ndoe/, "node"),
        reason: "Common typo: 'ndoe' → 'node'",
      },
    ];

    for (const { pattern, fix, reason } of fixes) {
      if (pattern.test(failedCommand)) {
        return {
          original: failedCommand,
          suggested: fix(failedCommand),
          reason,
          confidence: 0.95,
        };
      }
    }

    // Check error output for "command not found" patterns
    if (errorOutput.includes("command not found")) {
      return {
        original: failedCommand,
        suggested: failedCommand,
        reason: "Command not found — check PATH or install the tool",
        confidence: 0.5,
      };
    }

    return null;
  }

  /** Register a handler for proactive suggestions. */
  onSuggestion(handler: (suggestion: Suggestion) => void): void {
    this.suggestionHandlers.push(handler);
  }

  private deriveProjectId(workspaceRoot: string): string {
    return workspaceRoot.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
  }
}

/** Severity level for code review findings. */
export type ReviewSeverity = "error" | "warning" | "info" | "style";

/** A finding from automated code review. */
export interface ReviewFinding {
  /** Rule that triggered this finding. */
  ruleId: string;
  /** Severity of the finding. */
  severity: ReviewSeverity;
  /** Human-readable message. */
  message: string;
  /** File path where the issue was found. */
  filePath: string;
  /** Line number (1-based). */
  line: number;
  /** Column number (1-based). */
  column?: number;
  /** Suggested fix, if available. */
  suggestedFix?: string;
  /** Category of the finding. */
  category: "bug" | "style" | "security" | "performance" | "maintainability";
}

/** Result of a code review. */
export interface CodeReviewResult {
  /** Files that were reviewed. */
  filesReviewed: string[];
  /** Total number of findings. */
  totalFindings: number;
  /** Findings grouped by severity. */
  bySeverity: Record<ReviewSeverity, number>;
  /** All findings. */
  findings: ReviewFinding[];
  /** Whether the review passed (no errors). */
  passed: boolean;
  /** Timestamp of the review. */
  timestamp: number;
}

/** A diff hunk representing changed lines. */
export interface DiffHunk {
  /** File path. */
  filePath: string;
  /** Starting line number in the new file. */
  startLine: number;
  /** Added lines. */
  additions: string[];
  /** Removed lines. */
  deletions: string[];
}

/** Configuration for code review automation. */
export interface CodeReviewConfig {
  /** Enable strict mode (warnings become errors). */
  strict: boolean;
  /** Patterns to ignore (glob patterns). */
  ignorePatterns: string[];
  /** Categories to check. */
  enabledCategories: ReviewFinding["category"][];
  /** Custom rules to apply. */
  customRules: ReviewRule[];
}

/** A custom review rule. */
export interface ReviewRule {
  /** Rule identifier. */
  id: string;
  /** Pattern to match (regex). */
  pattern: RegExp;
  /** Message to display when matched. */
  message: string;
  /** Severity of the finding. */
  severity: ReviewSeverity;
  /** Category. */
  category: ReviewFinding["category"];
  /** File extensions to apply to (e.g., [".ts", ".js"]). Empty means all files. */
  fileExtensions: string[];
}

/** Default review rules for common issues. */
const DEFAULT_REVIEW_RULES: ReviewRule[] = [
  {
    id: "no-console",
    pattern: /\bconsole\.(log|debug|info|warn|error)\s*\(/g,
    message: "Avoid leaving console statements in production code",
    severity: "warning",
    category: "maintainability",
    fileExtensions: [".ts", ".js", ".tsx", ".jsx"],
  },
  {
    id: "no-debugger",
    pattern: /\bdebugger\b/g,
    message: "Remove debugger statements before committing",
    severity: "error",
    category: "bug",
    fileExtensions: [".ts", ".js", ".tsx", ".jsx"],
  },
  {
    id: "no-todo-fixme",
    pattern: /\b(TODO|FIXME|HACK|XXX)\b/gi,
    message: "Address or document TODO/FIXME comments before committing",
    severity: "info",
    category: "maintainability",
    fileExtensions: [],
  },
  {
    id: "no-hardcoded-credentials",
    pattern: /(?:password|secret|api[_-]?key|token)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    message: "Potential hardcoded credentials detected",
    severity: "error",
    category: "security",
    fileExtensions: [],
  },
  {
    id: "no-any-type",
    pattern: /:\s*any\b/g,
    message: "Avoid using 'any' type; prefer explicit types",
    severity: "warning",
    category: "maintainability",
    fileExtensions: [".ts", ".tsx"],
  },
  {
    id: "no-empty-catch",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/g,
    message: "Empty catch block; handle or log the error",
    severity: "warning",
    category: "bug",
    fileExtensions: [".ts", ".js", ".tsx", ".jsx"],
  },
  {
    id: "no-magic-numbers",
    pattern: /(?<![.0-9a-zA-Z_])[2-9]\d{2,}(?![0-9a-zA-Z_])/g,
    message: "Consider extracting magic number to a named constant",
    severity: "info",
    category: "maintainability",
    fileExtensions: [".ts", ".js", ".tsx", ".jsx"],
  },
];

const DEFAULT_REVIEW_CONFIG: CodeReviewConfig = {
  strict: false,
  ignorePatterns: ["node_modules/**", "dist/**", "build/**", "*.min.js"],
  enabledCategories: ["bug", "style", "security", "performance", "maintainability"],
  customRules: [],
};

/**
 * CodeReviewAutomation provides automated code review capabilities
 * by analyzing diffs and detecting common issues before commit.
 */
export class CodeReviewAutomation {
  private config: CodeReviewConfig;
  private rules: ReviewRule[];

  constructor(config: Partial<CodeReviewConfig> = {}) {
    this.config = { ...DEFAULT_REVIEW_CONFIG, ...config };
    this.rules = [...DEFAULT_REVIEW_RULES, ...this.config.customRules];
  }

  /**
   * Review a single file's content.
   */
  reviewFile(filePath: string, content: string): ReviewFinding[] {
    const findings: ReviewFinding[] = [];
    const fileExt = this.getFileExtension(filePath);
    const lines = content.split("\n");

    // Check if file should be ignored
    if (this.shouldIgnore(filePath)) {
      return findings;
    }

    for (const rule of this.rules) {
      // Check if rule applies to this file type
      if (
        rule.fileExtensions.length > 0 &&
        !rule.fileExtensions.includes(fileExt)
      ) {
        continue;
      }

      // Check if category is enabled
      if (!this.config.enabledCategories.includes(rule.category)) {
        continue;
      }

      // Search for pattern matches
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        rule.pattern.lastIndex = 0;
        let match;

        if (rule.pattern.global) {
          while ((match = rule.pattern.exec(line)) !== null) {
            findings.push({
              ruleId: rule.id,
              severity: this.config.strict && rule.severity === "warning"
                ? "error"
                : rule.severity,
              message: rule.message,
              filePath,
              line: i + 1,
              column: match.index + 1,
              category: rule.category,
            });
          }
        } else {
          match = rule.pattern.exec(line);
          if (match) {
            findings.push({
              ruleId: rule.id,
              severity: this.config.strict && rule.severity === "warning"
                ? "error"
                : rule.severity,
              message: rule.message,
              filePath,
              line: i + 1,
              column: match.index + 1,
              category: rule.category,
            });
          }
        }
      }
    }

    return findings;
  }

  /**
   * Review a diff (set of changed files and their content).
   */
  reviewDiff(
    files: Array<{ path: string; content: string }>
  ): CodeReviewResult {
    const allFindings: ReviewFinding[] = [];
    const filesReviewed: string[] = [];

    for (const file of files) {
      if (!this.shouldIgnore(file.path)) {
        filesReviewed.push(file.path);
        const findings = this.reviewFile(file.path, file.content);
        allFindings.push(...findings);
      }
    }

    const bySeverity: Record<ReviewSeverity, number> = {
      error: 0,
      warning: 0,
      info: 0,
      style: 0,
    };

    for (const finding of allFindings) {
      bySeverity[finding.severity]++;
    }

    return {
      filesReviewed,
      totalFindings: allFindings.length,
      bySeverity,
      findings: allFindings,
      passed: bySeverity.error === 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Parse a unified diff string into hunks.
   */
  parseDiff(diffText: string): DiffHunk[] {
    const hunks: DiffHunk[] = [];
    const lines = diffText.split("\n");
    let currentFile = "";
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      // Detect file header
      const fileMatch = line.match(/^\+\+\+\s+(?:b\/)?(.+)/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }

      // Detect hunk header
      const hunkMatch = line.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        currentHunk = {
          filePath: currentFile,
          startLine: parseInt(hunkMatch[1], 10),
          additions: [],
          deletions: [],
        };
        continue;
      }

      if (currentHunk) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          currentHunk.additions.push(line.substring(1));
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          currentHunk.deletions.push(line.substring(1));
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return hunks;
  }

  /**
   * Add a custom rule.
   */
  addRule(rule: ReviewRule): void {
    this.rules.push(rule);
  }

  /**
   * Get all configured rules.
   */
  getRules(): ReviewRule[] {
    return [...this.rules];
  }

  /**
   * Generate a summary message for the review result.
   */
  summarize(result: CodeReviewResult): string {
    if (result.totalFindings === 0) {
      return `✅ Code review passed! ${result.filesReviewed.length} file(s) reviewed with no issues.`;
    }

    const parts = [];
    if (result.bySeverity.error > 0) {
      parts.push(`${result.bySeverity.error} error(s)`);
    }
    if (result.bySeverity.warning > 0) {
      parts.push(`${result.bySeverity.warning} warning(s)`);
    }
    if (result.bySeverity.info > 0) {
      parts.push(`${result.bySeverity.info} info`);
    }
    if (result.bySeverity.style > 0) {
      parts.push(`${result.bySeverity.style} style issue(s)`);
    }

    const status = result.passed ? "⚠️" : "❌";
    return `${status} Code review ${result.passed ? "passed with issues" : "failed"}: ${parts.join(", ")} in ${result.filesReviewed.length} file(s).`;
  }

  private getFileExtension(filePath: string): string {
    const match = filePath.match(/\.[^.]+$/);
    return match ? match[0] : "";
  }

  private shouldIgnore(filePath: string): boolean {
    for (const pattern of this.config.ignorePatterns) {
      // Simple glob matching
      // Order matters: escape special chars first, then handle glob patterns
      let regexStr = pattern
        .replace(/\\/g, "\\\\")     // Escape backslashes first
        .replace(/\./g, "\\.")      // Escape dots
        .replace(/\+/g, "\\+")      // Escape plus
        .replace(/\?/g, "\\?")      // Escape question mark
        .replace(/\[/g, "\\[")      // Escape brackets
        .replace(/\]/g, "\\]")
        .replace(/\(/g, "\\(")      // Escape parentheses
        .replace(/\)/g, "\\)")
        .replace(/\{/g, "\\{")      // Escape braces
        .replace(/\}/g, "\\}")
        .replace(/\^/g, "\\^")      // Escape caret
        .replace(/\$/g, "\\$")      // Escape dollar
        .replace(/\|/g, "\\|")      // Escape pipe
        .replace(/\*\*/g, "<<<DOUBLESTAR>>>")  // Placeholder for **
        .replace(/\*/g, "[^/]*")     // Single * matches within path segment
        .replace(/<<<DOUBLESTAR>>>/g, ".*");  // ** matches across segments
      
      const regex = new RegExp("^" + regexStr + "$");
      if (regex.test(filePath)) {
        return true;
      }
    }
    return false;
  }
}
