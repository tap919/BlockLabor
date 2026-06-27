import {
  I18nManager,
  ScreenReaderAdapter,
  CognitiveAssistant,
  VoiceController,
} from "./a11y";

describe("I18nManager", () => {
  it("returns English messages by default", () => {
    const i18n = new I18nManager();
    expect(i18n.t("command.success")).toBe("Command completed successfully");
  });

  it("interpolates variables", () => {
    const i18n = new I18nManager();
    const msg = i18n.t("command.failure", { exitCode: "1" });
    expect(msg).toContain("1");
  });

  it("falls back to default text for missing locale", () => {
    const i18n = new I18nManager("fr");
    // No French translations loaded
    expect(i18n.t("command.success")).toBe("Command completed successfully");
  });

  it("adds translations for a locale", () => {
    const i18n = new I18nManager("es");
    i18n.addTranslations("es", {
      "command.success": "Comando completado con éxito",
    });
    expect(i18n.t("command.success")).toBe("Comando completado con éxito");
  });

  it("returns key for unknown messages", () => {
    const i18n = new I18nManager();
    expect(i18n.t("unknown.key")).toBe("unknown.key");
  });

  it("lists available locales", () => {
    const i18n = new I18nManager();
    const locales = i18n.getAvailableLocales();
    expect(locales).toContain("en");
  });
});

describe("ScreenReaderAdapter", () => {
  it("passes through when disabled", () => {
    const adapter = new ScreenReaderAdapter({ enabled: false });
    const output = "\x1b[31mRed text\x1b[0m";
    expect(adapter.transform(output)).toBe(output);
  });

  it("strips ANSI codes when enabled", () => {
    const adapter = new ScreenReaderAdapter({ enabled: true });
    const result = adapter.transform("\x1b[31mRed text\x1b[0m");
    expect(result).toBe("Red text");
    expect(result).not.toContain("\x1b[");
  });

  it("replaces Unicode symbols", () => {
    const adapter = new ScreenReaderAdapter({ enabled: true });
    expect(adapter.transform("✓ Passed")).toBe("[OK] Passed");
    expect(adapter.transform("✗ Failed")).toBe("[FAIL] Failed");
  });

  it("queues and retrieves announcements", () => {
    const adapter = new ScreenReaderAdapter();
    adapter.announce("Build complete", "polite");
    adapter.announce("Error detected", "assertive");
    const announcements = adapter.getAnnouncements();
    expect(announcements).toHaveLength(2);
    // Queue should be cleared after retrieval
    expect(adapter.getAnnouncements()).toHaveLength(0);
  });
});

describe("CognitiveAssistant", () => {
  const assistant = new CognitiveAssistant();

  it("scores simple commands as low complexity", () => {
    expect(assistant.scoreComplexity("ls")).toBeLessThan(3);
    expect(assistant.getLevel("ls")).toBe("simple");
  });

  it("scores piped commands as higher complexity", () => {
    const score = assistant.scoreComplexity("grep pattern file | sort | uniq -c");
    expect(score).toBeGreaterThan(2);
  });

  it("scores complex commands with subshells", () => {
    const score = assistant.scoreComplexity(
      "find . -name '*.ts' | xargs grep $(cat pattern.txt)"
    );
    expect(score).toBeGreaterThan(4);
  });

  it("simplifies piped commands into levels", () => {
    const result = assistant.simplify("cat file | grep pattern | sort");
    expect(result.levels.length).toBeGreaterThanOrEqual(2);
    expect(result.levels[0].level).toBe("simple");
    expect(result.levels[0].command).toBe("cat file");
  });

  it("handles simple commands without pipes", () => {
    const result = assistant.simplify("echo hello");
    expect(result.levels).toHaveLength(1);
    expect(result.levels[0].command).toBe("echo hello");
  });
});

describe("VoiceController", () => {
  let controller: VoiceController;

  beforeEach(() => {
    controller = new VoiceController({ wakeWord: "overcoat", enabled: true });
  });

  describe("configuration", () => {
    it("returns the current configuration", () => {
      const config = controller.getConfig();
      expect(config.wakeWord).toBe("overcoat");
      expect(config.enabled).toBe(true);
    });

    it("updates configuration", () => {
      controller.setConfig({ wakeWord: "hey claude" });
      expect(controller.getConfig().wakeWord).toBe("hey claude");
    });

    it("enables and disables voice control", () => {
      controller.disable();
      expect(controller.isEnabled()).toBe(false);
      controller.enable();
      expect(controller.isEnabled()).toBe(true);
    });
  });

  describe("state management", () => {
    it("starts in idle state", () => {
      const newController = new VoiceController();
      expect(newController.getState()).toBe("idle");
    });

    it("transitions to listening state", () => {
      controller.startListening();
      expect(controller.getState()).toBe("listening");
    });

    it("transitions back to idle", () => {
      controller.startListening();
      controller.stopListening();
      expect(controller.getState()).toBe("idle");
    });

    it("notifies state change handlers", () => {
      const states: string[] = [];
      controller.onStateChange((state) => states.push(state));
      controller.startListening();
      controller.stopListening();
      expect(states).toEqual(["listening", "idle"]);
    });
  });

  describe("parseIntent", () => {
    it("parses execute commands", () => {
      const result = controller.parseIntent("run npm test");
      expect(result.intent).toBe("execute");
      expect(result.parameters.command).toBe("npm test");
    });

    it("parses navigate commands", () => {
      const result = controller.parseIntent("go to src folder");
      expect(result.intent).toBe("navigate");
      expect(result.parameters.path).toBe("src folder");
    });

    it("parses search commands", () => {
      const result = controller.parseIntent("search for config files");
      expect(result.intent).toBe("search");
      expect(result.parameters.query).toBe("config files");
    });

    it("parses create commands", () => {
      const result = controller.parseIntent("create file test.txt");
      expect(result.intent).toBe("create");
      expect(result.parameters.name).toBe("test.txt");
    });

    it("parses delete commands", () => {
      const result = controller.parseIntent("delete temp files");
      expect(result.intent).toBe("delete");
      expect(result.parameters.target).toBe("temp files");
    });

    it("parses copy command", () => {
      const result = controller.parseIntent("copy selection");
      expect(result.intent).toBe("copy");
    });

    it("parses paste command", () => {
      const result = controller.parseIntent("paste");
      expect(result.intent).toBe("paste");
    });

    it("parses undo command", () => {
      const result = controller.parseIntent("undo");
      expect(result.intent).toBe("undo");
    });

    it("parses redo command", () => {
      const result = controller.parseIntent("redo");
      expect(result.intent).toBe("redo");
    });

    it("parses help command", () => {
      const result = controller.parseIntent("help");
      expect(result.intent).toBe("help");
    });

    it("parses help with topic", () => {
      const result = controller.parseIntent("how do I create a file");
      expect(result.intent).toBe("help");
      expect(result.parameters.topic).toBe("create a file");
    });

    it("parses stop command", () => {
      const result = controller.parseIntent("stop");
      expect(result.intent).toBe("stop");
    });

    it("parses confirm command", () => {
      const result = controller.parseIntent("yes");
      expect(result.intent).toBe("confirm");
    });

    it("parses cancel command", () => {
      const result = controller.parseIntent("no");
      expect(result.intent).toBe("cancel");
    });

    it("returns unknown for unrecognized commands", () => {
      const result = controller.parseIntent("random gibberish");
      expect(result.intent).toBe("unknown");
      expect(result.parameters.raw).toBe("random gibberish");
    });
  });

  describe("processTranscript", () => {
    it("processes final transcripts", () => {
      const received: string[] = [];
      controller.onCommand((cmd) => received.push(cmd.transcript));
      controller.processTranscript("overcoat run tests", 0.9, true);
      expect(received).toHaveLength(1);
    });

    it("does not notify for interim transcripts", () => {
      const received: string[] = [];
      controller.onCommand((cmd) => received.push(cmd.transcript));
      controller.processTranscript("overcoat run", 0.8, false);
      expect(received).toHaveLength(0);
    });

    it("removes wake word from transcript", () => {
      const command = controller.processTranscript("overcoat run npm test", 0.9, true);
      expect(command.intent).toBe("execute");
      expect(command.parameters?.command).toBe("npm test");
    });

    it("stores commands in history", () => {
      controller.processTranscript("overcoat help", 0.9, true);
      const history = controller.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].intent).toBe("help");
    });
  });

  describe("queueFeedback", () => {
    it("queues feedback messages", () => {
      controller.queueFeedback("Command executed");
      const feedback = controller.getNextFeedback();
      expect(feedback?.text).toBe("Command executed");
    });

    it("prioritizes high priority messages", () => {
      controller.queueFeedback("Normal message", "normal");
      controller.queueFeedback("High priority", "high");
      const first = controller.getNextFeedback();
      expect(first?.text).toBe("High priority");
    });

    it("clears queue on interrupt", () => {
      controller.queueFeedback("Message 1");
      controller.queueFeedback("Message 2");
      controller.queueFeedback("Interrupt!", "normal", true);
      expect(controller.getNextFeedback()?.text).toBe("Interrupt!");
      expect(controller.getNextFeedback()).toBeNull();
    });

    it("does not queue when voice feedback is disabled", () => {
      controller.setConfig({ voiceFeedback: false });
      controller.queueFeedback("Should not be queued");
      expect(controller.getNextFeedback()).toBeNull();
    });
  });

  describe("generateConfirmation", () => {
    it("generates confirmation for execute", () => {
      const cmd = controller.processTranscript("overcoat run npm test", 0.9, true);
      const confirmation = controller.generateConfirmation(cmd);
      expect(confirmation).toContain("Running");
      expect(confirmation).toContain("npm test");
    });

    it("generates confirmation for navigate", () => {
      const cmd = controller.processTranscript("overcoat go to src", 0.9, true);
      const confirmation = controller.generateConfirmation(cmd);
      expect(confirmation).toContain("Navigating");
    });

    it("generates confirmation for unknown intent", () => {
      const cmd = controller.processTranscript("overcoat random stuff", 0.9, true);
      const confirmation = controller.generateConfirmation(cmd);
      expect(confirmation).toContain("rephrase");
    });
  });

  describe("getAvailableCommands", () => {
    it("returns a list of available commands with examples", () => {
      const commands = controller.getAvailableCommands();
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.some((c) => c.intent === "execute")).toBe(true);
      expect(commands.some((c) => c.intent === "help")).toBe(true);
    });
  });

  describe("history management", () => {
    it("clears history", () => {
      controller.processTranscript("overcoat help", 0.9, true);
      controller.clearHistory();
      expect(controller.getHistory()).toHaveLength(0);
    });
  });
});

describe("CognitiveAssistant - extended simplification", () => {
  const assistant = new CognitiveAssistant();

  it("simplifies && chained commands", () => {
    const result = assistant.simplify("npm install && npm run build && npm test");
    expect(result.levels.length).toBeGreaterThan(1);
    expect(result.levels[0].command).toBe("npm install");
    expect(result.levels[0].level).toBe("simple");
  });

  it("simplifies commands with many long flags", () => {
    const result = assistant.simplify("curl --verbose --compressed --location --silent --output file.tar.gz");
    expect(result.levels.length).toBeGreaterThanOrEqual(2);
    expect(result.levels[0].level).toBe("simple");
    expect(result.levels[result.levels.length - 1].command).toContain("--verbose");
  });

  it("handles single simple commands", () => {
    const result = assistant.simplify("ls");
    expect(result.levels).toHaveLength(1);
    expect(result.levels[0].command).toBe("ls");
  });

  it("handles pipe-chained commands", () => {
    const result = assistant.simplify("cat file.txt | grep pattern | sort | uniq");
    const levels = result.levels;
    expect(levels[0].command).toBe("cat file.txt");
    expect(levels[levels.length - 1].command).toContain("|");
  });
});
