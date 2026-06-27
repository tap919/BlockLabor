import {
  DocGenerator,
  LearningMode,
  SnippetLibrary,
  ContextualHelpProvider,
} from "./knowledge-base";

describe("DocGenerator", () => {
  const gen = new DocGenerator();

  it("generates docs from a bash script", () => {
    const doc = gen.generateFromScript(
      "deploy.sh",
      '#!/bin/bash\n# Deploy the application\n# Usage: deploy.sh --env production\necho "deploying"',
      "bash"
    );
    expect(doc.name).toBe("deploy.sh");
    expect(doc.description).toBe("Deploy the application");
    expect(doc.usage).toContain("deploy.sh --env production");
    expect(doc.source).toBe("auto");
  });

  it("extracts flags from script content", () => {
    const doc = gen.generateFromScript(
      "tool",
      "if [ --verbose ]; then echo debug; fi\n--output flag",
      "bash"
    );
    expect(doc.options.length).toBeGreaterThanOrEqual(2);
  });
});

describe("LearningMode", () => {
  const learner = new LearningMode();

  it("explains known commands", () => {
    const explanation = learner.explain("git status");
    expect(explanation.program).toBe("git");
    expect(explanation.explanation).toContain("version control");
  });

  it("breaks command into parts", () => {
    const explanation = learner.explain("grep -r pattern src/");
    expect(explanation.parts).toHaveLength(4);
    expect(explanation.parts[0].text).toBe("grep");
    expect(explanation.parts[1].meaning).toContain("option");
  });

  it("can be enabled and disabled", () => {
    const mode = new LearningMode();
    expect(mode.isEnabled()).toBe(true);
    mode.setEnabled(false);
    expect(mode.isEnabled()).toBe(false);
  });
});

describe("SnippetLibrary", () => {
  it("adds and retrieves snippets", () => {
    const library = new SnippetLibrary();
    const snippet = library.add(
      "Express Server",
      'const app = require("express")();',
      "javascript",
      "Basic Express setup",
      ["node", "server"]
    );
    expect(library.get(snippet.id)).not.toBeNull();
  });

  it("searches by title", () => {
    const library = new SnippetLibrary();
    library.add("Express Server", "code", "javascript", "", ["server"]);
    library.add("React Component", "code", "javascript", "", ["frontend"]);
    expect(library.search("Express")).toHaveLength(1);
  });

  it("searches by tag", () => {
    const library = new SnippetLibrary();
    library.add("A", "code", "js", "", ["deploy"]);
    library.add("B", "code", "js", "", ["test"]);
    expect(library.search("deploy")).toHaveLength(1);
  });

  it("filters by language", () => {
    const library = new SnippetLibrary();
    library.add("A", "code", "python", "");
    library.add("B", "code", "javascript", "");
    expect(library.getByLanguage("python")).toHaveLength(1);
  });

  it("deletes snippets", () => {
    const library = new SnippetLibrary();
    const snippet = library.add("Temp", "code", "bash", "");
    library.delete(snippet.id);
    expect(library.getAll()).toHaveLength(0);
  });
});

describe("ContextualHelpProvider", () => {
  const provider = new ContextualHelpProvider();

  it("detects Node.js projects", () => {
    expect(provider.detectProjectType(["package.json"])).toBe("node");
  });

  it("detects Rust projects", () => {
    expect(provider.detectProjectType(["Cargo.toml"])).toBe("rust");
  });

  it("detects Python projects", () => {
    expect(provider.detectProjectType(["requirements.txt"])).toBe("python");
  });

  it("returns unknown for unrecognized projects", () => {
    expect(provider.detectProjectType(["random.file"])).toBe("unknown");
  });

  it("provides help for Node.js projects", () => {
    const help = provider.getHelp(["package.json"]);
    expect(help.length).toBeGreaterThan(0);
    expect(help.some((h) => h.command.includes("npm"))).toBe(true);
  });
});

describe("SnippetLibrary - export/import", () => {
  it("exports all snippets as JSON", () => {
    const lib = new SnippetLibrary();
    lib.add("Snippet A", "echo hello", "bash", "A test snippet", ["test"]);
    lib.add("Snippet B", "ls -la", "bash", "List files", ["shell"]);
    const json = lib.exportJSON();
    const parsed = JSON.parse(json);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe("Snippet A");
  });

  it("imports snippets from JSON", () => {
    const source = new SnippetLibrary();
    source.add("Docker run", "docker run -it ubuntu bash", "bash", "Run Ubuntu container");
    const json = source.exportJSON();

    const target = new SnippetLibrary();
    const count = target.importJSON(json);
    expect(count).toBe(1);
    expect(target.getAll()).toHaveLength(1);
    expect(target.getAll()[0].title).toBe("Docker run");
  });

  it("does not overwrite existing snippets on import", () => {
    const lib = new SnippetLibrary();
    lib.add("Original", "code", "bash", "desc");
    const json = lib.exportJSON();
    const count = lib.importJSON(json);
    expect(count).toBe(0); // Already exists, not imported again
    expect(lib.getAll()).toHaveLength(1);
  });

  it("returns 0 for invalid JSON", () => {
    const lib = new SnippetLibrary();
    expect(lib.importJSON("not json")).toBe(0);
    expect(lib.importJSON("{}")).toBe(0); // Object, not array
  });
});

describe("DocGenerator - JSDoc extraction", () => {
  const gen = new DocGenerator();

  it("extracts @param tags from TypeScript JSDoc", () => {
    const content = `/**
 * Greet a user.
 * @param name - The user's name
 * @param greeting - The greeting to use
 * @returns The greeting string
 */
function greet(name: string, greeting: string): string {
  return \`\${greeting}, \${name}!\`;
}`;
    const doc = gen.generateFromScript("greet", content, "typescript");
    expect(doc.options.some((o) => o.flag === "--name")).toBe(true);
    expect(doc.options.some((o) => o.flag === "--greeting")).toBe(true);
    expect(doc.options.find((o) => o.flag === "--name")?.description).toContain("user's name");
    expect(doc.details).toContain("Returns");
  });
});

describe("LearningMode - extended commands", () => {
  it("knows about cargo", () => {
    const mode = new LearningMode();
    const explanation = mode.explain("cargo build");
    expect(explanation.explanation).toContain("Rust");
  });

  it("knows about tsc", () => {
    const mode = new LearningMode();
    const explanation = mode.explain("tsc --noEmit");
    expect(explanation.explanation).toContain("TypeScript");
  });

  it("knows about pytest", () => {
    const mode = new LearningMode();
    const explanation = mode.explain("pytest -v");
    expect(explanation.explanation).toContain("testing");
  });
});

describe("ContextualHelpProvider - extended project types", () => {
  const provider = new ContextualHelpProvider();

  it("detects Maven Java projects", () => {
    expect(provider.detectProjectType(["pom.xml"])).toBe("java-maven");
  });

  it("detects Docker projects", () => {
    expect(provider.detectProjectType(["Dockerfile"])).toBe("docker");
  });

  it("detects Ruby projects", () => {
    expect(provider.detectProjectType(["Gemfile"])).toBe("ruby");
  });

  it("detects Terraform projects", () => {
    expect(provider.detectProjectType(["main.tf"])).toBe("terraform");
  });

  it("provides docker help commands", () => {
    const help = provider.getHelp(["Dockerfile"]);
    expect(help.some((h) => h.command.includes("docker build"))).toBe(true);
  });
});
