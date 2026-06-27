/**
 * Build Templates for Megacode (OverCoat).
 *
 * A library of pre-configured project templates that specify exactly which
 * MCP tool calls to make, in what order, with what arguments, to scaffold
 * and configure entire project archetypes in seconds.
 *
 * Each template is a Flow (from mcp-flow-coordinator) with pre-filled
 * arguments for a specific type of project. Templates cover:
 *
 * - SaaS applications (full-stack web apps)
 * - REST/GraphQL APIs
 * - Game projects (N64-style, modern 2D/3D)
 * - CLI tools
 * - Libraries/packages
 * - Microservice architectures
 * - AI/ML projects with vector databases
 * - Mobile apps
 * - Browser extensions
 * - Static sites / marketing pages
 *
 * The template engine also provides "combinators" — small reusable flow
 * fragments that can be composed into custom templates.
 */

import type { Flow, FlowStep, ToolCall } from "./mcp-flow-coordinator";

// ============================================================================
// Template Types
// ============================================================================

/** A project template. */
export interface BuildTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  /** The flow to execute when this template is applied. */
  flow: Flow;
  /** Human-readable explanation of what each step does. */
  stepsExplained: string[];
  /** Estimated time to apply (seconds). */
  estimatedSeconds: number;
  /** Which MCPs this template requires. */
  requiredMCPs: string[];
}

export type TemplateCategory =
  | "fullstack"
  | "api"
  | "game"
  | "cli"
  | "library"
  | "microservices"
  | "ai-ml"
  | "mobile"
  | "extension"
  | "static"
  | "devops";

/** Parameters that can be passed to customize a template. */
export interface TemplateParams {
  projectName: string;
  description?: string;
  framework?: string;
  database?: string;
  cache?: string;
  uiPreset?: string;
  iconStyle?: string;
  auth?: boolean;
  realtime?: boolean;
  gameType?: string;
  [key: string]: unknown;
}

// ============================================================================
// Helper: build tool calls concisely
// ============================================================================

function call(serverId: string, tool: string, args: Record<string, unknown> = {}): ToolCall {
  return { serverId, tool, args };
}

function step(
  id: string,
  label: string,
  callDef: ToolCall,
  dependsOn?: string[]
): FlowStep {
  return { id, label, type: "call", call: callDef, dependsOn };
}

function parallel(
  id: string,
  label: string,
  calls: ToolCall[],
  dependsOn?: string[]
): FlowStep {
  return { id, label, type: "parallel", parallel: calls, dependsOn };
}

// ============================================================================
// TEMPLATE: Full-Stack SaaS Application
// ============================================================================

function saasTemplate(p: TemplateParams): BuildTemplate {
  const fw = p.framework ?? "next";
  const db = p.database ?? "postgresql";
  const cache = p.cache ?? "redis";

  return {
    id: "saas-fullstack",
    name: "Full-Stack SaaS Application",
    description: `Complete SaaS application with ${fw} frontend, ${db} database, ${cache} cache, auth, and UI preset system`,
    category: "fullstack",
    tags: ["saas", "fullstack", "web", fw, db],
    estimatedSeconds: 12,
    requiredMCPs: ["bigback", "business-logic", "og-glass", "lucide-icons", "middle-man", "bobby-breakdown"],
    stepsExplained: [
      "1. Analyze project concept with Bobby Breakdown",
      "2. Generate infrastructure config (Docker Compose, env) with BigBack",
      "3. Set up business rules, entities, and decision tables with Business Logic",
      "4. Configure API gateway routing with Middle Man",
      "5. Apply UI preset theme and generate design tokens with OG Glass",
      "6. Search for matching icons for the navigation and features with Lucide",
    ],
    flow: {
      id: "saas-fullstack",
      name: "SaaS Full-Stack Build",
      description: `Scaffold ${p.projectName}`,
      variables: { projectName: p.projectName },
      steps: [
        // Phase 1: Concept analysis
        step("analyze", "Analyze project concept", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName}: ${p.description ?? "SaaS application"}`,
          domain: "full-stack",
          format: "implementation-guide",
        })),

        // Phase 2: Infrastructure (parallel)
        parallel("infra", "Set up infrastructure", [
          call("bigback", "generate_config", {
            framework: fw,
            database: db,
            cache: cache,
            features: ["auth", "api", "websockets", "queue"],
          }),
          call("bigback", "generate_docker_compose", {
            framework: fw,
            database: db,
            cache: cache,
          }),
          call("bigback", "generate_env_file", {
            framework: fw,
            database: db,
          }),
        ], ["analyze"]),

        // Phase 3: Business logic (depends on infra)
        parallel("business", "Configure business logic", [
          call("business-logic", "list_entities", {}),
          call("business-logic", "list_operations", {}),
          call("business-logic", "list_rulesets", {}),
        ], ["infra"]),

        // Phase 4: API gateway (depends on business)
        parallel("gateway", "Configure API gateway", [
          call("middle-man", "register_service", {
            name: p.projectName,
            url: "http://localhost:3000",
            healthCheck: "/api/health",
          }),
          call("middle-man", "list_code_templates", {}),
        ], ["business"]),

        // Phase 5: UI (parallel with gateway)
        parallel("ui", "Apply UI theme and icons", [
          call("og-glass", "list_presets", {}),
          call("og-glass", "generate_tokens", { theme: p.uiPreset ?? "modern-dark" }),
          call("og-glass", "suggest_style", {
            component: "dashboard",
            context: "saas-admin",
          }),
          call("lucide-icons", "search_icons", { query: "dashboard" }),
          call("lucide-icons", "search_icons", { query: "settings" }),
          call("lucide-icons", "search_icons", { query: "user" }),
        ], ["business"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: REST API Service
// ============================================================================

function apiTemplate(p: TemplateParams): BuildTemplate {
  const db = p.database ?? "postgresql";

  return {
    id: "rest-api",
    name: "REST API Service",
    description: `Production REST API with ${db}, validation, circuit breaker, rate limiting`,
    category: "api",
    tags: ["api", "rest", "backend", db],
    estimatedSeconds: 8,
    requiredMCPs: ["bigback", "business-logic", "middle-man", "bobby-breakdown"],
    stepsExplained: [
      "1. Break down the API domain into entities and operations",
      "2. Generate database + cache infrastructure",
      "3. Set up entity rules and state machines",
      "4. Register API services with circuit breaker",
      "5. Generate code scaffolding from templates",
    ],
    flow: {
      id: "rest-api",
      name: "REST API Build",
      description: `Scaffold ${p.projectName} API`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze API domain", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName} REST API: ${p.description ?? "API service"}`,
          domain: "full-stack",
          format: "architecture",
        })),

        step("infra", "Generate infrastructure", call("bigback", "generate_config", {
          framework: "express",
          database: db,
          cache: "redis",
          features: ["api", "queue", "monitoring"],
        }), ["analyze"]),

        parallel("business-setup", "Configure business rules", [
          call("business-logic", "list_entities", {}),
          call("business-logic", "list_operations", {}),
          call("business-logic", "list_decision_tables", {}),
        ], ["infra"]),

        parallel("api-setup", "Configure API layer", [
          call("middle-man", "register_service", {
            name: p.projectName,
            url: "http://localhost:4000",
            healthCheck: "/health",
          }),
          call("middle-man", "generate_code", {
            template: "express-crud",
            params: { name: p.projectName },
          }),
          call("middle-man", "get_circuit_breaker_state", { service: p.projectName }),
        ], ["business-setup"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: Game Project
// ============================================================================

function gameTemplate(p: TemplateParams): BuildTemplate {
  const gameType = p.gameType ?? "2d-platformer";

  return {
    id: "game-project",
    name: "Game Project",
    description: `${gameType} game with asset pipeline, UI overlays, controller support`,
    category: "game",
    tags: ["game", gameType, "controller", "ui"],
    estimatedSeconds: 10,
    requiredMCPs: ["bobby-breakdown", "og-glass", "lucide-icons", "monaco-bluetooth", "ruvector"],
    stepsExplained: [
      "1. Break down game design into implementable components",
      "2. Set up controller mappings for gamepad support",
      "3. Configure game UI overlay theme and HUD elements",
      "4. Search for game-related icons (health, inventory, menu)",
      "5. Initialize vector store for game asset search/similarity",
    ],
    flow: {
      id: "game-project",
      name: "Game Project Build",
      description: `Scaffold ${p.projectName} game`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze game design", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName}: ${gameType} game — ${p.description ?? "game project"}`,
          domain: "game-dev",
          format: "implementation-guide",
        })),

        parallel("setup", "Game systems setup", [
          call("monaco-bluetooth", "get_all_modes", {}),
          call("monaco-bluetooth", "get_button_map", { controller: "ps5" }),
          call("monaco-bluetooth", "get_device_profiles", {}),
        ], ["analyze"]),

        parallel("ui-assets", "Configure game UI and assets", [
          call("og-glass", "generate_tokens", { theme: "game-hud" }),
          call("og-glass", "generate_component", {
            component: "health-bar",
            variant: "game-overlay",
          }),
          call("lucide-icons", "search_icons", { query: "gamepad" }),
          call("lucide-icons", "search_icons", { query: "heart" }),
          call("lucide-icons", "search_icons", { query: "shield" }),
          call("lucide-icons", "search_icons", { query: "sword" }),
        ], ["analyze"]),

        step("vectors", "Initialize vector store", call("ruvector", "hooks_init", {
          config: { collection: `${p.projectName}-assets`, dimensions: 384 },
        }), ["setup"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: Microservice Architecture
// ============================================================================

function microservicesTemplate(p: TemplateParams): BuildTemplate {
  const db = p.database ?? "postgresql";

  return {
    id: "microservices",
    name: "Microservice Architecture",
    description: `Distributed microservice system with service discovery, circuit breaking, event bus`,
    category: "microservices",
    tags: ["microservices", "distributed", "docker", db],
    estimatedSeconds: 15,
    requiredMCPs: ["bigback", "business-logic", "middle-man", "bobby-breakdown", "ruvector"],
    stepsExplained: [
      "1. Architect the service boundaries and data flow",
      "2. Generate per-service infrastructure (separate DB, cache)",
      "3. Register services with discovery and health checks",
      "4. Set up inter-service workflow orchestration",
      "5. Configure circuit breakers and provenance tracking",
      "6. Initialize vector store for distributed log analysis",
    ],
    flow: {
      id: "microservices",
      name: "Microservices Build",
      description: `Scaffold ${p.projectName} microservices`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Architect service boundaries", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName} microservices: ${p.description ?? "distributed system"}`,
          domain: "full-stack",
          format: "architecture",
        })),

        parallel("infra", "Generate per-service infrastructure", [
          call("bigback", "generate_config", {
            framework: "express",
            database: db,
            cache: "redis",
            features: ["api", "queue", "monitoring"],
          }),
          call("bigback", "generate_docker_compose", {
            framework: "express",
            database: db,
            cache: "redis",
          }),
        ], ["analyze"]),

        parallel("services", "Register services", [
          call("middle-man", "register_service", {
            name: `${p.projectName}-api-gateway`,
            url: "http://localhost:3000",
            healthCheck: "/health",
          }),
          call("middle-man", "register_service", {
            name: `${p.projectName}-auth-service`,
            url: "http://localhost:3001",
            healthCheck: "/health",
          }),
          call("middle-man", "register_service", {
            name: `${p.projectName}-data-service`,
            url: "http://localhost:3002",
            healthCheck: "/health",
          }),
        ], ["infra"]),

        parallel("orchestration", "Configure orchestration", [
          call("middle-man", "create_workflow", {
            name: `${p.projectName}-main-flow`,
            steps: ["validate", "process", "store", "notify"],
          }),
          call("middle-man", "get_circuit_breaker_state", {
            service: `${p.projectName}-api-gateway`,
          }),
          call("middle-man", "record_provenance", {
            entity: p.projectName,
            action: "system-init",
            actor: "megacode",
          }),
        ], ["services"]),

        parallel("business", "Set up cross-service business rules", [
          call("business-logic", "list_rulesets", {}),
          call("business-logic", "list_semantic_mappings", {}),
        ], ["services"]),

        step("vectors", "Initialize distributed log search", call("ruvector", "hooks_init", {
          config: { collection: `${p.projectName}-logs`, dimensions: 768 },
        }), ["orchestration"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: AI/ML Project
// ============================================================================

function aiMlTemplate(p: TemplateParams): BuildTemplate {
  return {
    id: "ai-ml-project",
    name: "AI/ML Project",
    description: `AI/ML project with vector database, embeddings pipeline, and training workflows`,
    category: "ai-ml",
    tags: ["ai", "ml", "vectors", "embeddings", "rag"],
    estimatedSeconds: 12,
    requiredMCPs: ["ruvector", "bobby-breakdown", "bigback", "business-logic", "middle-man"],
    stepsExplained: [
      "1. Analyze the AI/ML problem domain",
      "2. Initialize vector collections for embeddings",
      "3. Set up data pipeline infrastructure",
      "4. Configure learning and training hooks",
      "5. Set up evaluation workflows",
      "6. Register ML services for orchestration",
    ],
    flow: {
      id: "ai-ml-project",
      name: "AI/ML Project Build",
      description: `Scaffold ${p.projectName} AI/ML project`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze ML problem domain", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName}: ${p.description ?? "AI/ML system"}`,
          domain: "artificial-intelligence",
          format: "implementation-guide",
        })),

        parallel("vector-setup", "Initialize vector infrastructure", [
          call("ruvector", "hooks_init", {
            config: { collection: `${p.projectName}-embeddings`, dimensions: 768 },
          }),
          call("ruvector", "hooks_capabilities", {}),
          call("ruvector", "hooks_algorithms_list", {}),
        ], ["analyze"]),

        parallel("data-pipeline", "Configure data pipeline", [
          call("bigback", "generate_config", {
            framework: "fastapi",
            database: "postgresql",
            cache: "redis",
            features: ["api", "queue", "monitoring"],
          }),
          call("bigback", "generate_docker_compose", {
            framework: "fastapi",
            database: "postgresql",
            cache: "redis",
          }),
        ], ["analyze"]),

        parallel("ml-config", "Configure ML training", [
          call("ruvector", "hooks_learning_config", {}),
          call("ruvector", "hooks_learning_stats", {}),
          call("ruvector", "workers_presets", {}),
        ], ["vector-setup"]),

        step("orchestration", "Set up ML pipeline orchestration", call("middle-man", "create_workflow", {
          name: `${p.projectName}-training-pipeline`,
          steps: ["ingest", "preprocess", "embed", "train", "evaluate", "deploy"],
        }), ["data-pipeline", "ml-config"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: CLI Tool
// ============================================================================

function cliTemplate(p: TemplateParams): BuildTemplate {
  return {
    id: "cli-tool",
    name: "CLI Tool",
    description: `Command-line tool with argument parsing, subcommands, and auto-generated help`,
    category: "cli",
    tags: ["cli", "tool", "terminal"],
    estimatedSeconds: 5,
    requiredMCPs: ["bobby-breakdown", "business-logic", "middle-man"],
    stepsExplained: [
      "1. Break down CLI requirements into commands and subcommands",
      "2. Generate code scaffolding for the CLI entry point",
      "3. Set up command validation and business rules",
    ],
    flow: {
      id: "cli-tool",
      name: "CLI Tool Build",
      description: `Scaffold ${p.projectName} CLI`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze CLI requirements", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName} CLI tool: ${p.description ?? "command-line tool"}`,
          domain: "full-stack",
          format: "implementation-guide",
        })),

        parallel("scaffold", "Generate CLI scaffold", [
          call("middle-man", "list_code_templates", {}),
          call("middle-man", "generate_code", {
            template: "cli-tool",
            params: { name: p.projectName },
          }),
        ], ["analyze"]),

        step("rules", "Set up command validation", call("business-logic", "list_rulesets", {}), ["scaffold"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: Library / NPM Package
// ============================================================================

function libraryTemplate(p: TemplateParams): BuildTemplate {
  return {
    id: "library-package",
    name: "Library / NPM Package",
    description: `Publishable library with TypeScript, tests, docs, and CI/CD`,
    category: "library",
    tags: ["library", "npm", "package", "typescript"],
    estimatedSeconds: 5,
    requiredMCPs: ["bobby-breakdown", "business-logic", "file-converter"],
    stepsExplained: [
      "1. Analyze library requirements and public API surface",
      "2. Set up entity definitions and validation rules",
      "3. Configure file conversion for multi-format output (ESM/CJS/UMD)",
    ],
    flow: {
      id: "library-package",
      name: "Library Build",
      description: `Scaffold ${p.projectName} library`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze library design", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName}: ${p.description ?? "reusable library"}`,
          domain: "full-stack",
          format: "architecture",
        })),

        parallel("setup", "Configure library structure", [
          call("business-logic", "list_entities", {}),
          call("business-logic", "list_operations", {}),
        ], ["analyze"]),

        step("formats", "Check supported output formats", call("file-converter", "get_supported_formats", {}), ["setup"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: Static Site / Marketing Page
// ============================================================================

function staticSiteTemplate(p: TemplateParams): BuildTemplate {
  return {
    id: "static-site",
    name: "Static Site / Marketing Page",
    description: `Beautiful static site with design tokens, icon system, and component library`,
    category: "static",
    tags: ["static", "marketing", "landing", "design"],
    estimatedSeconds: 6,
    requiredMCPs: ["og-glass", "lucide-icons", "bobby-breakdown"],
    stepsExplained: [
      "1. Analyze site purpose and content strategy",
      "2. Generate full design token system (colors, spacing, typography)",
      "3. Generate component library with theme presets",
      "4. Search for icons matching site sections",
      "5. Generate color palette and style suggestions",
    ],
    flow: {
      id: "static-site",
      name: "Static Site Build",
      description: `Scaffold ${p.projectName} site`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze site requirements", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName} website: ${p.description ?? "marketing site"}`,
          domain: "full-stack",
          format: "implementation-guide",
        })),

        parallel("design", "Generate design system", [
          call("og-glass", "list_presets", {}),
          call("og-glass", "generate_tokens", { theme: p.uiPreset ?? "modern-light" }),
          call("og-glass", "generate_color_palette", {
            baseColor: "#6366f1",
            mode: "complementary",
          }),
          call("og-glass", "suggest_style", {
            component: "hero",
            context: "marketing-landing",
          }),
        ], ["analyze"]),

        parallel("icons", "Source icons for all sections", [
          call("lucide-icons", "search_icons", { query: "rocket" }),
          call("lucide-icons", "search_icons", { query: "zap" }),
          call("lucide-icons", "search_icons", { query: "check" }),
          call("lucide-icons", "search_icons", { query: "star" }),
          call("lucide-icons", "search_icons", { query: "arrow-right" }),
          call("lucide-icons", "list_categories", {}),
        ], ["analyze"]),

        parallel("components", "Generate key components", [
          call("og-glass", "generate_component", {
            component: "hero-section",
            variant: "marketing",
          }),
          call("og-glass", "generate_component", {
            component: "pricing-card",
            variant: "comparison",
          }),
          call("og-glass", "generate_component", {
            component: "feature-grid",
            variant: "icon-list",
          }),
        ], ["design"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: Browser Extension
// ============================================================================

function extensionTemplate(p: TemplateParams): BuildTemplate {
  return {
    id: "browser-extension",
    name: "Browser Extension",
    description: `Browser extension with popup UI, background service, content scripts`,
    category: "extension",
    tags: ["extension", "browser", "chrome", "firefox"],
    estimatedSeconds: 8,
    requiredMCPs: ["bobby-breakdown", "og-glass", "lucide-icons", "business-logic"],
    stepsExplained: [
      "1. Analyze extension architecture and permissions needed",
      "2. Generate compact UI theme for popup/sidebar",
      "3. Source icons for extension actions",
      "4. Set up business rules for data handling",
    ],
    flow: {
      id: "browser-extension",
      name: "Browser Extension Build",
      description: `Scaffold ${p.projectName} extension`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze extension architecture", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName} browser extension: ${p.description ?? "browser extension"}`,
          domain: "full-stack",
          format: "implementation-guide",
        })),

        parallel("ui", "Generate extension UI", [
          call("og-glass", "generate_tokens", { theme: "compact-dark" }),
          call("og-glass", "generate_component", {
            component: "popup-layout",
            variant: "extension",
          }),
          call("lucide-icons", "search_icons", { query: "puzzle" }),
          call("lucide-icons", "search_icons", { query: "settings" }),
          call("lucide-icons", "get_icon_react", { name: "power" }),
        ], ["analyze"]),

        step("rules", "Configure data handling rules", call("business-logic", "list_rulesets", {}), ["analyze"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: DevOps Pipeline
// ============================================================================

function devopsTemplate(p: TemplateParams): BuildTemplate {
  return {
    id: "devops-pipeline",
    name: "DevOps / CI-CD Pipeline",
    description: `Complete CI/CD pipeline with Docker, monitoring, service health, and workflow automation`,
    category: "devops",
    tags: ["devops", "ci-cd", "docker", "monitoring"],
    estimatedSeconds: 10,
    requiredMCPs: ["bigback", "middle-man", "bobby-breakdown", "ruvector"],
    stepsExplained: [
      "1. Analyze deployment requirements",
      "2. Generate Docker infrastructure for all environments",
      "3. Set up service discovery and health monitoring",
      "4. Configure CI/CD workflows",
      "5. Initialize log search with vector embeddings",
    ],
    flow: {
      id: "devops-pipeline",
      name: "DevOps Pipeline Build",
      description: `Scaffold ${p.projectName} DevOps`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze deployment requirements", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName} DevOps: ${p.description ?? "deployment pipeline"}`,
          domain: "full-stack",
          format: "architecture",
        })),

        parallel("infra", "Generate all infrastructure configs", [
          call("bigback", "list_infrastructure", {}),
          call("bigback", "list_presets", {}),
          call("bigback", "generate_docker_compose", {
            framework: p.framework ?? "node",
            database: p.database ?? "postgresql",
            cache: "redis",
          }),
          call("bigback", "generate_env_file", {
            framework: p.framework ?? "node",
            database: p.database ?? "postgresql",
          }),
        ], ["analyze"]),

        parallel("monitoring", "Configure monitoring and discovery", [
          call("middle-man", "register_service", {
            name: `${p.projectName}-prod`,
            url: "http://prod:3000",
            healthCheck: "/health",
          }),
          call("middle-man", "register_service", {
            name: `${p.projectName}-staging`,
            url: "http://staging:3000",
            healthCheck: "/health",
          }),
          call("middle-man", "create_workflow", {
            name: `${p.projectName}-deploy`,
            steps: ["build", "test", "stage", "approve", "deploy", "verify"],
          }),
        ], ["infra"]),

        step("log-search", "Initialize log vector search", call("ruvector", "hooks_init", {
          config: { collection: `${p.projectName}-ops-logs`, dimensions: 768 },
        }), ["monitoring"]),
      ],
    },
  };
}

// ============================================================================
// TEMPLATE: Mobile App (React Native)
// ============================================================================

function mobileTemplate(p: TemplateParams): BuildTemplate {
  return {
    id: "mobile-app",
    name: "Mobile Application",
    description: `Cross-platform mobile app with native UI, API integration, and controller support`,
    category: "mobile",
    tags: ["mobile", "react-native", "ios", "android"],
    estimatedSeconds: 10,
    requiredMCPs: ["bobby-breakdown", "bigback", "og-glass", "lucide-icons", "monaco-bluetooth", "middle-man"],
    stepsExplained: [
      "1. Analyze mobile app architecture",
      "2. Generate backend infrastructure for the mobile API",
      "3. Generate mobile-optimized design tokens",
      "4. Source icons in mobile-friendly sizes",
      "5. Configure controller/gamepad for accessibility",
      "6. Register API endpoints",
    ],
    flow: {
      id: "mobile-app",
      name: "Mobile App Build",
      description: `Scaffold ${p.projectName} mobile app`,
      variables: { projectName: p.projectName },
      steps: [
        step("analyze", "Analyze mobile architecture", call("bobby-breakdown", "breakdown", {
          topic: `${p.projectName} mobile app: ${p.description ?? "cross-platform mobile application"}`,
          domain: "full-stack",
          format: "implementation-guide",
        })),

        parallel("backend", "Set up mobile backend", [
          call("bigback", "generate_config", {
            framework: "express",
            database: p.database ?? "postgresql",
            cache: "redis",
            features: ["api", "auth", "push-notifications"],
          }),
          call("middle-man", "register_service", {
            name: `${p.projectName}-mobile-api`,
            url: "http://localhost:4000",
            healthCheck: "/health",
          }),
        ], ["analyze"]),

        parallel("ui", "Generate mobile design system", [
          call("og-glass", "generate_tokens", { theme: "mobile-native" }),
          call("og-glass", "suggest_style", {
            component: "bottom-navigation",
            context: "mobile-app",
          }),
          call("lucide-icons", "search_icons", { query: "home" }),
          call("lucide-icons", "search_icons", { query: "search" }),
          call("lucide-icons", "search_icons", { query: "bell" }),
          call("lucide-icons", "search_icons", { query: "user" }),
        ], ["analyze"]),

        step("controller", "Configure accessibility controller", call("monaco-bluetooth", "get_all_modes", {}), ["ui"]),
      ],
    },
  };
}

// ============================================================================
// Template Registry
// ============================================================================

/** All available template generators. */
const TEMPLATE_GENERATORS: Record<string, (p: TemplateParams) => BuildTemplate> = {
  "saas-fullstack": saasTemplate,
  "rest-api": apiTemplate,
  "game-project": gameTemplate,
  "microservices": microservicesTemplate,
  "ai-ml-project": aiMlTemplate,
  "cli-tool": cliTemplate,
  "library-package": libraryTemplate,
  "static-site": staticSiteTemplate,
  "browser-extension": extensionTemplate,
  "devops-pipeline": devopsTemplate,
  "mobile-app": mobileTemplate,
};

/**
 * Get a build template by ID, customized with the given params.
 */
export function getTemplate(templateId: string, params: TemplateParams): BuildTemplate | null {
  const generator = TEMPLATE_GENERATORS[templateId];
  if (!generator) return null;
  return generator(params);
}

/**
 * List all available templates (without customization).
 */
export function listTemplates(): Array<{
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  requiredMCPs: string[];
}> {
  const dummyParams: TemplateParams = { projectName: "example" };
  return Object.entries(TEMPLATE_GENERATORS).map(([id, gen]) => {
    const t = gen(dummyParams);
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      tags: t.tags,
      requiredMCPs: t.requiredMCPs,
    };
  });
}

/**
 * Search templates by query, category, or required MCP.
 */
export function searchTemplates(opts: {
  query?: string;
  category?: TemplateCategory;
  requiredMCP?: string;
}): Array<{ id: string; name: string; description: string; category: TemplateCategory }> {
  let templates = listTemplates();

  if (opts.query) {
    const q = opts.query.toLowerCase();
    templates = templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q))
    );
  }

  if (opts.category) {
    templates = templates.filter((t) => t.category === opts.category);
  }

  if (opts.requiredMCP) {
    templates = templates.filter((t) =>
      t.requiredMCPs.includes(opts.requiredMCP!)
    );
  }

  return templates;
}
