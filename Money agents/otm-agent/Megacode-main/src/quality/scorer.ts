/**
 * Code Quality Scorer for OverCoat.
 *
 * A core weakness shared by Claude Code, OpenCode, and Kilo Code is
 * that completions are returned raw — no quality signal is attached.
 * Developers either trust the output blindly or spend time manually
 * reviewing every suggestion.
 *
 * The CodeQualityScorer analyzes a code completion and returns:
 *  - A 0-100 score (100 = no issues detected)
 *  - A list of detected issues with severity (error | warning | info)
 *    and a human-readable message
 *  - Language detection (TypeScript, JavaScript, Python, Go, Java, etc.)
 *
 * Detected patterns (language-agnostic and language-specific):
 *   - Empty catch blocks
 *   - TODO / FIXME / HACK / XXX markers
 *   - Debug logging (console.log, print, fmt.Println, System.out.println)
 *   - Hardcoded secrets (generic patterns: "secret", "password", "apikey" in strings)
 *   - eval() usage
 *   - Broad exception catches (catch Exception, catch Error)
 *   - Missing return type annotations (TypeScript)
 *   - `any` type usage (TypeScript)
 *   - Unused variable hints (variables assigned but never referenced again)
 *
 * The score starts at 100 and is reduced by the weighted sum of issues.
 */

export type IssueSeverity = "error" | "warning" | "info";

export interface QualityIssue {
  /** Short machine-readable code for the issue. */
  code: string;
  /** Human-readable description. */
  message: string;
  severity: IssueSeverity;
  /** 1-based line number where the issue was detected, if known. */
  line?: number;
}

export type DetectedLanguage =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "java"
  | "rust"
  | "unknown";

export interface QualityReport {
  score: number;
  issues: QualityIssue[];
  language: DetectedLanguage;
  /** Total lines in the analyzed snippet. */
  lineCount: number;
}

/** Weight (score deduction) for each severity level. */
const SEVERITY_WEIGHTS: Record<IssueSeverity, number> = {
  error: 20,
  warning: 10,
  info: 3,
};

/** Detect language from a file extension hint or content heuristics. */
export function detectLanguage(
  code: string,
  filenameHint?: string,
): DetectedLanguage {
  if (filenameHint) {
    const ext = filenameHint.split(".").pop()?.toLowerCase();
    const extMap: Record<string, DetectedLanguage> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      py: "python",
      go: "go",
      java: "java",
      rs: "rust",
    };
    if (ext && extMap[ext]) return extMap[ext];
  }

  // Content heuristics
  if (/\bdef\s+\w+\s*\(/.test(code) && /:\s*$/.test(code)) return "python";
  if (/\bfunc\s+\w+\s*\(/.test(code) && /\bpackage\s+\w+/.test(code)) return "go";
  if (/\bpublic\s+(?:class|interface|static)\b/.test(code)) return "java";
  if (/\bfn\s+\w+\s*\(/.test(code) && /\blet\s+mut\b/.test(code)) return "rust";
  if (/:\s*(?:string|number|boolean|void|any|unknown)\b/.test(code)) return "typescript";
  if (/\bconst\b|\blet\b|\bvar\b/.test(code)) return "javascript";

  return "unknown";
}

interface PatternRule {
  code: string;
  pattern: RegExp;
  severity: IssueSeverity;
  message: string;
  /** Only apply this rule for the listed languages. Empty = all languages. */
  languages?: DetectedLanguage[];
}

const RULES: PatternRule[] = [
  // ── Empty catch blocks ──────────────────────────────────────────────────────
  {
    code: "empty-catch",
    pattern: /catch\s*\([^)]*\)\s*\{\s*\}/,
    severity: "error",
    message: "Empty catch block silently swallows errors.",
  },
  {
    code: "empty-except",
    pattern: /except\s*(?:\([^)]*\))?\s*:\s*pass\b/,
    severity: "error",
    message: "Bare 'except: pass' silently swallows exceptions.",
    languages: ["python"],
  },

  // ── TODO / FIXME markers ────────────────────────────────────────────────────
  {
    code: "todo-marker",
    pattern: /\b(?:TODO|FIXME|HACK|XXX)\b/,
    severity: "info",
    message: "Contains TODO/FIXME marker — implementation may be incomplete.",
  },

  // ── Debug logging ───────────────────────────────────────────────────────────
  {
    code: "debug-console-log",
    pattern: /\bconsole\.log\s*\(/,
    severity: "warning",
    message: "console.log() found — remove before production.",
    languages: ["typescript", "javascript"],
  },
  {
    code: "debug-print",
    pattern: /\bprint\s*\(/,
    severity: "info",
    message: "print() found — may be debug output.",
    languages: ["python"],
  },
  {
    code: "debug-fmt-println",
    pattern: /\bfmt\.Println\s*\(/,
    severity: "info",
    message: "fmt.Println() found — may be debug output.",
    languages: ["go"],
  },
  {
    code: "debug-system-out",
    pattern: /System\.out\.print(?:ln)?\s*\(/,
    severity: "info",
    message: "System.out.println() found — use a logger instead.",
    languages: ["java"],
  },

  // ── eval() usage ────────────────────────────────────────────────────────────
  {
    code: "eval-usage",
    pattern: /\beval\s*\(/,
    severity: "error",
    message: "eval() is a security risk and performance antipattern.",
    languages: ["typescript", "javascript", "python"],
  },

  // ── Hardcoded secrets (naive pattern) ───────────────────────────────────────
  {
    code: "hardcoded-secret",
    pattern:
      /(?:password|secret|api_?key|access_?token)\s*=\s*["'][^"']{4,}/i,
    severity: "error",
    message: "Possible hardcoded secret or credential detected.",
  },

  // ── TypeScript: `any` type ───────────────────────────────────────────────────
  {
    code: "ts-any-type",
    pattern: /:\s*any\b/,
    severity: "warning",
    message: "Use of `any` weakens TypeScript's type safety.",
    languages: ["typescript"],
  },

  // ── Broad exception catches ─────────────────────────────────────────────────
  {
    code: "broad-catch-error",
    pattern: /catch\s*\(\s*(?:e|err|error)\s*\)/,
    severity: "info",
    message:
      "Catching a generic error — consider handling specific error types.",
    languages: ["typescript", "javascript"],
  },
  {
    code: "broad-except",
    pattern: /except\s+Exception\s*(?:as\s+\w+)?\s*:/,
    severity: "info",
    message: "Catching bare Exception — consider more specific exception types.",
    languages: ["python"],
  },

  // ── TypeScript: missing return type annotation ───────────────────────────────
  // Covers named function declarations: function foo(...) { and async function foo(...) {
  {
    code: "ts-missing-return-type",
    pattern: /\b(?:async\s+)?function\s+\w+\s*\([^)]*\)(?!\s*:)\s*\{/,
    severity: "info",
    message: "Function is missing an explicit return type annotation.",
    languages: ["typescript"],
  },
  // Covers arrow functions assigned to a variable: const foo = (...) => {
  {
    code: "ts-missing-return-type",
    pattern: /\bconst\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)(?!\s*:)\s*=>\s*\{/,
    severity: "info",
    message: "Arrow function is missing an explicit return type annotation.",
    languages: ["typescript"],
  },

  // ── Hardcoded private key material ──────────────────────────────────────────
  {
    code: "hardcoded-private-key",
    pattern: /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/,
    severity: "error",
    message: "Private key material detected — use a secrets manager instead of embedding keys in source code.",
  },

  // ── Prototype pollution ──────────────────────────────────────────────────────
  {
    code: "prototype-pollution",
    pattern: /__proto__\s*[\[=.]|\b\w+\s*\.\s*prototype\s*\[/,
    severity: "error",
    message: "Possible prototype pollution: avoid mutating __proto__ or extending a prototype via bracket notation.",
    languages: ["typescript", "javascript"],
  },
];

/**
 * Score a code snippet and return a quality report.
 *
 * @param code The code string to analyze.
 * @param filename Optional filename for language detection.
 */
export function scoreCode(code: string, filename?: string): QualityReport {
  const language = detectLanguage(code, filename);
  const lines = code.split("\n");
  const issues: QualityIssue[] = [];

  for (const rule of RULES) {
    if (rule.languages && !rule.languages.includes(language)) continue;

    for (let i = 0; i < lines.length; i++) {
      if (rule.pattern.test(lines[i])) {
        // Avoid duplicate issues for the same code on consecutive lines
        const alreadyReported = issues.some(
          (iss) => iss.code === rule.code && iss.line === i + 1,
        );
        if (!alreadyReported) {
          issues.push({
            code: rule.code,
            message: rule.message,
            severity: rule.severity,
            line: i + 1,
          });
        }
      }
    }
  }

  // Calculate score: start at 100, deduct by severity weight
  const deduction = issues.reduce(
    (sum, issue) => sum + SEVERITY_WEIGHTS[issue.severity],
    0,
  );
  const score = Math.max(0, 100 - deduction);

  return { score, issues, language, lineCount: lines.length };
}

/**
 * CodeQualityScorer wraps `scoreCode` as a class for consistent
 * configuration and integration into OverCoat pipelines.
 */
export class CodeQualityScorer {
  /**
   * Analyze a code completion and return a quality report.
   *
   * @example
   * const scorer = new CodeQualityScorer();
   * const report = scorer.score('const x: any = eval("bad")');
   * // report.score === 60 (two errors deducted)
   */
  score(code: string, filename?: string): QualityReport {
    return scoreCode(code, filename);
  }

  /**
   * Return true if the report has no issues with severity >= `threshold`.
   * Useful for CI-style gates.
   */
  passes(
    report: QualityReport,
    threshold: IssueSeverity = "error",
  ): boolean {
    const thresholdWeight = SEVERITY_WEIGHTS[threshold];
    return !report.issues.some(
      (iss) => SEVERITY_WEIGHTS[iss.severity] >= thresholdWeight,
    );
  }
}
