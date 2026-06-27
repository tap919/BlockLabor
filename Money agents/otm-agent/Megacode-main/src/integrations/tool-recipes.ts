/**
 * Tool Recipes for Megacode (OverCoat).
 *
 * Recipes are pre-built tool-call combinations that handle common
 * development patterns. While templates scaffold entire projects,
 * recipes handle specific tasks within an existing project:
 *
 * - "I need a new API endpoint" → recipe chains: business rules → code gen → gateway registration
 * - "I need a new UI component" → recipe chains: style suggest → icons → component gen → tokens
 * - "Analyze this codebase" → recipe chains: breakdown → entity scan → architecture review
 *
 * Recipes are lightweight, fast (2-5 tool calls), and composable.
 * They're designed to be called hundreds of times during a project.
 */

import type { ToolCall, FlowStep } from "./mcp-flow-coordinator";

// ============================================================================
// Types
// ============================================================================

/** A recipe definition. */
export interface Recipe {
  id: string;
  name: string;
  description: string;
  category: RecipeCategory;
  /** Tool calls to execute (in order). */
  calls: ToolCall[];
  /** Which MCP servers are required. */
  requiredMCPs: string[];
  /** Human-readable explanation. */
  explanation: string;
}

export type RecipeCategory =
  | "scaffold"     // Create new things
  | "analyze"      // Understand existing things
  | "refactor"     // Improve existing things
  | "ui"           // UI/design work
  | "data"         // Data layer operations
  | "deploy"       // Deployment and ops
  | "convert"      // File format conversions
  | "search"       // Finding things across MCPs
  | "test"         // Testing and validation
  | "ai"           // AI/ML-specific operations
  | "controller"   // Controller/accessibility
  | "workflow";    // Multi-step process automation

// ============================================================================
// Helper
// ============================================================================

function c(serverId: string, tool: string, args: Record<string, unknown> = {}): ToolCall {
  return { serverId, tool, args };
}

// ============================================================================
// RECIPE CATALOG — Organized by Category
// ============================================================================

// --- SCAFFOLD recipes ---

const newApiEndpoint: Recipe = {
  id: "new-api-endpoint",
  name: "New API Endpoint",
  description: "Scaffold a new API endpoint with business rules, code generation, and gateway registration",
  category: "scaffold",
  requiredMCPs: ["business-logic", "middle-man"],
  explanation: "Gets entity rules → generates CRUD code → registers with service discovery",
  calls: [
    c("business-logic", "list_entities", {}),
    c("business-logic", "list_operations", {}),
    c("middle-man", "list_code_templates", {}),
    c("middle-man", "generate_code", { template: "express-crud", params: {} }),
  ],
};

const newUiComponent: Recipe = {
  id: "new-ui-component",
  name: "New UI Component",
  description: "Create a new UI component with style suggestions, icons, and design tokens",
  category: "scaffold",
  requiredMCPs: ["og-glass", "lucide-icons"],
  explanation: "Gets style suggestion → finds matching icons → generates component → applies tokens",
  calls: [
    c("og-glass", "suggest_style", { component: "card", context: "dashboard" }),
    c("lucide-icons", "search_icons", { query: "component" }),
    c("og-glass", "generate_component", { component: "card", variant: "default" }),
    c("og-glass", "generate_tokens", { theme: "current" }),
  ],
};

const newService: Recipe = {
  id: "new-microservice",
  name: "New Microservice",
  description: "Register a new microservice with discovery, health check, and circuit breaker",
  category: "scaffold",
  requiredMCPs: ["middle-man", "bigback"],
  explanation: "Generates infra config → registers service → sets up circuit breaker → creates workflow",
  calls: [
    c("bigback", "generate_config", { framework: "express", database: "postgresql", cache: "redis", features: ["api"] }),
    c("bigback", "generate_docker_compose", { framework: "express", database: "postgresql", cache: "redis" }),
    c("middle-man", "register_service", { name: "new-service", url: "http://localhost:3000", healthCheck: "/health" }),
    c("middle-man", "get_circuit_breaker_state", { service: "new-service" }),
  ],
};

const newDatabaseSchema: Recipe = {
  id: "new-database-schema",
  name: "New Database Schema",
  description: "Design a database schema with entity rules, state machines, and validation",
  category: "scaffold",
  requiredMCPs: ["business-logic", "bigback"],
  explanation: "Lists entities → gets field context → generates infra → sets up state transitions",
  calls: [
    c("business-logic", "list_entities", {}),
    c("business-logic", "get_field_context", { entity: "new-entity", field: "status" }),
    c("business-logic", "get_state_transitions", { entity: "new-entity" }),
    c("bigback", "generate_config", { framework: "express", database: "postgresql", cache: "redis", features: ["api"] }),
  ],
};

// --- ANALYZE recipes ---

const analyzeCodebase: Recipe = {
  id: "analyze-codebase",
  name: "Analyze Codebase",
  description: "Deep analysis of a codebase: concept breakdown, entity discovery, architecture review",
  category: "analyze",
  requiredMCPs: ["bobby-breakdown", "business-logic"],
  explanation: "Breaks down concepts → scans entities → reviews rules → checks cross-system effects",
  calls: [
    c("bobby-breakdown", "breakdown", { topic: "codebase analysis", domain: "full-stack", format: "architecture" }),
    c("business-logic", "list_entities", {}),
    c("business-logic", "list_rulesets", {}),
    c("business-logic", "list_semantic_mappings", {}),
  ],
};

const analyzeDomain: Recipe = {
  id: "analyze-domain",
  name: "Analyze Domain",
  description: "Deep-dive into a specific domain: business rules, footguns, cross-system effects",
  category: "analyze",
  requiredMCPs: ["bobby-breakdown", "business-logic"],
  explanation: "Breaks down domain → identifies footguns → checks cross-system effects → reviews decision tables",
  calls: [
    c("bobby-breakdown", "breakdown", { topic: "domain analysis", domain: "full-stack", format: "implementation-guide" }),
    c("business-logic", "get_footguns", { entity: "target" }),
    c("business-logic", "get_cross_system_effects", { entity: "target", operation: "update" }),
    c("business-logic", "list_decision_tables", {}),
  ],
};

const compareApproaches: Recipe = {
  id: "compare-approaches",
  name: "Compare Approaches",
  description: "Compare two technical approaches side-by-side with Bobby Breakdown",
  category: "analyze",
  requiredMCPs: ["bobby-breakdown"],
  explanation: "Runs comparison analysis → scans both approaches → generates follow-up questions",
  calls: [
    c("bobby-breakdown", "compare", { topicA: "approach A", topicB: "approach B", domain: "full-stack" }),
    c("bobby-breakdown", "fastscan", { topic: "approach A", domain: "full-stack" }),
    c("bobby-breakdown", "fastscan", { topic: "approach B", domain: "full-stack" }),
  ],
};

const quickScan: Recipe = {
  id: "quick-scan",
  name: "Quick Scan",
  description: "Fast 30-second scan of a topic to get the key points",
  category: "analyze",
  requiredMCPs: ["bobby-breakdown"],
  explanation: "Runs fastscan → lists available domains → suggests follow-up",
  calls: [
    c("bobby-breakdown", "fastscan", { topic: "target topic", domain: "full-stack" }),
    c("bobby-breakdown", "list_domains", {}),
  ],
};

// --- UI recipes ---

const designSystem: Recipe = {
  id: "design-system",
  name: "Design System Setup",
  description: "Generate a complete design system: tokens, palette, presets, style guides",
  category: "ui",
  requiredMCPs: ["og-glass"],
  explanation: "Lists presets → generates tokens → creates palette → suggests styles",
  calls: [
    c("og-glass", "list_presets", {}),
    c("og-glass", "generate_tokens", { theme: "modern-dark" }),
    c("og-glass", "generate_color_palette", { baseColor: "#6366f1", mode: "complementary" }),
    c("og-glass", "list_style_categories", {}),
  ],
};

const themeSwap: Recipe = {
  id: "theme-swap",
  name: "Theme Swap",
  description: "Switch between UI themes: load preset, regenerate tokens, diff changes",
  category: "ui",
  requiredMCPs: ["og-glass"],
  explanation: "Loads new preset → generates new tokens → diffs against current → validates UI",
  calls: [
    c("og-glass", "list_presets", {}),
    c("og-glass", "load_preset", { preset: "cyberpunk" }),
    c("og-glass", "generate_tokens", { theme: "cyberpunk" }),
    c("og-glass", "validate_ui", { component: "app-root" }),
  ],
};

const iconHunt: Recipe = {
  id: "icon-hunt",
  name: "Icon Hunt",
  description: "Find icons across categories with React code generation",
  category: "ui",
  requiredMCPs: ["lucide-icons"],
  explanation: "Lists categories → searches by keyword → gets React component code",
  calls: [
    c("lucide-icons", "list_categories", {}),
    c("lucide-icons", "search_icons", { query: "target" }),
    c("lucide-icons", "get_icon_react", { name: "target-icon" }),
  ],
};

const uiComponentSuite: Recipe = {
  id: "ui-component-suite",
  name: "UI Component Suite",
  description: "Generate a suite of related UI components with consistent styling",
  category: "ui",
  requiredMCPs: ["og-glass", "lucide-icons"],
  explanation: "Generates tokens → creates multiple components → sources icons → validates consistency",
  calls: [
    c("og-glass", "generate_tokens", { theme: "current" }),
    c("og-glass", "generate_component", { component: "header", variant: "app-shell" }),
    c("og-glass", "generate_component", { component: "sidebar", variant: "navigation" }),
    c("og-glass", "generate_component", { component: "card", variant: "data-display" }),
    c("lucide-icons", "search_icons", { query: "menu" }),
    c("lucide-icons", "search_icons", { query: "home" }),
  ],
};

// --- DATA recipes ---

const vectorSetup: Recipe = {
  id: "vector-setup",
  name: "Vector Database Setup",
  description: "Initialize vector collections, configure learning, and check capabilities",
  category: "data",
  requiredMCPs: ["ruvector"],
  explanation: "Initializes hooks → checks capabilities → lists algorithms → configures learning",
  calls: [
    c("ruvector", "hooks_init", { config: { collection: "default", dimensions: 768 } }),
    c("ruvector", "hooks_capabilities", {}),
    c("ruvector", "hooks_algorithms_list", {}),
    c("ruvector", "hooks_learning_config", {}),
  ],
};

const semanticSearch: Recipe = {
  id: "semantic-search",
  name: "Semantic Search Pipeline",
  description: "Set up a semantic search pipeline with embeddings and vector storage",
  category: "data",
  requiredMCPs: ["ruvector"],
  explanation: "Initializes → routes query → recalls results → checks stats",
  calls: [
    c("ruvector", "hooks_init", { config: { collection: "search", dimensions: 768 } }),
    c("ruvector", "hooks_route", { query: "test query", context: {} }),
    c("ruvector", "hooks_stats", {}),
    c("ruvector", "brain_search", { query: "test", limit: 10 }),
  ],
};

const dataIngestion: Recipe = {
  id: "data-ingestion",
  name: "Data Ingestion Pipeline",
  description: "Configure a data ingestion pipeline with RVF format and worker dispatch",
  category: "data",
  requiredMCPs: ["ruvector"],
  explanation: "Creates RVF store → lists examples → dispatches workers → checks status",
  calls: [
    c("ruvector", "rvf_create", { name: "ingestion-store", config: {} }),
    c("ruvector", "rvf_examples", {}),
    c("ruvector", "workers_presets", {}),
    c("ruvector", "workers_stats", {}),
  ],
};

const businessRulesAudit: Recipe = {
  id: "business-rules-audit",
  name: "Business Rules Audit",
  description: "Audit all business rules, check execution logs, and review monitoring stats",
  category: "data",
  requiredMCPs: ["business-logic"],
  explanation: "Lists rulesets → checks execution log → gets monitoring stats → reviews audit trail",
  calls: [
    c("business-logic", "list_rulesets", {}),
    c("business-logic", "get_execution_log", {}),
    c("business-logic", "get_monitoring_stats", {}),
    c("business-logic", "get_audit_trail", { entity: "system" }),
  ],
};

// --- DEPLOY recipes ---

const dockerSetup: Recipe = {
  id: "docker-setup",
  name: "Docker Environment Setup",
  description: "Generate Docker Compose, env files, and infrastructure configs for any stack",
  category: "deploy",
  requiredMCPs: ["bigback"],
  explanation: "Lists frameworks → lists databases → generates config → generates compose → generates env",
  calls: [
    c("bigback", "list_frameworks", {}),
    c("bigback", "list_databases", {}),
    c("bigback", "list_caches", {}),
    c("bigback", "list_infrastructure", {}),
    c("bigback", "list_presets", {}),
  ],
};

const fullInfraGen: Recipe = {
  id: "full-infra-gen",
  name: "Full Infrastructure Generation",
  description: "Generate complete infrastructure: Docker, env, monitoring, service registration",
  category: "deploy",
  requiredMCPs: ["bigback", "middle-man"],
  explanation: "Generates all config → creates compose file → env file → registers services → creates workflow",
  calls: [
    c("bigback", "generate_config", { framework: "next", database: "postgresql", cache: "redis", features: ["auth", "api"] }),
    c("bigback", "generate_docker_compose", { framework: "next", database: "postgresql", cache: "redis" }),
    c("bigback", "generate_env_file", { framework: "next", database: "postgresql" }),
    c("middle-man", "register_service", { name: "app", url: "http://localhost:3000", healthCheck: "/health" }),
    c("middle-man", "create_workflow", { name: "deploy", steps: ["build", "test", "deploy"] }),
  ],
};

// --- CONVERT recipes ---

const batchMediaConvert: Recipe = {
  id: "batch-media-convert",
  name: "Batch Media Conversion",
  description: "Convert multiple media files between formats with UFC",
  category: "convert",
  requiredMCPs: ["file-converter"],
  explanation: "Gets supported formats → runs batch conversion → checks history",
  calls: [
    c("file-converter", "get_supported_formats", {}),
    c("file-converter", "batch_convert", { files: [], targetFormat: "webp" }),
    c("file-converter", "get_conversion_history", {}),
  ],
};

const assetPipeline: Recipe = {
  id: "asset-pipeline",
  name: "Asset Pipeline",
  description: "Process images, audio, and video for a project with optimized formats",
  category: "convert",
  requiredMCPs: ["file-converter"],
  explanation: "Converts images to webp → audio to opus → video to webm → checks history",
  calls: [
    c("file-converter", "convert_image", { input: "source.png", output: "output.webp", format: "webp" }),
    c("file-converter", "convert_audio", { input: "source.wav", output: "output.opus", format: "opus" }),
    c("file-converter", "convert_video", { input: "source.mp4", output: "output.webm", format: "webm" }),
    c("file-converter", "get_conversion_history", {}),
  ],
};

// --- SEARCH recipes ---

const crossMcpSearch: Recipe = {
  id: "cross-mcp-search",
  name: "Cross-MCP Search",
  description: "Search across multiple MCPs simultaneously: icons, presets, templates, entities",
  category: "search",
  requiredMCPs: ["lucide-icons", "og-glass", "business-logic", "middle-man"],
  explanation: "Searches icons → searches presets → searches entities → searches services",
  calls: [
    c("lucide-icons", "search_icons", { query: "target" }),
    c("og-glass", "list_presets", {}),
    c("business-logic", "list_entities", {}),
    c("middle-man", "list_services", {}),
  ],
};

// --- AI recipes ---

const ragSetup: Recipe = {
  id: "rag-setup",
  name: "RAG Pipeline Setup",
  description: "Set up a Retrieval-Augmented Generation pipeline with vector storage and routing",
  category: "ai",
  requiredMCPs: ["ruvector", "bobby-breakdown"],
  explanation: "Analyzes RAG architecture → initializes vector store → configures routing → sets up brain",
  calls: [
    c("bobby-breakdown", "breakdown", { topic: "RAG pipeline design", domain: "artificial-intelligence", format: "architecture" }),
    c("ruvector", "hooks_init", { config: { collection: "rag-docs", dimensions: 768 } }),
    c("ruvector", "hooks_rag_context", { query: "test", topK: 5 }),
    c("ruvector", "brain_status", {}),
  ],
};

const mlTrainingSetup: Recipe = {
  id: "ml-training-setup",
  name: "ML Training Setup",
  description: "Configure machine learning training with workers, phases, and evaluation",
  category: "ai",
  requiredMCPs: ["ruvector"],
  explanation: "Configures learning → lists presets → creates worker pipeline → checks stats",
  calls: [
    c("ruvector", "hooks_learning_config", {}),
    c("ruvector", "workers_presets", {}),
    c("ruvector", "workers_phases", {}),
    c("ruvector", "hooks_learning_stats", {}),
  ],
};

const knowledgeGraph: Recipe = {
  id: "knowledge-graph",
  name: "Knowledge Graph Setup",
  description: "Initialize a knowledge graph with brain nodes, pages, and graph operations",
  category: "ai",
  requiredMCPs: ["ruvector"],
  explanation: "Checks brain status → lists pages → lists nodes → sets up graph clustering",
  calls: [
    c("ruvector", "brain_status", {}),
    c("ruvector", "brain_page_list", {}),
    c("ruvector", "brain_node_list", {}),
    c("ruvector", "hooks_graph_cluster", { params: {} }),
  ],
};

// --- CONTROLLER recipes ---

const controllerSetup: Recipe = {
  id: "controller-setup",
  name: "Controller Setup",
  description: "Configure gamepad/controller mappings for Monaco editor and game modes",
  category: "controller",
  requiredMCPs: ["monaco-bluetooth"],
  explanation: "Gets device profiles → gets all modes → configures button map → sets up haptics",
  calls: [
    c("monaco-bluetooth", "get_device_profiles", {}),
    c("monaco-bluetooth", "get_all_modes", {}),
    c("monaco-bluetooth", "get_button_map", { controller: "ps5" }),
    c("monaco-bluetooth", "get_haptic_profiles", {}),
  ],
};

const accessibilityConfig: Recipe = {
  id: "accessibility-config",
  name: "Accessibility Configuration",
  description: "Set up accessibility features: controller actions, on-screen keyboard, custom mappings",
  category: "controller",
  requiredMCPs: ["monaco-bluetooth"],
  explanation: "Gets action map → configures OSK → customizes actions → sets analog config",
  calls: [
    c("monaco-bluetooth", "get_action_map", {}),
    c("monaco-bluetooth", "get_osk_layout", {}),
    c("monaco-bluetooth", "get_analog_config", {}),
    c("monaco-bluetooth", "search_action", { query: "navigate" }),
  ],
};

// --- WORKFLOW recipes ---

const ciCdPipeline: Recipe = {
  id: "ci-cd-pipeline",
  name: "CI/CD Pipeline",
  description: "Set up a complete CI/CD pipeline: build, test, deploy workflow with health checks",
  category: "workflow",
  requiredMCPs: ["middle-man", "bigback"],
  explanation: "Creates workflow → registers services → sets up circuit breaker → generates docker",
  calls: [
    c("middle-man", "create_workflow", { name: "ci-cd", steps: ["lint", "test", "build", "stage", "deploy"] }),
    c("middle-man", "register_service", { name: "app", url: "http://localhost:3000", healthCheck: "/health" }),
    c("middle-man", "get_circuit_breaker_state", { service: "app" }),
    c("bigback", "generate_docker_compose", { framework: "node", database: "postgresql", cache: "redis" }),
  ],
};

const fullStackAudit: Recipe = {
  id: "full-stack-audit",
  name: "Full-Stack Audit",
  description: "Complete audit: business rules, services, vectors, UI, security",
  category: "workflow",
  requiredMCPs: ["business-logic", "middle-man", "ruvector", "og-glass"],
  explanation: "Audits rules → checks services → reviews vectors → validates UI → checks security",
  calls: [
    c("business-logic", "get_monitoring_stats", {}),
    c("business-logic", "get_execution_log", {}),
    c("middle-man", "list_services", {}),
    c("middle-man", "list_workflows", {}),
    c("ruvector", "hooks_stats", {}),
    c("ruvector", "hooks_doctor", {}),
    c("og-glass", "get_session_state", {}),
  ],
};

const learningSession: Recipe = {
  id: "learning-session",
  name: "Learning Session",
  description: "Start a learning session on a topic: breakdown, compare, follow-up questions",
  category: "workflow",
  requiredMCPs: ["bobby-breakdown"],
  explanation: "Full breakdown → fastscan → list formats → generate follow-up questions",
  calls: [
    c("bobby-breakdown", "breakdown", { topic: "target topic", domain: "full-stack", format: "implementation-guide" }),
    c("bobby-breakdown", "fastscan", { topic: "target topic key concept", domain: "full-stack" }),
    c("bobby-breakdown", "list_formats", {}),
    c("bobby-breakdown", "list_dev_modes", {}),
    c("bobby-breakdown", "followup", { topic: "target topic", priorContext: "initial breakdown" }),
  ],
};

// ============================================================================
// Recipe Registry
// ============================================================================

/** All available recipes. */
const ALL_RECIPES: Recipe[] = [
  // Scaffold
  newApiEndpoint, newUiComponent, newService, newDatabaseSchema,
  // Analyze
  analyzeCodebase, analyzeDomain, compareApproaches, quickScan,
  // UI
  designSystem, themeSwap, iconHunt, uiComponentSuite,
  // Data
  vectorSetup, semanticSearch, dataIngestion, businessRulesAudit,
  // Deploy
  dockerSetup, fullInfraGen,
  // Convert
  batchMediaConvert, assetPipeline,
  // Search
  crossMcpSearch,
  // AI
  ragSetup, mlTrainingSetup, knowledgeGraph,
  // Controller
  controllerSetup, accessibilityConfig,
  // Workflow
  ciCdPipeline, fullStackAudit, learningSession,
];

/**
 * Get a recipe by ID.
 */
export function getRecipe(id: string): Recipe | null {
  return ALL_RECIPES.find((r) => r.id === id) ?? null;
}

/**
 * List all recipes.
 */
export function listRecipes(): Array<{
  id: string;
  name: string;
  description: string;
  category: RecipeCategory;
  callCount: number;
  requiredMCPs: string[];
}> {
  return ALL_RECIPES.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    callCount: r.calls.length,
    requiredMCPs: r.requiredMCPs,
  }));
}

/**
 * Search recipes by query, category, or required MCP.
 */
export function searchRecipes(opts: {
  query?: string;
  category?: RecipeCategory;
  requiredMCP?: string;
}): Recipe[] {
  let recipes = ALL_RECIPES;

  if (opts.query) {
    const q = opts.query.toLowerCase();
    recipes = recipes.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.id.includes(q)
    );
  }

  if (opts.category) {
    recipes = recipes.filter((r) => r.category === opts.category);
  }

  if (opts.requiredMCP) {
    recipes = recipes.filter((r) => r.requiredMCPs.includes(opts.requiredMCP!));
  }

  return recipes;
}

/**
 * Get recipes grouped by category.
 */
export function getRecipesByCategory(): Record<RecipeCategory, Recipe[]> {
  const grouped: Record<string, Recipe[]> = {};
  for (const recipe of ALL_RECIPES) {
    if (!grouped[recipe.category]) {
      grouped[recipe.category] = [];
    }
    grouped[recipe.category].push(recipe);
  }
  return grouped as Record<RecipeCategory, Recipe[]>;
}

/**
 * Get all recipes that can be run with the given set of connected MCPs.
 */
export function getAvailableRecipes(connectedMCPs: string[]): Recipe[] {
  return ALL_RECIPES.filter((r) =>
    r.requiredMCPs.every((mcp) => connectedMCPs.includes(mcp))
  );
}

/**
 * Convert a recipe into FlowSteps for execution by the flow coordinator.
 * Steps are sequential (each depends on the previous).
 */
export function recipeToFlowSteps(recipe: Recipe): FlowStep[] {
  return recipe.calls.map((call, i) => ({
    id: `${recipe.id}-step-${i}`,
    label: `${recipe.name}: ${call.tool}`,
    type: "call" as const,
    call,
    dependsOn: i > 0 ? [`${recipe.id}-step-${i - 1}`] : undefined,
  }));
}
