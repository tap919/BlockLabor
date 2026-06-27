/**
 * Marathon Code Review System for OverCoat.
 *
 * Autonomous code review integration that stages reviews at significant
 * points during marathon development sessions:
 * - Automatic reviews at build milestones
 * - Diff analysis for changed files
 * - Progress-based review scheduling
 * - Review history and tracking
 * - Integration with marathon agent
 */

import * as fs from "fs";
import * as path from "path";
import { DiskMemoryBank, ONE_GIB } from "../memory/disk-bank";
import {
  MarathonSprint,
  MarathonSprintConfig,
  SprintGoal,
  EnergyLevel,
  SprintSessionStats,
} from "./marathon-sprint";
import {
  MarathonAgentIntegration,
  AgentActivity,
  AutonomousConfig,
  createMarathonAgent,
} from "./marathon-agent";

export interface CodeReviewConfig {
  reviewOnBuild?: boolean;
  reviewOnTest?: boolean;
  reviewOnRefactor?: boolean;
  reviewOnGoalComplete?: boolean;
  reviewOnProgressMilestones?: number[];
  maxFilesPerReview?: number;
  maxLinesPerFile?: number;
  enableDiffAnalysis?: boolean;
  enableSecurityScan?: boolean;
  enableBestPractices?: boolean;
}

export interface FileDiff {
  filePath: string;
  additions: number;
  deletions: number;
  changes: DiffChange[];
}

export interface DiffChange {
  lineNumber: number;
  originalLine: string;
  newLine: string;
  changeType: "added" | "removed" | "modified";
}

export interface CodeIssue {
  id: string;
  severity: "error" | "warning" | "info";
  category: "bug" | "security" | "performance" | "style" | "best-practice" | "readability";
  message: string;
  filePath: string;
  lineNumber?: number;
  suggestion?: string;
}

export interface CodeReview {
  id: string;
  timestamp: number;
  trigger: ReviewTrigger;
  files: FileDiff[];
  issues: CodeIssue[];
  summary: ReviewSummary;
  goalId?: string;
  sessionDurationMs: number;
}

export interface ReviewSummary {
  totalFiles: number;
  totalChanges: number;
  totalIssues: number;
  errors: number;
  warnings: number;
  info: number;
  score: number;
}

export type ReviewTrigger = 
  | "build"
  | "test"
  | "refactor"
  | "goal_complete"
  | "progress_milestone"
  | "manual"
  | "pre_deploy";

export interface ReviewSchedule {
  nextReviewAt: number;
  reviewAfterFiles: number;
  reviewAfterChanges: number;
  milestoneReviews: number[];
}

export interface ReviewStats {
  totalReviews: number;
  averageScore: number;
  issuesFound: number;
  issuesResolved: number;
  filesReviewed: number;
}

export type ReviewHandler = (review: CodeReview) => void;
export type IssueHandler = (issue: CodeIssue, filePath: string) => void;

const DEFAULT_REVIEW_CONFIG: Required<CodeReviewConfig> = {
  reviewOnBuild: true,
  reviewOnTest: true,
  reviewOnRefactor: true,
  reviewOnGoalComplete: true,
  reviewOnProgressMilestones: [25, 50, 75, 100],
  maxFilesPerReview: 10,
  maxLinesPerFile: 500,
  enableDiffAnalysis: true,
  enableSecurityScan: true,
  enableBestPractices: true,
};

const REVIEW_PREFIX = "marathon:review:";

export class MarathonCodeReview {
  private sprint: MarathonSprint;
  private agent: MarathonAgentIntegration | null = null;
  private config: Required<CodeReviewConfig>;
  private reviews: CodeReview[] = [];
  private pendingReviews: CodeReview[] = [];
  private reviewSchedule: ReviewSchedule;
  private reviewHandlers: ReviewHandler[] = [];
  private issueHandlers: IssueHandler[] = [];
  private filesChangedSinceReview: number = 0;
  private linesChangedSinceReview: number = 0;
  private lastGoalProgress: number = 0;
  private memoryBank: DiskMemoryBank;

  constructor(sprint: MarathonSprint, config?: CodeReviewConfig) {
    this.sprint = sprint;
    this.config = { ...DEFAULT_REVIEW_CONFIG, ...config };
    
    this.reviewSchedule = {
      nextReviewAt: Date.now() + 30 * 60 * 1000,
      reviewAfterFiles: 10,
      reviewAfterChanges: 500,
      milestoneReviews: this.config.reviewOnProgressMilestones,
    };

    const bankDir = `.overcoat/marathon-reviews-${Date.now()}`;
    this.memoryBank = new DiskMemoryBank({ bankDir, capacityBytes: ONE_GIB });
    this.memoryBank.open();

    this._loadReviews();
  }

  static createWithAgent(
    marathonConfig?: { marathon?: MarathonSprintConfig; autonomous?: AutonomousConfig },
    reviewConfig?: CodeReviewConfig
  ): { sprint: MarathonSprint; agent: MarathonAgentIntegration; codeReview: MarathonCodeReview } {
    const { sprint, integration: agent } = createMarathonAgent(marathonConfig);
    const codeReview = new MarathonCodeReview(sprint, reviewConfig);
    codeReview.setAgent(agent);
    return { sprint, agent, codeReview };
  }

  setAgent(agent: MarathonAgentIntegration): void {
    this.agent = agent;
    
    this.agent.on("activity_recorded", (event) => {
      const activity = event.data as AgentActivity;
      if (activity.type === "edit" || activity.type === "refactor") {
        this._onActivityRecorded(activity);
      }
    });

    this.agent.on("goal_complete", (event) => {
      const goal = event.data as SprintGoal;
      this.triggerReview("goal_complete", { goalId: goal.id });
    });

    this.agent.on("break_suggestion", () => {
      this._checkScheduledReview();
    });
  }

  private _onActivityRecorded(activity: AgentActivity): void {
    this.filesChangedSinceReview++;
    this._checkScheduledReview();
  }

  private _checkScheduledReview(): void {
    const now = Date.now();
    const stats = this.sprint.getSprintStats();

    if (now >= this.reviewSchedule.nextReviewAt) {
      this.triggerReview("progress_milestone");
      this._resetSchedule();
      return;
    }

    if (this.filesChangedSinceReview >= this.reviewSchedule.reviewAfterFiles) {
      this.triggerReview("progress_milestone");
      this._resetSchedule();
      return;
    }

    const currentProgress = this.sprint.getOverallProgress();
    for (const milestone of this.reviewSchedule.milestoneReviews) {
      if (this.lastGoalProgress < milestone && currentProgress >= milestone) {
        this.triggerReview("progress_milestone", { milestone });
        break;
      }
    }
    this.lastGoalProgress = currentProgress;
  }

  private _resetSchedule(): void {
    this.filesChangedSinceReview = 0;
    this.linesChangedSinceReview = 0;
    this.reviewSchedule.nextReviewAt = Date.now() + 30 * 60 * 1000;
  }

  triggerReview(trigger: ReviewTrigger, options?: { goalId?: string; milestone?: number }): CodeReview {
    const changedFiles = this._getChangedFiles();
    const diffs = this._analyzeDiffs(changedFiles);
    const issues = this._analyzeIssues(diffs);

    const review: CodeReview = {
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      trigger,
      files: diffs,
      issues,
      summary: this._generateSummary(diffs, issues),
      goalId: options?.goalId,
      sessionDurationMs: this.stats.session.durationMs,
    };

    this.reviews.push(review);
    this._saveReview(review);

    for (const handler of this.reviewHandlers) {
      handler(review);
    }

    for (const issue of issues) {
      for (const handler of this.issueHandlers) {
        handler(issue, issue.filePath);
      }
    }

    return review;
  }

  private get stats(): SprintSessionStats {
    return this.sprint.getSprintStats();
  }

  private _getChangedFiles(): string[] {
    const sessionStats = this.stats;
    return sessionStats?.session?.durationMs ? 
      (this.agent?.getActivityHistory(100).filter(a => a.filePath) || [])
        .map(a => a.filePath as string)
        .filter((f, i, arr) => arr.indexOf(f) === i)
        .slice(-this.config.maxFilesPerReview) : [];
  }

  private _analyzeDiffs(filePaths: string[]): FileDiff[] {
    const diffs: FileDiff[] = [];

    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) continue;

      try {
        const content = fs.readFileSync(filePath, "utf8");
        const lines = content.split("\n");

        const diff: FileDiff = {
          filePath,
          additions: 0,
          deletions: 0,
          changes: [],
        };

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (this.config.enableDiffAnalysis) {
            if (line.trim().startsWith("+") && !line.trim().startsWith("+++")) {
              diff.additions++;
              diff.changes.push({
                lineNumber: i + 1,
                originalLine: "",
                newLine: line.slice(1).trim(),
                changeType: "added",
              });
            } else if (line.trim().startsWith("-") && !line.trim().startsWith("---")) {
              diff.deletions++;
              diff.changes.push({
                lineNumber: i + 1,
                originalLine: line.slice(1).trim(),
                newLine: "",
                changeType: "removed",
              });
            }
          }

          if (this.config.enableBestPractices) {
            const issue = this._checkBestPractices(line, i + 1, filePath);
            if (issue) {
              diff.changes.push({
                lineNumber: i + 1,
                originalLine: line,
                newLine: line,
                changeType: "modified",
              });
            }
          }
        }

        if (diff.additions > 0 || diff.deletions > 0 || diff.changes.length > 0) {
          diffs.push(diff);
        }
      } catch {
        continue;
      }
    }

    return diffs;
  }

  private _analyzeIssues(diffs: FileDiff[]): CodeIssue[] {
    const issues: CodeIssue[] = [];

    for (const diff of diffs) {
      for (const change of diff.changes) {
        const lineIssues = this._analyzeLine(
          change.newLine || change.originalLine,
          diff.filePath,
          change.lineNumber
        );
        issues.push(...lineIssues);
      }

      if (this.config.enableSecurityScan) {
        const securityIssues = this._checkSecurityIssues(diff);
        issues.push(...securityIssues);
      }
    }

    return issues;
  }

  private _analyzeLine(line: string, filePath: string, lineNumber?: number): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      return issues;
    }

    if (this._containsConsoleLog(trimmed)) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        severity: "warning",
        category: "best-practice",
        message: "Console.log statement found. Consider using a proper logger.",
        filePath,
        lineNumber,
        suggestion: "Use a structured logging library (e.g., pino, winston)",
      });
    }

    if (this._containsTODO(trimmed)) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        severity: "info",
        category: "readability",
        message: "TODO comment found",
        filePath,
        lineNumber,
      });
    }

    if (this._isHardcodedSecret(trimmed)) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        severity: "error",
        category: "security",
        message: "Potential hardcoded secret detected",
        filePath,
        lineNumber,
        suggestion: "Move sensitive data to environment variables or a secrets manager",
      });
    }

    if (this._isLongLine(trimmed)) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        severity: "info",
        category: "style",
        message: "Line exceeds recommended length (120 characters)",
        filePath,
        lineNumber,
      });
    }

    if (this._isNestedTooDeep(line)) {
      issues.push({
        id: `issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        severity: "warning",
        category: "best-practice",
        message: "Deeply nested code detected",
        filePath,
        lineNumber,
        suggestion: "Consider extracting nested logic into separate functions",
      });
    }

    return issues;
  }

  private _containsConsoleLog(line: string): boolean {
    return /console\.(log|debug|info|warn|error)\s*\(/.test(line);
  }

  private _containsTODO(line: string): boolean {
    return /\b(TODO|FIXME|HACK|XXX)\b/i.test(line);
  }

  private _isHardcodedSecret(line: string): boolean {
    const secretPatterns = [
      /password\s*[=:]\s*["'][^"']+["']/i,
      /api[_-]?key\s*[=:]\s*["'][^"']+["']/i,
      /secret\s*[=:]\s*["'][^"']+["']/i,
      /token\s*[=:]\s*["'][^"']+["']/i,
      /private[_-]?key\s*[=:]\s*["'][^"']+["']/i,
    ];
    return secretPatterns.some(p => p.test(line));
  }

  private _isLongLine(line: string): boolean {
    return line.length > 120;
  }

  private _isNestedTooDeep(code: string): boolean {
    const maxDepth = 4;
    let depth = 0;
    for (const char of code) {
      if (char === "{") depth++;
      if (char === "}") depth--;
      if (depth > maxDepth) return true;
    }
    return false;
  }

  private _checkSecurityIssues(diff: FileDiff): CodeIssue[] {
    const issues: CodeIssue[] = [];
    const ext = path.extname(diff.filePath).toLowerCase();

    if (ext === ".js" || ext === ".ts" || ext === ".jsx" || ext === ".tsx") {
      for (const change of diff.changes) {
        const line = change.newLine || change.originalLine;

        if (/\.innerHTML\s*=/.test(line)) {
          issues.push({
            id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            severity: "error",
            category: "security",
            message: "Potential XSS vulnerability: innerHTML assignment",
            filePath: diff.filePath,
            lineNumber: change.lineNumber,
            suggestion: "Use textContent or sanitize input",
          });
        }

        if (/eval\s*\(/.test(line)) {
          issues.push({
            id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            severity: "error",
            category: "security",
            message: "Use of eval() is dangerous",
            filePath: diff.filePath,
            lineNumber: change.lineNumber,
            suggestion: "Avoid eval(), use safer alternatives",
          });
        }

        if (/process\.env\.NODE_ENV\s*===\s*["']development/.test(line)) {
          issues.push({
            id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            severity: "info",
            category: "best-practice",
            message: "Development-only code detected",
            filePath: diff.filePath,
            lineNumber: change.lineNumber,
          });
        }
      }
    }

    return issues;
  }

  private _checkBestPractices(line: string, lineNumber: number, filePath: string): CodeIssue | null {
    if (line.includes("any") && line.includes(":")) {
      return {
        id: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        severity: "warning",
        category: "best-practice",
        message: "Avoid using 'any' type in TypeScript",
        filePath,
        lineNumber,
        suggestion: "Use proper types or unknown",
      };
    }
    return null;
  }

  private _generateSummary(diffs: FileDiff[], issues: CodeIssue[]): ReviewSummary {
    const totalChanges = diffs.reduce((sum, d) => sum + d.additions + d.deletions, 0);
    const errors = issues.filter(i => i.severity === "error").length;
    const warnings = issues.filter(i => i.severity === "warning").length;
    const info = issues.filter(i => i.severity === "info").length;

    let score = 100;
    score -= errors * 10;
    score -= warnings * 3;
    score -= info * 1;
    score = Math.max(0, score);

    return {
      totalFiles: diffs.length,
      totalChanges,
      totalIssues: issues.length,
      errors,
      warnings,
      info,
      score,
    };
  }

  private _saveReview(review: CodeReview): void {
    const key = `${REVIEW_PREFIX}${review.id}`;
    this.memoryBank.write(key, JSON.stringify(review), {
      summary: `Review: ${review.summary.totalFiles} files, ${review.summary.score}% score`,
      tags: ["review", review.trigger, `score-${Math.floor(review.summary.score / 10) * 10}`],
    });
  }

  private _loadReviews(): void {
    const entries = this.memoryBank.listEntries();
    for (const entry of entries) {
      if (!entry.key.startsWith(REVIEW_PREFIX)) continue;
      const data = this.memoryBank.read(entry.key);
      if (!data) continue;
      try {
        this.reviews.push(JSON.parse(data));
      } catch {
        continue;
      }
    }
    this.reviews.sort((a, b) => b.timestamp - a.timestamp);
  }

  getReviews(limit?: number): CodeReview[] {
    if (limit) return this.reviews.slice(0, limit);
    return [...this.reviews];
  }

  getLatestReview(): CodeReview | undefined {
    return this.reviews[0];
  }

  getReviewStats(): ReviewStats {
    const totalReviews = this.reviews.length;
    const averageScore = totalReviews > 0
      ? this.reviews.reduce((sum, r) => sum + r.summary.score, 0) / totalReviews
      : 100;
    const issuesFound = this.reviews.reduce((sum, r) => sum + r.summary.totalIssues, 0);
    const issuesResolved = 0;
    const filesReviewed = this.reviews.reduce((sum, r) => sum + r.summary.totalFiles, 0);

    return { totalReviews, averageScore, issuesFound, issuesResolved, filesReviewed };
  }

  onReview(handler: ReviewHandler): void {
    this.reviewHandlers.push(handler);
  }

  onIssue(handler: IssueHandler): void {
    this.issueHandlers.push(handler);
  }

  getReviewSchedule(): ReviewSchedule {
    return { ...this.reviewSchedule };
  }

  scheduleReview(delayMs: number): void {
    this.reviewSchedule.nextReviewAt = Date.now() + delayMs;
  }

  forceReview(trigger: ReviewTrigger = "manual"): CodeReview {
    return this.triggerReview(trigger);
  }

  getIssuesByFile(filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = [];
    for (const review of this.reviews) {
      issues.push(...review.issues.filter(i => i.filePath === filePath));
    }
    return issues;
  }

  getIssuesByCategory(category: CodeIssue["category"]): CodeIssue[] {
    const issues: CodeIssue[] = [];
    for (const review of this.reviews) {
      issues.push(...review.issues.filter(i => i.category === category));
    }
    return issues;
  }

  close(): void {
    this.memoryBank.flush();
  }
}

export function createMarathonWithReviews(
  marathonConfig?: { marathon?: MarathonSprintConfig; autonomous?: AutonomousConfig },
  reviewConfig?: CodeReviewConfig
): { 
  sprint: MarathonSprint; 
  agent: MarathonAgentIntegration; 
  codeReview: MarathonCodeReview 
} {
  const { sprint, agent, codeReview } = MarathonCodeReview.createWithAgent(
    marathonConfig,
    reviewConfig
  );
  return { sprint, agent, codeReview };
}
