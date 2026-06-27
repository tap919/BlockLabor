import {
  scoreCode,
  detectLanguage,
  CodeQualityScorer,
} from "./scorer";

describe("detectLanguage", () => {
  it("detects TypeScript from .ts extension", () => {
    expect(detectLanguage("const x = 1;", "foo.ts")).toBe("typescript");
  });

  it("detects TypeScript from .tsx extension", () => {
    expect(detectLanguage("", "foo.tsx")).toBe("typescript");
  });

  it("detects JavaScript from .js extension", () => {
    expect(detectLanguage("", "app.js")).toBe("javascript");
  });

  it("detects Python from .py extension", () => {
    expect(detectLanguage("", "script.py")).toBe("python");
  });

  it("detects Go from .go extension", () => {
    expect(detectLanguage("", "main.go")).toBe("go");
  });

  it("detects Java from .java extension", () => {
    expect(detectLanguage("", "App.java")).toBe("java");
  });

  it("detects Rust from .rs extension", () => {
    expect(detectLanguage("", "lib.rs")).toBe("rust");
  });

  it("falls back to content heuristics for TypeScript", () => {
    expect(detectLanguage("const x: number = 1;")).toBe("typescript");
  });

  it("falls back to JavaScript for const/let/var without types", () => {
    expect(detectLanguage("const x = 1;")).toBe("javascript");
  });

  it("returns unknown for unrecognised code", () => {
    expect(detectLanguage("???")).toBe("unknown");
  });
});

describe("scoreCode", () => {
  it("returns 100 for clean code", () => {
    const report = scoreCode("function add(a: number, b: number): number {\n  return a + b;\n}", "add.ts");
    expect(report.score).toBe(100);
    expect(report.issues).toHaveLength(0);
  });

  it("penalises empty catch blocks", () => {
    const report = scoreCode("try { foo(); } catch (e) {}", "file.ts");
    const issue = report.issues.find((i) => i.code === "empty-catch");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("error");
    expect(report.score).toBeLessThan(100);
  });

  it("penalises TODO markers with info severity", () => {
    const report = scoreCode("// TODO: implement this", "file.ts");
    const issue = report.issues.find((i) => i.code === "todo-marker");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("info");
  });

  it("penalises console.log in TypeScript", () => {
    const report = scoreCode("console.log('debug')", "file.ts");
    const issue = report.issues.find((i) => i.code === "debug-console-log");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("warning");
  });

  it("does NOT flag console.log in Python", () => {
    const report = scoreCode("console.log('debug')", "file.py");
    expect(report.issues.find((i) => i.code === "debug-console-log")).toBeUndefined();
  });

  it("penalises debug print() in Python", () => {
    const report = scoreCode("print('hello')", "file.py");
    const issue = report.issues.find((i) => i.code === "debug-print");
    expect(issue).toBeDefined();
  });

  it("penalises eval() usage", () => {
    const report = scoreCode("const r = eval(userInput);", "file.ts");
    const issue = report.issues.find((i) => i.code === "eval-usage");
    expect(issue?.severity).toBe("error");
  });

  it("penalises hardcoded secrets", () => {
    const report = scoreCode('const apiKey = "abc123secret";', "config.ts");
    const issue = report.issues.find((i) => i.code === "hardcoded-secret");
    expect(issue?.severity).toBe("error");
  });

  it("penalises any type in TypeScript", () => {
    const report = scoreCode("function foo(x: any) {}", "file.ts");
    const issue = report.issues.find((i) => i.code === "ts-any-type");
    expect(issue?.severity).toBe("warning");
  });

  it("does NOT flag any type in Python files", () => {
    const report = scoreCode("x: any = 1", "file.py");
    expect(report.issues.find((i) => i.code === "ts-any-type")).toBeUndefined();
  });

  it("score never goes below 0 for extremely bad code", () => {
    const awful =
      "eval(x)\nconsole.log(x)\nconst p: any = 'password123'\ntry {} catch(e) {}\n// TODO: fix";
    const report = scoreCode(awful, "bad.ts");
    expect(report.score).toBeGreaterThanOrEqual(0);
  });

  it("reports line numbers for issues", () => {
    const code = "const x = 1;\nconsole.log('debug');\nconst y = 2;";
    const report = scoreCode(code, "file.ts");
    const issue = report.issues.find((i) => i.code === "debug-console-log");
    expect(issue?.line).toBe(2);
  });

  it("returns correct lineCount", () => {
    const code = "a\nb\nc";
    const report = scoreCode(code, "file.ts");
    expect(report.lineCount).toBe(3);
  });

  it("does not report the same issue twice on the same line", () => {
    const code = "try { } catch(e) {}"; // one empty catch on line 1
    const report = scoreCode(code, "file.ts");
    const emptyCatches = report.issues.filter((i) => i.code === "empty-catch");
    expect(emptyCatches).toHaveLength(1);
  });

  it("flags functions missing a return type annotation in TypeScript", () => {
    const report = scoreCode("function greet(name: string) {}", "file.ts");
    const issue = report.issues.find((i) => i.code === "ts-missing-return-type");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("info");
  });

  it("flags async functions missing a return type annotation in TypeScript", () => {
    const report = scoreCode("async function fetchData(url: string) {}", "file.ts");
    const issue = report.issues.find((i) => i.code === "ts-missing-return-type");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("info");
  });

  it("flags const arrow functions missing a return type annotation in TypeScript", () => {
    const report = scoreCode("const fetchData = async (url: string) => {", "file.ts");
    const issue = report.issues.find((i) => i.code === "ts-missing-return-type");
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe("info");
  });

  it("does NOT flag arrow functions with a return type annotation", () => {
    const report = scoreCode("const greet = (name: string): string => {", "file.ts");
    expect(report.issues.find((i) => i.code === "ts-missing-return-type")).toBeUndefined();
  });

  it("does NOT flag functions that have a return type annotation", () => {
    const report = scoreCode("function greet(name: string): string { return name; }", "file.ts");
    expect(report.issues.find((i) => i.code === "ts-missing-return-type")).toBeUndefined();
  });

  it("does NOT flag ts-missing-return-type in JavaScript files", () => {
    const report = scoreCode("function greet(name) { return name; }", "file.js");
    expect(report.issues.find((i) => i.code === "ts-missing-return-type")).toBeUndefined();
  });

  it("flags hardcoded private key material", () => {
    const report = scoreCode("const key = '-----BEGIN RSA PRIVATE KEY-----\\nMIIE...';", "config.ts");
    const issue = report.issues.find((i) => i.code === "hardcoded-private-key");
    expect(issue?.severity).toBe("error");
  });

  it("flags hardcoded EC private key material", () => {
    const report = scoreCode("const key = '-----BEGIN EC PRIVATE KEY-----\\nMHcC...';", "config.ts");
    const issue = report.issues.find((i) => i.code === "hardcoded-private-key");
    expect(issue?.severity).toBe("error");
  });

  it("flags hardcoded OpenSSH private key material", () => {
    const report = scoreCode("const key = '-----BEGIN OPENSSH PRIVATE KEY-----\\nb3BlbnNzaC1rZXktdjEAAAAA...';", "config.ts");
    const issue = report.issues.find((i) => i.code === "hardcoded-private-key");
    expect(issue?.severity).toBe("error");
  });

  it("flags hardcoded generic private key material", () => {
    const report = scoreCode("const key = '-----BEGIN PRIVATE KEY-----\\nMIIE...';", "config.ts");
    const issue = report.issues.find((i) => i.code === "hardcoded-private-key");
    expect(issue?.severity).toBe("error");
  });
  it("flags prototype pollution via __proto__", () => {
    const report = scoreCode("obj.__proto__ = { isAdmin: true };", "util.ts");
    const issue = report.issues.find((i) => i.code === "prototype-pollution");
    expect(issue?.severity).toBe("error");
  });

  it("flags prototype pollution via dot notation on __proto__", () => {
    const report = scoreCode("obj.__proto__.isAdmin = true;", "util.ts");
    const issue = report.issues.find((i) => i.code === "prototype-pollution");
    expect(issue?.severity).toBe("error");
  });

  it("flags prototype pollution via bracket notation on __proto__", () => {
    const report = scoreCode("obj.__proto__['isAdmin'] = true;", "util.ts");
    const issue = report.issues.find((i) => i.code === "prototype-pollution");
    expect(issue?.severity).toBe("error");
  });

  it("flags prototype pollution via bracket notation on constructor.prototype", () => {
    const report = scoreCode("User.prototype['isAdmin'] = true;", "util.ts");
    const issue = report.issues.find((i) => i.code === "prototype-pollution");
    expect(issue?.severity).toBe("error");
  });
  it("does NOT flag prototype-pollution in Python files", () => {
    const report = scoreCode("obj.__proto__ = 1", "script.py");
    expect(report.issues.find((i) => i.code === "prototype-pollution")).toBeUndefined();
  });
});

describe("CodeQualityScorer", () => {
  let scorer: CodeQualityScorer;

  beforeEach(() => {
    scorer = new CodeQualityScorer();
  });

  it("score() delegates to scoreCode", () => {
    const report = scorer.score("const x: any = 1;", "file.ts");
    expect(report.issues.some((i) => i.code === "ts-any-type")).toBe(true);
  });

  it("passes() returns true when no errors", () => {
    const report = scorer.score("function add(a: number, b: number) { return a + b; }", "file.ts");
    expect(scorer.passes(report)).toBe(true);
  });

  it("passes() returns false when errors are present", () => {
    const report = scorer.score("try {} catch(e) {}", "file.ts");
    expect(scorer.passes(report)).toBe(false);
  });

  it("passes() with warning threshold fails on warnings", () => {
    const report = scorer.score("console.log('x')", "file.ts");
    expect(scorer.passes(report, "warning")).toBe(false);
  });

  it("passes() with info threshold fails on info issues", () => {
    const report = scorer.score("// TODO: do this", "file.ts");
    expect(scorer.passes(report, "info")).toBe(false);
  });
});
