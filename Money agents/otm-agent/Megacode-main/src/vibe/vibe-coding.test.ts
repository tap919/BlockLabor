import {
  PlainEnglishErrorExplainer,
  IntentValidator,
  ConfidenceIndicator,
  SafeMode,
  OneClickFixEngine,
  PlainLanguageGlossary,
  DependencyAdvisor,
  StepByStepWizard,
  UndoStack,
  SmartScaffolder,
  FriendlyProgressNarrator,
  CodeIntentLogger,
  RookieModeToggle,
  VisualDiffFormatter,
  AutoExplainMode,
} from "./vibe-coding";

// ─────────────────────────────────────────────────────────────────────────────
// 1. PlainEnglishErrorExplainer
// ─────────────────────────────────────────────────────────────────────────────
describe("PlainEnglishErrorExplainer", () => {
  const explainer = new PlainEnglishErrorExplainer();

  it("explains ENOENT errors in plain English", () => {
    const r = explainer.explain("Error: ENOENT: no such file or directory, open '/app/config.json'");
    expect(r.plainEnglish).toMatch(/file or folder/i);
    expect(r.suggestion).toBeTruthy();
    expect(r.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("explains permission denied errors", () => {
    const r = explainer.explain("EACCES: permission denied");
    expect(r.plainEnglish).toMatch(/permission/i);
  });

  it("explains port-in-use errors", () => {
    const r = explainer.explain("Error: EADDRINUSE: address already in use :::3000");
    expect(r.plainEnglish).toMatch(/port/i);
  });

  it("explains module not found errors", () => {
    const r = explainer.explain("Cannot find module 'express'");
    expect(r.plainEnglish).toMatch(/package/i);
  });

  it("returns a fallback for unknown errors", () => {
    const r = explainer.explain("Some totally weird error nobody has seen before");
    expect(r.plainEnglish).toBeTruthy();
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("preserves the original error message", () => {
    const msg = "TypeError: Cannot read property 'foo' of undefined";
    const r = explainer.explain(msg);
    expect(r.original).toBe(msg);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. IntentValidator
// ─────────────────────────────────────────────────────────────────────────────
describe("IntentValidator", () => {
  const validator = new IntentValidator();

  it("gives a high score when response covers request keywords", () => {
    const r = validator.validate(
      "Create a login form with email and password fields",
      "Here is a login form with email input and password input fields.",
    );
    expect(r.score).toBeGreaterThanOrEqual(0.5);
    expect(r.onTopic).toBe(true);
  });

  it("gives a low score when response is off-topic", () => {
    const r = validator.validate(
      "Implement database migration for users table",
      "Here is a recipe for chocolate cake.",
    );
    expect(r.score).toBeLessThan(0.5);
    expect(r.onTopic).toBe(false);
  });

  it("lists matched and missing keywords", () => {
    const r = validator.validate("delete user account", "We can remove the user record from the database.");
    expect(Array.isArray(r.matchedKeywords)).toBe(true);
    expect(Array.isArray(r.missingKeywords)).toBe(true);
  });

  it("returns a human-readable verdict", () => {
    const r = validator.validate("build a REST API", "Here is a REST API implementation.");
    expect(r.verdict).toBeTruthy();
  });

  it("scores 1.0 when the request has no meaningful keywords", () => {
    const r = validator.validate("a to of", "Some response.");
    expect(r.score).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. ConfidenceIndicator
// ─────────────────────────────────────────────────────────────────────────────
describe("ConfidenceIndicator", () => {
  const indicator = new ConfidenceIndicator();

  it("gives a high score for confident-sounding text", () => {
    const r = indicator.assess("The answer is 42. Use the formula x = a + b.");
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.level).toBe("high");
  });

  it("gives a lower score when hedging is detected", () => {
    const r = indicator.assess("I think this might be correct, but I'm not sure. Perhaps try it.");
    expect(r.score).toBeLessThan(80);
  });

  it("detects hedging phrases", () => {
    const r = indicator.assess("I'm not certain, but it could be an issue.");
    expect(r.hedgingSignals.length).toBeGreaterThan(0);
  });

  it("score is never below 10", () => {
    const hedgy = Array(20).fill("I think maybe possibly perhaps uncertain").join(" ");
    const r = indicator.assess(hedgy);
    expect(r.score).toBeGreaterThanOrEqual(10);
  });

  it("returns a summary string", () => {
    const r = indicator.assess("Use the function directly.");
    expect(r.summary).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. SafeMode
// ─────────────────────────────────────────────────────────────────────────────
describe("SafeMode", () => {
  it("blocks destructive operations when enabled", () => {
    const safe = new SafeMode(true);
    const r = safe.check("rm -rf /important");
    expect(r.risk).toBe("destructive");
    expect(r.blocked).toBe(true);
    expect(r.confirmationPrompt).toBeTruthy();
  });

  it("does not block when disabled", () => {
    const safe = new SafeMode(false);
    const r = safe.check("rm -rf /important");
    expect(r.blocked).toBe(false);
  });

  it("flags cautious operations without blocking them", () => {
    const safe = new SafeMode(true);
    const r = safe.check("npm publish");
    expect(r.risk).toBe("cautious");
    expect(r.blocked).toBe(false);
  });

  it("classifies safe operations correctly", () => {
    const safe = new SafeMode(true);
    const r = safe.check("ls -la");
    expect(r.risk).toBe("safe");
    expect(r.blocked).toBe(false);
  });

  it("confirm() unblocks a destructive operation", () => {
    const safe = new SafeMode(true);
    const r = safe.confirm("rm -rf /important");
    expect(r.blocked).toBe(false);
  });

  it("enable/disable toggles the guard", () => {
    const safe = new SafeMode(false);
    safe.enable();
    expect(safe.enabled).toBe(true);
    safe.disable();
    expect(safe.enabled).toBe(false);
  });

  it("flags DROP TABLE as destructive", () => {
    const safe = new SafeMode(true);
    const r = safe.check("DROP TABLE users");
    expect(r.risk).toBe("destructive");
  });

  it("flags git force push as destructive", () => {
    const safe = new SafeMode(true);
    const r = safe.check("git push --force origin main");
    expect(r.risk).toBe("destructive");
  });

  it("flags chmod a+rwx as cautious", () => {
    const safe = new SafeMode(true);
    const r = safe.check("chmod a+rwx myfile.sh");
    expect(r.risk).toBe("cautious");
  });

  it("flags chmod 0777 as cautious", () => {
    const safe = new SafeMode(true);
    const r = safe.check("chmod 0777 myfile.sh");
    expect(r.risk).toBe("cautious");
  });

  it("flags chmod -R 777 as cautious", () => {
    const safe = new SafeMode(true);
    const r = safe.check("chmod -R 777 /var/www");
    expect(r.risk).toBe("cautious");
  });

  it("flags mkfs disk format as destructive", () => {
    const safe = new SafeMode(true);
    const r = safe.check("mkfs.ext4 /dev/sda1");
    expect(r.risk).toBe("destructive");
  });

  it("flags Windows drive format as destructive", () => {
    const safe = new SafeMode(true);
    const r = safe.check("format C: /Q");
    expect(r.risk).toBe("destructive");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. OneClickFixEngine
// ─────────────────────────────────────────────────────────────────────────────
describe("OneClickFixEngine", () => {
  const engine = new OneClickFixEngine();

  it("generates a fix for debug-console-log", () => {
    const fix = engine.fix("debug-console-log", "  console.log('debug value');");
    expect(fix).not.toBeNull();
    expect(fix!.replacement).not.toContain("console.log");
    expect(fix!.autoApply).toBe(true);
  });

  it("generates a fix for ts-any-type", () => {
    const fix = engine.fix("ts-any-type", "function foo(x: any): void {}");
    expect(fix).not.toBeNull();
    expect(fix!.replacement).toContain("unknown");
    expect(fix!.autoApply).toBe(false);
  });

  it("returns null for unknown issue codes", () => {
    const fix = engine.fix("non-existent-code", "const x = 1;");
    expect(fix).toBeNull();
  });

  it("includes a plain-English explanation", () => {
    const fix = engine.fix("hardcoded-secret", "const apiKey = 'abc123';");
    expect(fix!.explanation).toBeTruthy();
    expect(fix!.explanation.length).toBeGreaterThan(10);
  });

  it("preserves the original line", () => {
    const line = "try { } catch (e) {}";
    const fix = engine.fix("empty-catch", line);
    expect(fix!.original).toBe(line);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PlainLanguageGlossary
// ─────────────────────────────────────────────────────────────────────────────
describe("PlainLanguageGlossary", () => {
  const glossary = new PlainLanguageGlossary();

  it("looks up 'api'", () => {
    const entry = glossary.lookup("api");
    expect(entry).not.toBeNull();
    expect(entry!.definition).toBeTruthy();
  });

  it("is case-insensitive", () => {
    expect(glossary.lookup("API")).toEqual(glossary.lookup("api"));
  });

  it("returns null for unknown terms", () => {
    expect(glossary.lookup("qwerty-not-a-term-xyz")).toBeNull();
  });

  it("allows adding custom entries", () => {
    const g = new PlainLanguageGlossary();
    g.define({ term: "florp", definition: "A made-up thing.", related: [] });
    expect(g.lookup("florp")!.definition).toBe("A made-up thing.");
  });

  it("lists all terms", () => {
    const terms = glossary.listTerms();
    expect(terms.length).toBeGreaterThan(5);
    expect(terms).toContain("api");
    expect(terms).toContain("git");
  });

  it("provides an analogy for 'api'", () => {
    const entry = glossary.lookup("api");
    expect(entry!.analogy).toBeTruthy();
  });

  it("extra entries passed to constructor are merged", () => {
    const extra = { term: "mcp", definition: "Model Context Protocol.", related: ["api"] };
    const g = new PlainLanguageGlossary([extra]);
    expect(g.lookup("mcp")).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. DependencyAdvisor
// ─────────────────────────────────────────────────────────────────────────────
describe("DependencyAdvisor", () => {
  const advisor = new DependencyAdvisor();

  it("rates express as trusted", () => {
    const a = advisor.advise("express");
    expect(a.safety).toBe("trusted");
    expect(a.recommended).toBe(true);
  });

  it("warns about the sabotaged colors package", () => {
    const a = advisor.advise("colors");
    expect(a.safety).toBe("risky");
    expect(a.recommended).toBe(false);
  });

  it("recommends chalk as the alternative", () => {
    const a = advisor.advise("chalk");
    expect(a.safety).toBe("trusted");
    expect(a.recommended).toBe(true);
  });

  it("returns unknown for unrecognised packages", () => {
    const a = advisor.advise("some-obscure-package-xyz");
    expect(a.safety).toBe("unknown");
    expect(a.recommended).toBe(false);
  });

  it("is case-insensitive", () => {
    const a = advisor.advise("Express");
    expect(a.safety).toBe("trusted");
  });

  it("provides a plain-English description", () => {
    const a = advisor.advise("lodash");
    expect(a.description.length).toBeGreaterThan(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. StepByStepWizard
// ─────────────────────────────────────────────────────────────────────────────
describe("StepByStepWizard", () => {
  const wizard = new StepByStepWizard();

  it("generates a plan for 'create react app'", () => {
    const plan = wizard.plan("I want to create react app");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.steps[0].status).toBe("pending");
  });

  it("generates a plan for 'deploy to github'", () => {
    const plan = wizard.plan("deploy to github");
    expect(plan.steps.some((s) => s.action?.includes("git"))).toBe(true);
  });

  it("falls back to a generic plan for unknown goals", () => {
    const plan = wizard.plan("build a rocket ship");
    expect(plan.steps.length).toBeGreaterThan(0);
    expect(plan.goal).toBe("build a rocket ship");
  });

  it("advance() marks current step done and moves to next", () => {
    const plan = wizard.plan("create react app");
    const advanced = wizard.advance(plan);
    expect(advanced.steps[0].status).toBe("done");
    expect(advanced.currentStep).toBe(1);
    expect(advanced.steps[1].status).toBe("in_progress");
  });

  it("advance() is idempotent when all steps are done", () => {
    let plan = wizard.plan("install dependencies");
    while (plan.currentStep < plan.steps.length) {
      plan = wizard.advance(plan);
    }
    const extra = wizard.advance(plan);
    expect(extra.currentStep).toBe(plan.currentStep);
  });

  it("all steps start as pending", () => {
    const plan = wizard.plan("some goal");
    expect(plan.steps.every((s) => s.status === "pending")).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. UndoStack
// ─────────────────────────────────────────────────────────────────────────────
describe("UndoStack", () => {
  it("undo restores the previous content", () => {
    const stack = new UndoStack();
    stack.push("before", "after", "Added a line");
    const result = stack.undo();
    expect(result.success).toBe(true);
    expect(result.content).toBe("before");
  });

  it("redo re-applies an undone edit", () => {
    const stack = new UndoStack();
    stack.push("v1", "v2", "Edit 1");
    stack.undo();
    const redo = stack.redo();
    expect(redo.success).toBe(true);
    expect(redo.content).toBe("v2");
  });

  it("undo on empty stack returns failure", () => {
    const stack = new UndoStack();
    const r = stack.undo();
    expect(r.success).toBe(false);
  });

  it("redo when nothing undone returns failure", () => {
    const stack = new UndoStack();
    stack.push("a", "b", "edit");
    expect(stack.redo().success).toBe(false);
  });

  it("undoCount and redoCount update correctly", () => {
    const stack = new UndoStack();
    stack.push("a", "b", "edit 1");
    stack.push("b", "c", "edit 2");
    expect(stack.undoCount).toBe(2);
    stack.undo();
    expect(stack.undoCount).toBe(1);
    expect(stack.redoCount).toBe(1);
  });

  it("pushing after undo discards the redo history", () => {
    const stack = new UndoStack();
    stack.push("a", "b", "edit 1");
    stack.undo();
    stack.push("a", "c", "edit 2");
    expect(stack.redoCount).toBe(0);
  });

  it("clear() empties the history", () => {
    const stack = new UndoStack();
    stack.push("a", "b", "edit");
    stack.clear();
    expect(stack.undoCount).toBe(0);
  });

  it("respects maxSize", () => {
    const stack = new UndoStack(3);
    stack.push("1", "2", "e1");
    stack.push("2", "3", "e2");
    stack.push("3", "4", "e3");
    stack.push("4", "5", "e4"); // should evict oldest
    expect(stack.undoCount).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. SmartScaffolder
// ─────────────────────────────────────────────────────────────────────────────
describe("SmartScaffolder", () => {
  const scaffolder = new SmartScaffolder();

  it("scaffolds an express api project", () => {
    const r = scaffolder.scaffold("I want to build an express api");
    expect(r.files.some((f) => f.path.includes("package.json"))).toBe(true);
    expect(r.setupCommands.length).toBeGreaterThan(0);
  });

  it("scaffolds a react app", () => {
    const r = scaffolder.scaffold("build a react app for my portfolio");
    expect(r.files.some((f) => f.path.includes("App.js"))).toBe(true);
  });

  it("scaffolds a python script", () => {
    const r = scaffolder.scaffold("write a python script to parse CSV files");
    expect(r.files.some((f) => f.path.includes("main.py"))).toBe(true);
  });

  it("falls back to a generic scaffold for unknown projects", () => {
    const r = scaffolder.scaffold("build a Haskell parser");
    expect(r.files.some((f) => f.path.includes("README.md"))).toBe(true);
    expect(r.type).toBe("Custom Project");
  });

  it("all generated files have non-empty content", () => {
    const r = scaffolder.scaffold("express api");
    expect(r.files.every((f) => f.content.length > 0)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. FriendlyProgressNarrator
// ─────────────────────────────────────────────────────────────────────────────
describe("FriendlyProgressNarrator", () => {
  // Use deterministic "random" to avoid flakiness
  const narrator = new FriendlyProgressNarrator(() => 0);

  it("narrates 0%", () => {
    const r = narrator.narrate(0);
    expect(r.percent).toBe(0);
    expect(r.done).toBe(false);
    expect(r.message).toBeTruthy();
  });

  it("narrates 50%", () => {
    const r = narrator.narrate(50);
    expect(r.percent).toBe(50);
    expect(r.done).toBe(false);
  });

  it("narrates 100% as done", () => {
    const r = narrator.narrate(100);
    expect(r.done).toBe(true);
    expect(r.emoji).toBe("🎉");
  });

  it("clamps values above 100", () => {
    const r = narrator.narrate(150);
    expect(r.percent).toBe(100);
  });

  it("clamps values below 0", () => {
    const r = narrator.narrate(-5);
    expect(r.percent).toBe(0);
  });

  it("includes operation name when provided", () => {
    const r = narrator.narrate(40, "Installing packages");
    expect(r.message).toContain("Installing packages");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. CodeIntentLogger
// ─────────────────────────────────────────────────────────────────────────────
describe("CodeIntentLogger", () => {
  const logger = new CodeIntentLogger();

  it("prepends an intent comment to TypeScript code", () => {
    const r = logger.annotate("const x = 1;", "Store the number 1 in x.", { language: "typescript" });
    expect(r.annotated).toContain("Intent:");
    expect(r.annotated).toContain("Store the number 1 in x.");
    expect(r.annotated).toContain("const x = 1;");
    expect(r.commentStyle).toBe("//");
  });

  it("uses # comments for Python", () => {
    const r = logger.annotate("x = 1", "Store the number 1 in x.", { language: "python" });
    expect(r.commentStyle).toBe("#");
    expect(r.annotated).toMatch(/^#/);
  });

  it("includes a date in the annotation", () => {
    const r = logger.annotate("x = 1", "test intent");
    expect(r.annotated).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("uses a custom author label", () => {
    const r = logger.annotate("x = 1", "test intent", { author: "OverCoat" });
    expect(r.annotated).toContain("OverCoat");
  });

  it("returns the intent separately", () => {
    const intent = "Do the thing.";
    const r = logger.annotate("x = 1", intent);
    expect(r.intent).toBe(intent);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. RookieModeToggle
// ─────────────────────────────────────────────────────────────────────────────
describe("RookieModeToggle", () => {
  it("starts in standard mode by default", () => {
    const toggle = new RookieModeToggle();
    expect(toggle.config.verbosity).toBe("standard");
    expect(toggle.isRookieMode()).toBe(false);
  });

  it("switching to rookie mode enables all beginner aids", () => {
    const toggle = new RookieModeToggle();
    toggle.setVerbosity("rookie");
    expect(toggle.config.verbosity).toBe("rookie");
    expect(toggle.config.showAnalogies).toBe(true);
    expect(toggle.config.confirmBeforeAction).toBe(true);
    expect(toggle.config.autoSimplifyErrors).toBe(true);
    expect(toggle.isRookieMode()).toBe(true);
  });

  it("expert mode disables all beginner aids", () => {
    const toggle = new RookieModeToggle({ verbosity: "rookie" });
    toggle.setVerbosity("expert");
    expect(toggle.config.showAnalogies).toBe(false);
    expect(toggle.config.confirmBeforeAction).toBe(false);
  });

  it("getSystemPromptPrefix returns a rookie-friendly prefix in rookie mode", () => {
    const toggle = new RookieModeToggle();
    toggle.setVerbosity("rookie");
    const prompt = toggle.getSystemPromptPrefix();
    expect(prompt.prefix).toContain("plain");
    expect(prompt.verbosity).toBe("rookie");
  });

  it("getSystemPromptPrefix returns a concise prefix in expert mode", () => {
    const toggle = new RookieModeToggle();
    toggle.setVerbosity("expert");
    const prompt = toggle.getSystemPromptPrefix();
    expect(prompt.prefix.toLowerCase()).toContain("concise");
  });

  it("initial config can be overridden via constructor", () => {
    const toggle = new RookieModeToggle({ verbosity: "expert" });
    expect(toggle.config.verbosity).toBe("expert");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. VisualDiffFormatter
// ─────────────────────────────────────────────────────────────────────────────
describe("VisualDiffFormatter", () => {
  const formatter = new VisualDiffFormatter();

  const sampleDiff = [
    "--- a/file.ts",
    "+++ b/file.ts",
    "@@ -1,3 +1,3 @@",
    " unchanged line",
    "-removed line",
    "+added line",
  ].join("\n");

  it("counts added and removed lines", () => {
    const r = formatter.format(sampleDiff);
    expect(r.addedCount).toBe(1);
    expect(r.removedCount).toBe(1);
  });

  it("includes header lines", () => {
    const r = formatter.format(sampleDiff);
    expect(r.lines.some((l) => l.type === "header")).toBe(true);
  });

  it("labels added lines with '+ '", () => {
    const r = formatter.format(sampleDiff);
    const added = r.lines.find((l) => l.type === "added");
    expect(added?.label).toBe("+ ");
  });

  it("labels removed lines with '- '", () => {
    const r = formatter.format(sampleDiff);
    const removed = r.lines.find((l) => l.type === "removed");
    expect(removed?.label).toBe("- ");
  });

  it("produces a human-readable summary", () => {
    const r = formatter.format(sampleDiff);
    expect(r.summary).toMatch(/added|removed/i);
  });

  it("render() returns a string", () => {
    const diff = formatter.format(sampleDiff);
    const rendered = formatter.render(diff);
    expect(typeof rendered).toBe("string");
    expect(rendered).toContain("added line");
  });

  it("handles an empty diff", () => {
    const r = formatter.format("");
    expect(r.addedCount).toBe(0);
    expect(r.removedCount).toBe(0);
    expect(r.summary).toBe("No changes.");
  });

  it("summary uses plural for multiple lines", () => {
    const diff = ["+line1", "+line2"].join("\n");
    const r = formatter.format(diff);
    expect(r.summary).toContain("2 lines added");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. AutoExplainMode
// ─────────────────────────────────────────────────────────────────────────────
describe("AutoExplainMode", () => {
  it("appends an explanation after a code block", () => {
    const explainer = new AutoExplainMode();
    const input = "Here is the code:\n```js\nconsole.log('hello')\n```\n";
    const r = explainer.augment(input);
    expect(r.blocksExplained).toBe(1);
    expect(r.augmented).toContain("💡");
    expect(r.augmented).toContain("**What this does:**");
  });

  it("explains multiple blocks when explainAll is true", () => {
    const explainer = new AutoExplainMode({ explainAll: true });
    const input = "```js\nconsole.log('a')\n```\n\n```js\nconsole.log('b')\n```\n";
    const r = explainer.augment(input);
    expect(r.blocksExplained).toBe(2);
  });

  it("only explains first block when explainAll is false", () => {
    const explainer = new AutoExplainMode({ explainAll: false });
    const input = "```js\nconsole.log('a')\n```\n\n```js\nconsole.log('b')\n```\n";
    const r = explainer.augment(input);
    expect(r.blocksExplained).toBe(1);
  });

  it("uses custom explanation when provided", () => {
    const explainer = new AutoExplainMode();
    const code = "const x = 1;";
    const input = `\`\`\`js\n${code}\n\`\`\`\n`;
    const customs = new Map([[code, "This stores 1 in x."]]);
    const r = explainer.augment(input, customs);
    expect(r.augmented).toContain("This stores 1 in x.");
  });

  it("returns 0 blocks for text with no code fences", () => {
    const explainer = new AutoExplainMode();
    const r = explainer.augment("No code here, just prose.");
    expect(r.blocksExplained).toBe(0);
    expect(r.augmented).toBe("No code here, just prose.");
  });

  it("exposes the options", () => {
    const explainer = new AutoExplainMode({ audience: "expert" });
    expect(explainer.options.audience).toBe("expert");
  });

  it("generates an import/require-based explanation", () => {
    const explainer = new AutoExplainMode();
    const input = "```js\nconst express = require('express');\n```\n";
    const r = explainer.augment(input);
    expect(r.augmented).toMatch(/library|module/i);
  });
});
