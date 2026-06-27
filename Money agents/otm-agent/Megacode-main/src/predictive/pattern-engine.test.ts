import { PatternEngine } from "./pattern-engine";

describe("PatternEngine", () => {
  let engine: PatternEngine;

  beforeEach(() => {
    engine = new PatternEngine({ minPatternFrequency: 2 });
  });

  describe("recordCommand", () => {
    it("stores commands in history", () => {
      engine.recordCommand("git status");
      engine.recordCommand("git add .");
      // No error means success
    });
  });

  describe("detectPatterns", () => {
    it("detects repeated command sequences", () => {
      engine.recordCommand("git add .");
      engine.recordCommand("git commit -m 'test'");
      engine.recordCommand("git add .");
      engine.recordCommand("git commit -m 'test'");

      const patterns = engine.getPatterns();
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe("predictNext", () => {
    it("predicts next command from known pattern", () => {
      // Build a pattern
      for (let i = 0; i < 3; i++) {
        engine.recordCommand("npm run build");
        engine.recordCommand("npm test");
      }

      engine.recordCommand("npm run build");
      const predictions = engine.predictNext();
      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0].command).toBe("npm test");
    });

    it("returns empty when no history", () => {
      const predictions = engine.predictNext();
      expect(predictions).toEqual([]);
    });
  });

  describe("predictErrors", () => {
    it("warns about destructive rm commands", () => {
      const predictions = engine.predictErrors("rm -rf /");
      expect(predictions.length).toBeGreaterThan(0);
      expect(predictions[0].likelihood).toBeGreaterThan(0.9);
    });

    it("checks npm prerequisites", () => {
      const predictions = engine.predictErrors("npm run build");
      expect(predictions.length).toBeGreaterThan(0);
    });
  });

  describe("analyzeResources", () => {
    it("returns a resource snapshot", async () => {
      const result = await engine.analyzeResources();
      expect(result.snapshot.timestamp).toBeGreaterThan(0);
      expect(result.snapshot.memoryUsedMB).toBeGreaterThan(0);
    });
  });

  describe("resource monitoring", () => {
    it("starts and stops without error", () => {
      engine = new PatternEngine({
        resourceMonitoring: true,
        resourcePollIntervalMs: 100000,
      });
      engine.startResourceMonitoring();
      engine.stopResourceMonitoring();
    });
  });
});
