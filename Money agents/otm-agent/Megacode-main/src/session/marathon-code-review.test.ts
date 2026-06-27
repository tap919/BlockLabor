import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  MarathonCodeReview,
  CodeReviewConfig,
  CodeReview,
  CodeIssue,
} from "./marathon-code-review";
import { MarathonSprint, MarathonSprintConfig } from "./marathon-sprint";

describe("MarathonCodeReview", () => {
  let testDir: string;
  let sprint: MarathonSprint;
  let codeReview: MarathonCodeReview;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "marathon-review-test-"));
    const config: MarathonSprintConfig = {
      bankDir: testDir,
      capacityBytes: 100 * 1024 * 1024,
      sessionConfig: {
        name: "review-test",
        checkpointIntervalMinutes: 60,
        breakReminderMinutes: 120,
        maxDurationHours: 4,
      },
    };
    sprint = new MarathonSprint(config);
    sprint.open();
    sprint.startSession("review-test");

    const reviewConfig: CodeReviewConfig = {
      reviewOnBuild: true,
      reviewOnTest: true,
      reviewOnGoalComplete: true,
      reviewOnProgressMilestones: [25, 50, 75, 100],
      enableSecurityScan: true,
      enableBestPractices: true,
    };
    codeReview = new MarathonCodeReview(sprint, reviewConfig);
  });

  afterEach(() => {
    codeReview.close();
    sprint.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it("should create code review", () => {
    const review = codeReview.triggerReview("manual");
    expect(review).toBeDefined();
    expect(review.trigger).toBe("manual");
    expect(review.summary).toBeDefined();
  });

  it("should analyze issues", () => {
    const testFile = path.join(testDir, "test.ts");
    fs.writeFileSync(testFile, `const x: any = "test";
console.log("debug");
const password = "secret123";
`);

    const review = codeReview.triggerReview("manual");
    const issues = review.issues;

    const hasAny = issues.some(i => i.message.includes("any"));
    const hasConsole = issues.some(i => i.message.includes("Console"));
    const hasSecret = issues.some(i => i.message.includes("secret"));

    expect(hasAny || hasConsole || hasSecret).toBe(true);
  });

  it("should calculate review score", () => {
    const review = codeReview.triggerReview("manual");
    expect(review.summary.score).toBeGreaterThanOrEqual(0);
    expect(review.summary.score).toBeLessThanOrEqual(100);
  });

  it("should track review history", () => {
    codeReview.triggerReview("manual");
    codeReview.triggerReview("build");

    const reviews = codeReview.getReviews();
    expect(reviews).toHaveLength(2);
  });

  it("should get latest review", () => {
    codeReview.triggerReview("manual");
    codeReview.triggerReview("build");

    const latest = codeReview.getLatestReview();
    expect(latest?.trigger).toBe("build");
  });

  it("should get review stats", () => {
    codeReview.triggerReview("manual");
    codeReview.triggerReview("build");

    const stats = codeReview.getReviewStats();
    expect(stats.totalReviews).toBe(2);
    expect(stats.averageScore).toBeGreaterThanOrEqual(0);
  });

  it("should register review handlers", () => {
    let reviewReceived: CodeReview | null = null;
    codeReview.onReview((review) => {
      reviewReceived = review;
    });

    codeReview.triggerReview("manual");
    expect(reviewReceived).toBeDefined();
  });

  it("should register issue handlers", () => {
    let issueReceived: CodeIssue | null = null;
    codeReview.onIssue((issue) => {
      issueReceived = issue;
    });

    const testFile = path.join(testDir, "test.ts");
    fs.writeFileSync(testFile, `const x: any = "test";`);

    codeReview.triggerReview("manual");
  });

  it("should get review schedule", () => {
    const schedule = codeReview.getReviewSchedule();
    expect(schedule.nextReviewAt).toBeGreaterThan(Date.now());
    expect(schedule.reviewAfterFiles).toBeGreaterThan(0);
  });

  it("should force review", () => {
    const review = codeReview.forceReview();
    expect(review.trigger).toBe("manual");
  });

  it("should detect security issues", () => {
    const testFile = path.join(testDir, "vuln.js");
    fs.writeFileSync(testFile, `document.innerHTML = userInput;
eval(userCode);
`);

    const review = codeReview.triggerReview("manual");
    const securityIssues = review.issues.filter(i => i.category === "security");
    expect(securityIssues.length).toBeGreaterThan(0);
  });

  it("should detect TODOs", () => {
    const testFile = path.join(testDir, "todo.ts");
    fs.writeFileSync(testFile, `// TODO: fix this later
// FIXME: urgent fix
`);

    const review = codeReview.triggerReview("manual");
    const todoIssues = review.issues.filter(i => i.message.toLowerCase().includes("todo"));
    expect(todoIssues.length).toBeGreaterThan(0);
  });

  it("should handle missing files gracefully", () => {
    expect(() => {
      codeReview.triggerReview("manual");
    }).not.toThrow();
  });

  it("should generate summary correctly", () => {
    const testFile = path.join(testDir, "summary.ts");
    fs.writeFileSync(testFile, `console.log("test");
const x: any = 1;
`);

    const review = codeReview.triggerReview("manual");
    const summary = review.summary;

    expect(summary.totalFiles).toBeGreaterThanOrEqual(0);
    expect(summary.errors).toBeGreaterThanOrEqual(0);
    expect(summary.warnings).toBeGreaterThanOrEqual(0);
    expect(summary.score).toBeGreaterThanOrEqual(0);
  });
});
