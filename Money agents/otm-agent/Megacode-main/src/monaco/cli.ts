/**
 * CLI Interface for Monaco IDE Integration.
 *
 * Provides a command-line interface for interacting with the Monaco IDE,
 * MCP servers, and web research capabilities.
 */

import * as readline from "readline";
import { homedir } from "os";
import { join } from "path";
import { existsSync, readFileSync } from "fs";
import {
  MonacoIDE,
  MonacoIDEConfig,
  IDETool,
  ResearchResult,
  MCPServerConfig,
} from "./ide-integration";

export interface CLIConfig {
  /** Monaco IDE connection config */
  monaco?: Partial<MonacoIDEConfig>;
  /** Auto-connect on start */
  autoConnect?: boolean;
  /** Welcome message */
  welcome?: string;
  /** Prompt prefix */
  prompt?: string;
}

/**
 * CLI command definition.
 */
export interface CLICommand {
  name: string;
  description: string;
  aliases?: string[];
  usage?: string;
  execute: (args: string[], context: CLIContext) => Promise<void>;
}

/**
 * CLI execution context.
 */
export interface CLIContext {
  ide: MonacoIDE;
  rl: readline.Interface;
  history: string[];
}

const DEFAULT_WELCOME = `
╔══════════════════════════════════════════════════════════╗
║           Megacode Monaco IDE Controller                 ║
║                                                          ║
║  AI-powered IDE integration with MCP support             ║
║  Type 'help' for available commands                      ║
║                                                          ║
║  🛒 Chop Shop Marketplace:                               ║
║    • 'chopshop' for developer marketplace                ║
║    • 'collab' for collaboration sessions                 ║
║    • 'tool' for developer tools                          ║
╚══════════════════════════════════════════════════════════╝
`;

/**
 * Interactive CLI for Monaco IDE.
 */
export class MonacoCLI {
  private ide: MonacoIDE;
  private rl: readline.Interface | null = null;
  private running: boolean = false;
  private history: string[] = [];
  private commands: Map<string, CLICommand> = new Map();
  private config: CLIConfig;
  private promptPrefix: string = "megacode";

  constructor(config: CLIConfig = {}) {
    this.config = config;
    this.ide = new MonacoIDE(config.monaco ?? {});
    this.registerDefaultCommands();
    this.registerChopShopCommands();
  }

  /**
   * Register default CLI commands.
   */
  private registerDefaultCommands(): void {
    this.registerCommand({
      name: "help",
      description: "Show available commands",
      aliases: ["h", "?"],
      execute: async (_, context) => {
        context.rl.write("\nAvailable commands:\n\n");
        
        const maxNameLen = Math.max(...Array.from(this.commands.values()).map(c => c.name.length));
        
        for (const cmd of this.commands.values()) {
          const name = cmd.name.padEnd(maxNameLen);
          context.rl.write(`  ${name}  ${cmd.description}\n`);
        }
        
        context.rl.write("\nMarketplace & Collaboration:\n");
        context.rl.write("  chopshop       Developer marketplace integration\n");
        context.rl.write("  collab         Collaboration session management\n");
        context.rl.write("  tool           Developer tool operations\n");
        context.rl.write("\n");
      },
    });

    this.registerCommand({
      name: "connect",
      description: "Connect to Monaco IDE",
      aliases: ["conn"],
      usage: "connect [ide-path]",
      execute: async (args) => {
        if (this.ide.isConnected()) {
          console.log("Already connected to IDE");
          return;
        }
        
        console.log("Connecting to Monaco IDE...");
        await this.ide.connect();
        console.log("Connected!");
        
        // Discover tools
        const tools = await this.ide.discoverTools();
        console.log(`Discovered ${tools.length} tools`);
      },
    });

    this.registerCommand({
      name: "disconnect",
      description: "Disconnect from Monaco IDE",
      aliases: ["disc"],
      execute: async () => {
        this.ide.disconnect();
        console.log("Disconnected from IDE");
      },
    });

    this.registerCommand({
      name: "status",
      description: "Show connection status and info",
      aliases: ["stat", "s"],
      execute: async () => {
        console.log(`\nConnection: ${this.ide.isConnected() ? "✓ Connected" : "✗ Disconnected"}`);
        
        const tools = this.ide.getTools();
        console.log(`Tools: ${tools.length} available`);
        
        // Group by category
        const byCategory: Record<string, number> = {};
        for (const tool of tools) {
          byCategory[tool.category] = (byCategory[tool.category] ?? 0) + 1;
        }
        
        console.log("\nBy category:");
        for (const [cat, count] of Object.entries(byCategory)) {
          console.log(`  ${cat}: ${count}`);
        }
        
        // MCP status
        const mcpStatus = this.ide.getMCPServerStatus();
        console.log(`\nMCP Servers: ${mcpStatus.length}`);
        for (const server of mcpStatus) {
          console.log(`  ${server.name}: ${server.connected ? "✓ Connected" : "✗ Disconnected"}`);
        }
        
        // API Keys status
        console.log("\nAPI Keys:");
        const { DEFAULT_API_KEYS } = await import("./controller");
        const providers = ["deepseek", "ollama", "mistral", "openai"] as const;
        for (const provider of providers) {
          const key = DEFAULT_API_KEYS[provider];
          const available = !!key;
          console.log(`  ${provider}: ${available ? "✓ " + (key?.substring(0, 10) + "...") : "✗ Not configured"}`);
        }
        
        console.log("");
      },
    });

    this.registerCommand({
      name: "tools",
      description: "List available tools",
      aliases: ["t", "list"],
      usage: "tools [category]",
      execute: async (args) => {
        let tools = this.ide.getTools();
        
        if (args[0]) {
          const category = args[0].toLowerCase() as IDETool["category"];
          tools = tools.filter(t => t.category === category);
        }
        
        console.log(`\n${tools.length} tool(s):\n`);
        
        for (const tool of tools) {
          console.log(`  ${tool.name}`);
          console.log(`    Category: ${tool.category}`);
          console.log(`    Source: ${tool.source}`);
          if (tool.description) {
            console.log(`    ${tool.description}`);
          }
          console.log("");
        }
      },
    });

    this.registerCommand({
      name: "exec",
      description: "Execute a tool",
      aliases: ["e", "run", "x"],
      usage: "exec <tool-id> [params]",
      execute: async (args, context) => {
        if (args.length === 0) {
          console.log("Usage: exec <tool-id> [params]");
          return;
        }
        
        const toolId = args[0];
        let params: unknown = undefined;
        
        if (args[1]) {
          try {
            params = JSON.parse(args.slice(1).join(" "));
          } catch {
            params = args.slice(1).join(" ");
          }
        }
        
        console.log(`Executing: ${toolId}`);
        const startTime = Date.now();
        
        try {
          const result = await this.ide.executeTool({ toolId, params });
          const duration = Date.now() - startTime;
          
          console.log(`\n✓ Completed in ${duration}ms`);
          if (result !== undefined) {
            console.log("\nResult:");
            console.log(JSON.stringify(result, null, 2));
          }
        } catch (err) {
          console.log(`\n✗ Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    });

    this.registerCommand({
      name: "search",
      description: "Search the web",
      aliases: ["web", "google"],
      usage: "search <query>",
      execute: async (args) => {
        if (args.length === 0) {
          console.log("Usage: search <query>");
          return;
        }
        
        const query = args.join(" ");
        console.log(`Searching: ${query}`);
        
        try {
          const results = await this.ide.webSearch(query, 10);
          
          console.log(`\nFound ${results.length} results:\n`);
          
          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            console.log(`${i + 1}. ${r.title}`);
            console.log(`   ${r.url}`);
            if (r.snippet) {
              console.log(`   ${r.snippet.substring(0, 200)}...`);
            }
            console.log("");
          }
        } catch (err) {
          console.log(`Search error: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    });

    this.registerCommand({
      name: "research",
      description: "Research a topic with web search and source fetching",
      aliases: ["r", "learn"],
      usage: "research <topic>",
      execute: async (args) => {
        if (args.length === 0) {
          console.log("Usage: research <topic>");
          return;
        }
        
        const topic = args.join(" ");
        console.log(`Researching: ${topic}`);
        
        try {
          const result = await this.ide.research(topic);
          
          console.log(`\n=== Research: ${topic} ===\n`);
          console.log(`Sources: ${result.sources.length}`);
          
          for (let i = 0; i < result.sources.length; i++) {
            const source = result.sources[i];
            console.log(`\n--- Source ${i + 1} ---`);
            console.log(source.url);
            
            if (source.codeExamples && source.codeExamples.length > 0) {
              console.log(`\nCode examples (${source.codeExamples.length}):`);
              for (const code of source.codeExamples.slice(0, 3)) {
                console.log("```");
                console.log(code.substring(0, 500));
                console.log("```\n");
              }
            }
          }
        } catch (err) {
          console.log(`Research error: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    });

    this.registerCommand({
      name: "file",
      description: "File operations",
      aliases: ["f"],
      usage: "file <open|save|content> [path]",
      execute: async (args) => {
        if (args.length === 0) {
          console.log("Usage: file <open|save|content> [path]");
          return;
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
          case "open": {
            if (!args[1]) {
              console.log("Usage: file open <path>");
              return;
            }
            await this.ide.openFile(args[1]);
            console.log(`Opened: ${args[1]}`);
            break;
          }
          
          case "save": {
            await this.ide.saveFile(args[1]);
            console.log("Saved");
            break;
          }
          
          case "content": {
            const content = await this.ide.getFileContent(args[1]);
            console.log(content);
            break;
          }
          
          default:
            console.log(`Unknown action: ${action}`);
        }
      },
    });

    this.registerCommand({
      name: "insert",
      description: "Insert text at cursor",
      aliases: ["i", "add"],
      usage: 'insert "<text>"',
      execute: async (args) => {
        const text = args.join(" ");
        await this.ide.insertText(text);
        console.log("Text inserted");
      },
    });

    this.registerCommand({
      name: "mcp",
      description: "MCP server management",
      aliases: [],
      usage: "mcp <add|remove|list|connect> [options]",
      execute: async (args) => {
        if (args.length === 0) {
          // List servers
          const servers = this.ide.getMCPServerStatus();
          console.log("\nMCP Servers:");
          for (const s of servers) {
            console.log(`  ${s.name}: ${s.connected ? "✓" : "✗"}`);
          }
          return;
        }
        
        const action = args[0].toLowerCase();
        
        switch (action) {
          case "add": {
            if (args.length < 4) {
              console.log("Usage: mcp add <id> <name> <command> [args...]");
              return;
            }
            
            const serverConfig: MCPServerConfig = {
              id: args[1],
              name: args[2],
              type: "stdio",
              command: args[3],
              args: args.slice(4),
              enabled: true,
            };
            
            this.ide.addMCPServer(serverConfig);
            console.log(`Added MCP server: ${args[2]}`);
            break;
          }
          
          case "remove": {
            this.ide.removeMCPServer(args[1]);
            console.log(`Removed MCP server: ${args[1]}`);
            break;
          }
          
          case "connect": {
            await this.ide.discoverMCPTools();
            console.log("MCP tools discovered");
            break;
          }
          
          default:
            console.log(`Unknown action: ${action}`);
        }
      },
    });

    this.registerCommand({
      name: "workspace",
      description: "Workspace operations",
      aliases: ["ws", "w"],
      usage: "workspace <root|scan>",
      execute: async (args) => {
        if (args[0] === "root") {
          const root = this.ide.getWorkspaceRoot();
          console.log(`Workspace root: ${root}`);
        } else if (args[0] === "scan") {
          const exts = args.slice(1);
          const files = this.ide.scanWorkspace(exts.length ? exts : undefined);
          console.log(`Found ${files.length} files`);
          
          // Show first 20
          for (const file of files.slice(0, 20)) {
            console.log(`  ${file}`);
          }
          
          if (files.length > 20) {
            console.log(`  ... and ${files.length - 20} more`);
          }
        } else {
          console.log("Usage: workspace <root|scan> [extensions]");
        }
      },
    });

    this.registerCommand({
      name: "history",
      description: "Show command history",
      aliases: ["hist"],
      execute: async (_, context) => {
        console.log("\nCommand history:");
        for (let i = 0; i < context.history.length; i++) {
          console.log(`  ${i + 1}. ${context.history[i]}`);
        }
        console.log("");
      },
    });

    this.registerCommand({
      name: "clear",
      description: "Clear the screen",
      aliases: ["cls"],
      execute: async () => {
        console.clear();
      },
    });

    this.registerCommand({
      name: "exit",
      description: "Exit the CLI",
      aliases: ["quit", "q", "bye"],
      execute: async () => {
        this.running = false;
        this.ide.disconnect();
        process.exit(0);
      },
    });

    this.registerCommand({
      name: "keys",
      description: "Show API keys status",
      aliases: ["apikeys", "key"],
      execute: async () => {
        const { DEFAULT_API_KEYS } = await import("./controller");
        console.log("\n=== API Keys ===\n");
        console.log("DeepSeek: " + (DEFAULT_API_KEYS.deepseek ? "✓ Configured" : "✗ Missing"));
        console.log("Ollama:   " + (DEFAULT_API_KEYS.ollama ? "✓ Configured" : "✗ Missing"));
        console.log("Mistral:  " + (DEFAULT_API_KEYS.mistral ? "✓ Configured" : "✗ Missing"));
        console.log("OpenAI:   " + (DEFAULT_API_KEYS.openai ? "✓ Configured" : "✗ Missing"));
        console.log("\nSet via environment variables to override:");
        console.log("  DEEPSEEK_API_KEY, OLLAMA_API_KEY, MISTRAL_API_KEY, OPENAI_API_KEY");
        console.log("");
      },
    });
  }

  /**
   * Register a custom command.
   */
  registerCommand(command: CLICommand): void {
    this.commands.set(command.name, command);
    for (const alias of command.aliases ?? []) {
      this.commands.set(alias, command);
    }
  }

  /**
   * Register Chop Shop marketplace commands.
   */
  registerChopShopCommands(): void {
    // Chop Shop marketplace commands
    this.registerCommand({
      name: "chopshop",
      description: "Chop Shop marketplace integration",
      aliases: ["chop", "marketplace", "shop"],
      usage: "chopshop <login|devs|projects|link|pay|tools|status>",
      execute: async (args) => {
        if (args.length === 0) {
          console.log("\nChop Shop Marketplace Commands:");
          console.log("  login [email] [password] [type]  — Login as developer/client");
          console.log("  guest [name] [type]             — Login as guest");
          console.log("  devs                            — List available developers");
          console.log("  projects                        — List marketplace projects");
          console.log("  link [project-id]               — Link project to workspace");
          console.log("  linked                          — Show linked projects");
          console.log("  pay                             — Pay $5/month membership");
          console.log("  qr                              — Show CashApp QR code");
          console.log("  tools                           — List available dev tools");
          console.log("  toolbox                         — Show your assigned tools");
          console.log("  status                          — Show marketplace status");
          console.log("  logout                          — Logout from marketplace");
          console.log("");
          return;
        }

        const subcommand = args[0].toLowerCase();
        const subArgs = args.slice(1);

        // Simulate API calls for demo
        switch (subcommand) {
          case "login":
            if (subArgs.length < 3) {
              console.log("Usage: chopshop login [email] [password] [developer/client]");
              return;
            }
            console.log(`Logging in as ${subArgs[2]}: ${subArgs[0]}...`);
            console.log("✅ Logged in successfully");
            console.log("Type: " + subArgs[2] + ", Membership: active");
            break;

          case "guest":
            if (subArgs.length < 2) {
              console.log("Usage: chopshop guest [name] [developer/client]");
              return;
            }
            console.log(`Guest login: ${subArgs[0]} (${subArgs[1]})`);
            console.log("✅ Guest session created");
            break;

          case "devs":
            console.log("\nAvailable Developers:");
            console.log("  Alex Johnson - Full-Stack Developer ($75/hr)");
            console.log("    Skills: React, Node.js, TypeScript, Python");
            console.log("    Rating: 4.9 ✅ Available");
            console.log("");
            console.log("  Sam Rivera - UI/UX & Frontend Expert ($65/hr)");
            console.log("    Skills: React, Vue.js, Figma, CSS/SCSS");
            console.log("    Rating: 4.8 ✅ Available");
            console.log("");
            console.log("  Taylor Chen - Backend & DevOps ($85/hr)");
            console.log("    Skills: Go, Kubernetes, AWS, PostgreSQL");
            console.log("    Rating: 5.0 ❌ Currently busy");
            break;

          case "projects":
            console.log("\nMarketplace Projects:");
            console.log("  E-commerce Platform - open");
            console.log("    Budget: $5,000 - $10,000");
            console.log("    Build a modern online store with shopping cart");
            console.log("");
            console.log("  Fitness Tracking App - in-progress");
            console.log("    Budget: $8,000 - $15,000");
            console.log("    Mobile app with workout plans and progress tracking");
            break;

          case "link":
            if (subArgs.length < 1) {
              console.log("Usage: chopshop link [project-id]");
              return;
            }
            console.log(`Linking project ${subArgs[0]} to current workspace...`);
            console.log("✅ Project linked to workspace: Current Workspace");
            console.log("Linked at: " + new Date().toLocaleString());
            break;

          case "linked":
            console.log("\nLinked Projects:");
            console.log("  project-1 - E-commerce Platform");
            console.log("    Workspace: Current Workspace");
            console.log("    Linked: " + new Date().toLocaleDateString());
            break;

          case "pay":
            console.log("\n💰 Membership Payment:");
            console.log("Send $5 to: $overlay365 on CashApp");
            console.log("QR Code: https://cash.app/$overlay365/5");
            console.log("\nAfter payment, run: chopshop verify [payment-id]");
            break;

          case "qr":
            console.log("\n📱 CashApp QR Code:");
            console.log("Scan to send $5 to: $overlay365");
            console.log("[QR Code Placeholder]");
            console.log("Open CashApp → Scan QR → Enter $5");
            break;

          case "tools":
            console.log("\n🛠️ Developer Tools:");
            console.log("  🔍 Code Review Assistant (collaboration)");
            console.log("    AI-powered code review suggestions");
            console.log("");
            console.log("  👥 Pair Programming (collaboration)");
            console.log("    Real-time collaborative coding session");
            console.log("");
            console.log("  🐛 Debug Helper (development)");
            console.log("    Interactive debugging with step-through");
            break;

          case "toolbox":
            console.log("\nYour Toolbox:");
            console.log("  🔍 Code Review Assistant");
            console.log("  👥 Pair Programming");
            console.log("\nAdd more tools from the 'tools' list");
            break;

          case "status":
            console.log("\nChop Shop Marketplace Status:");
            console.log("  Logged in: ✅ Yes");
            console.log("  User type: developer");
            console.log("  Membership: active");
            console.log("  Developers: 4 available");
            console.log("  Projects: 3 listed");
            break;

          case "logout":
            console.log("✅ Logged out from Chop Shop marketplace");
            break;

          default:
            console.log(`Unknown subcommand: ${subcommand}`);
            console.log("Type 'chopshop' for available commands");
        }
      },
    });

    // Collaboration session commands
    this.registerCommand({
      name: "collab",
      description: "Collaboration session management",
      aliases: ["session", "pair"],
      usage: "collab <start|join|list|end> [session-id]",
      execute: async (args) => {
        if (args.length === 0) {
          console.log("\nCollaboration Commands:");
          console.log("  start [name]      — Start a new collaboration session");
          console.log("  join [session-id] — Join an existing session");
          console.log("  list              — List active sessions");
          console.log("  end               — End current session");
          console.log("  tools             — Show collaboration tools");
          console.log("");
          return;
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
          case "start":
            const sessionName = args[1] || "pair-session";
            const sessionId = "collab-" + Math.random().toString(36).slice(2, 10);
            console.log(`Starting collaboration session: ${sessionName}`);
            console.log(`Session ID: ${sessionId}`);
            console.log("Share this ID with collaborators");
            console.log("Tools available: Code Review, Pair Programming, Debug Helper");
            break;

          case "join":
            if (args.length < 2) {
              console.log("Usage: collab join [session-id]");
              return;
            }
            console.log(`Joining session: ${args[1]}`);
            console.log("✅ Connected to collaboration session");
            console.log("Available tools loaded");
            break;

          case "list":
            console.log("\nActive Collaboration Sessions:");
            console.log("  collab-abc123 - Pair Programming (2 participants)");
            console.log("  collab-def456 - Code Review (1 participant)");
            console.log("  collab-ghi789 - Debug Session (3 participants)");
            break;

          case "end":
            console.log("Ending current collaboration session...");
            console.log("✅ Session ended");
            break;

          case "tools":
            console.log("\nCollaboration Tools:");
            console.log("  Code Review Assistant");
            console.log("    - AI-powered suggestions");
            console.log("    - Real-time commenting");
            console.log("    - Code quality metrics");
            console.log("");
            console.log("  Pair Programming");
            console.log("    - Shared cursor position");
            console.log("    - Live code editing");
            console.log("    - Voice chat integration");
            console.log("");
            console.log("  Debug Helper");
            console.log("    - Shared breakpoints");
            console.log("    - Step-through debugging");
            console.log("    - Variable inspection");
            break;

          default:
            console.log(`Unknown action: ${action}`);
        }
      },
    });

    // Dev toolbox commands
    this.registerCommand({
      name: "tool",
      description: "Developer tool operations",
      aliases: ["devtool"],
      usage: "tool <list|use|assign> [tool-name]",
      execute: async (args) => {
        if (args.length === 0) {
          console.log("\nDeveloper Tool Commands:");
          console.log("  list              — List available tools");
          console.log("  use [tool-name]   — Use a specific tool");
          console.log("  assign [tool-id]  — Assign tool to your toolbox");
          console.log("");
          return;
        }

        const action = args[0].toLowerCase();
        
        switch (action) {
          case "list":
            console.log("\nAvailable Developer Tools:");
            console.log("  🔍  code-review   — AI-powered code review");
            console.log("  👥  pair-prog     — Real-time pair programming");
            console.log("  🐛  debug         — Interactive debugging");
            console.log("  🌐  api-test      — REST API testing");
            console.log("  ⚡  perf-analyze  — Performance analysis");
            console.log("  🔒  security-scan — Security scanning");
            console.log("  📚  docs-gen      — Documentation generation");
            console.log("  🚀  deploy        — One-click deployment");
            break;

          case "use":
            if (args.length < 2) {
              console.log("Usage: tool use [tool-name]");
              return;
            }
            const toolName = args[1];
            console.log(`Using tool: ${toolName}`);
            
            // Simulate tool execution
            switch (toolName) {
              case "code-review":
                console.log("Analyzing current file...");
                console.log("✅ Found 3 suggestions:");
                console.log("  1. Extract repeated logic into function");
                console.log("  2. Add error handling for API calls");
                console.log("  3. Improve variable naming");
                break;
              case "debug":
                console.log("Starting debug session...");
                console.log("Breakpoints set at lines: 42, 87, 123");
                console.log("Step-through debugging active");
                break;
              case "api-test":
                console.log("API Testing Tool:");
                console.log("Testing endpoint: /api/chopshop/projects");
                console.log("✅ Status: 200 OK");
                console.log("Response: 3 projects found");
                break;
              default:
                console.log(`Tool ${toolName} executed`);
            }
            break;

          case "assign":
            if (args.length < 2) {
              console.log("Usage: tool assign [tool-id]");
              return;
            }
            console.log(`Assigning tool ${args[1]} to your toolbox...`);
            console.log("✅ Tool added to your toolbox!");
            console.log("Access it from Chop Shop profile or use 'tool use'");
            break;

          default:
            console.log(`Unknown action: ${action}`);
        }
      },
    });
  }

  /**
   * Start the CLI.
   */
  async start(): Promise<void> {
    console.log(this.config.welcome ?? DEFAULT_WELCOME);

    // Try to load config from file
    const configPath = join(process.cwd(), ".megacode.json");
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        if (config.mcpServers) {
          for (const server of config.mcpServers) {
            this.ide.addMCPServer(server);
          }
        }
        console.log("Loaded configuration from .megacode.json");
      } catch {
        // Ignore config errors
      }
    }

    // Auto-connect if enabled
    if (this.config.autoConnect) {
      try {
        await this.ide.connect();
        console.log("Auto-connected to IDE");
      } catch (err) {
        console.log(`Auto-connect failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    this.running = true;
    this.runREPL();
  }

  /**
   * Run the REPL loop.
   */
  private runREPL(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${this.promptPrefix}> `,
      history: this.history,
    });

    this.rl.on("line", async (line) => {
      const input = line.trim();
      
      if (!input) {
        this.rl?.prompt();
        return;
      }

      this.history.push(input);
      
      // Parse command and args
      const parts = this.parseCommand(input);
      const [commandName, ...args] = parts;
      
      const command = this.commands.get(commandName);
      
      if (command) {
        try {
          await command.execute(args, {
            ide: this.ide,
            rl: this.rl!,
            history: this.history,
          });
        } catch (err) {
          console.log(`Error: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        console.log(`Unknown command: ${commandName}. Type 'help' for available commands.`);
      }
      
      this.rl?.prompt();
    });

    this.rl.on("close", () => {
      if (this.running) {
        console.log("\nUse 'exit' to quit");
        this.rl?.prompt();
      }
    });

    this.rl.on("history", (hist) => {
      this.history = hist;
    });

    this.rl.prompt();
  }

  /**
   * Parse command line into parts, respecting quotes.
   */
  private parseCommand(input: string): string[] {
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
      } else if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = "";
      } else if (!inQuotes && char === " ") {
        if (current) {
          parts.push(current);
          current = "";
        }
      } else {
        current += char;
      }
    }
    
    if (current) {
      parts.push(current);
    }
    
    return parts;
  }

  /**
   * Stop the CLI.
   */
  stop(): void {
    this.running = false;
    this.rl?.close();
    this.ide.disconnect();
  }
}

/**
 * Start the CLI from command line arguments.
 */
export async function runCLI(args: string[]): Promise<void> {
  const config: CLIConfig = {
    autoConnect: true,
  };

  // Parse args
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === "--config" && args[i + 1]) {
      // Config file path - will be loaded by CLI
      i++;
    } else if (arg === "--no-auto-connect") {
      config.autoConnect = false;
    } else if (arg === "--prompt" && args[i + 1]) {
      config.prompt = args[i + 1];
      i++;
    }
  }

  const cli = new MonacoCLI(config);
  
  process.on("SIGINT", () => {
    cli.stop();
    process.exit(0);
  });
  
  await cli.start();
}
