#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Data (ported exactly from Frontend React component) ───────────────────────

interface InfraProvider {
  id: string;
  label: string;
  icon: string;
  regions: string[];
}

interface Framework {
  id: string;
  label: string;
  lang: string;
  color: string;
  icon: string;
  perf: string;
}

interface Database {
  id: string;
  label: string;
  color: string;
  icon: string;
}

interface Cache {
  id: string;
  label: string;
  icon: string;
}

interface Features {
  auth: boolean;
  cors: boolean;
  logging: boolean;
  docker: boolean;
  swagger: boolean;
  rateLimiting: boolean;
  compression: boolean;
  prometheus: boolean;
  healthChecks: boolean;
  tracing: boolean;
  ci: boolean;
  tests: boolean;
}

interface Config {
  project: string;
  env: string;
  infra: string;
  region: string;
  framework: string;
  database: string;
  cache: string;
  port: number;
  rateLimit: number;
  poolSize: number;
  cacheTTL: number;
  timeout: number;
  replicas: number;
  features: Features;
  auth: string;
}

interface Preset {
  id: string;
  label: string;
  icon: string;
  config: Config;
}

const INFRA: InfraProvider[] = [
  { id: "aws", label: "AWS", icon: "\u2601\uFE0F", regions: ["us-east-1", "eu-central-1", "ap-southeast-1"] },
  { id: "gcp", label: "GCP", icon: "\uD83C\uDF10", regions: ["us-central1", "europe-west1", "asia-east1"] },
  { id: "azure", label: "Azure", icon: "\uD83D\uDD37", regions: ["eastus", "westeurope", "southeastasia"] },
  { id: "on-prem", label: "Bare Metal", icon: "\uD83C\uDFE2", regions: ["local", "datacenter-a", "datacenter-b"] },
];

const FRAMEWORKS: Framework[] = [
  { id: "fastapi", label: "FastAPI", lang: "Python", color: "#63b3ed", icon: "\uD83D\uDE80", perf: "Ultra" },
  { id: "express", label: "Express.js", lang: "Node", color: "#68d391", icon: "\u26A1", perf: "High" },
  { id: "nestjs", label: "NestJS", lang: "Node", color: "#fc8181", icon: "\uD83C\uDFD7\uFE0F", perf: "Enterprise" },
  { id: "gin", label: "Gin", lang: "Go", color: "#76e4f7", icon: "\uD83C\uDF78", perf: "Extreme" },
  { id: "django", label: "Django", lang: "Python", color: "#fbd38d", icon: "\uD83C\uDFB8", perf: "Solid" },
];

const DATABASES: Database[] = [
  { id: "postgres", label: "PostgreSQL", color: "#63b3ed", icon: "\uD83D\uDC18" },
  { id: "mongo", label: "MongoDB", color: "#68d391", icon: "\uD83C\uDF43" },
  { id: "mysql", label: "MySQL", color: "#fbd38d", icon: "\uD83D\uDC2C" },
  { id: "sqlite", label: "SQLite", color: "#b794f4", icon: "\uD83D\uDCE6" },
  { id: "planetscale", label: "PlanetScale", color: "#f687b3", icon: "\uD83C\uDF0D" },
];

const CACHES: Cache[] = [
  { id: "redis", label: "Redis", icon: "\uD83D\uDD34" },
  { id: "memcached", label: "Memcached", icon: "\uD83D\uDDC3\uFE0F" },
  { id: "dragonfly", label: "Dragonfly", icon: "\uD83D\uDC09" },
  { id: "none", label: "None", icon: "\u2205" },
];

const DEFAULTS: Config = {
  project: "my-service",
  env: "production",
  infra: "aws",
  region: "us-east-1",
  framework: "fastapi",
  database: "postgres",
  cache: "redis",
  port: 8000,
  rateLimit: 100,
  poolSize: 20,
  cacheTTL: 300,
  timeout: 30,
  replicas: 2,
  features: {
    auth: true,
    cors: true,
    logging: true,
    docker: true,
    swagger: true,
    rateLimiting: true,
    compression: true,
    prometheus: true,
    healthChecks: true,
    tracing: false,
    ci: false,
    tests: true,
  },
  auth: "jwt",
};

const PRESETS: Preset[] = [
  {
    id: "saas-starter",
    label: "SaaS Starter",
    icon: "\uD83C\uDFE2",
    config: {
      ...DEFAULTS,
      framework: "nestjs",
      database: "postgres",
      replicas: 3,
      poolSize: 25,
      features: { ...DEFAULTS.features, ci: true, tests: true },
    },
  },
  {
    id: "ml-api",
    label: "ML API",
    icon: "\uD83E\uDD16",
    config: {
      ...DEFAULTS,
      framework: "fastapi",
      database: "postgres",
      cache: "redis",
      port: 8000,
      timeout: 120,
      poolSize: 5,
      rateLimit: 50,
      features: { ...DEFAULTS.features, swagger: true, tracing: true },
    },
  },
  {
    id: "realtime",
    label: "Realtime App",
    icon: "\u26A1",
    config: {
      ...DEFAULTS,
      framework: "express",
      database: "mongo",
      cache: "redis",
      replicas: 4,
      rateLimit: 500,
      cacheTTL: 60,
    },
  },
  {
    id: "microservice",
    label: "Microservice",
    icon: "\uD83D\uDD2C",
    config: {
      ...DEFAULTS,
      framework: "gin",
      database: "postgres",
      replicas: 6,
      poolSize: 50,
      rateLimit: 1000,
      timeout: 5,
    },
  },
  {
    id: "edge-minimal",
    label: "Edge Minimal",
    icon: "\uD83C\uDF0A",
    config: {
      ...DEFAULTS,
      framework: "express",
      database: "sqlite",
      cache: "none",
      replicas: 1,
      poolSize: 2,
      features: {
        ...DEFAULTS.features,
        prometheus: false,
        swagger: false,
        tracing: false,
        ci: false,
      },
    },
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildConfig(params: Partial<Config>): Config {
  return { ...DEFAULTS, ...params, features: { ...DEFAULTS.features, ...params.features } };
}

function generateOutputJSON(config: Config) {
  const fw = FRAMEWORKS.find((f) => f.id === config.framework);
  const inf = INFRA.find((i) => i.id === config.infra);

  return {
    metadata: {
      project: config.project,
      version: "2.0.0",
      env: config.env,
      generated: new Date().toISOString().split("T")[0],
    },
    spec: {
      runtime: {
        id: fw?.id ?? config.framework,
        label: fw?.label ?? config.framework,
        lang: fw?.lang ?? "unknown",
        perf: fw?.perf ?? "unknown",
      },
      infrastructure: {
        provider: inf?.id ?? config.infra,
        label: inf?.label ?? config.infra,
        region: config.region,
      },
      deployment: {
        replicas: config.replicas,
        port: config.port,
        timeout: `${config.timeout}s`,
        resources: {
          db_pool_max: config.poolSize,
          db_pool_min: 2,
        },
      },
      stack: {
        database: config.database,
        cache: config.cache,
        auth_strategy: config.auth,
      },
      performance: {
        rate_limit: {
          requests: config.rateLimit,
          window: "1m",
        },
        cache_ttl: config.cacheTTL,
      },
      monitoring: {
        prometheus: config.features.prometheus,
        tracing: config.features.tracing,
        health_path: "/health",
        log_level: config.features.logging ? "info" : "error",
      },
      features: config.features,
    },
  };
}

function generateDockerCompose(config: Config): string {
  const fw = FRAMEWORKS.find((f) => f.id === config.framework);
  const lines: string[] = [];

  lines.push('version: "3.9"');
  lines.push("");
  lines.push(`# ── ${config.project} docker-compose (generated by bigback-mcp) ──`);
  lines.push("");
  lines.push("services:");
  lines.push("");

  // ── App service ──
  lines.push("  app:");

  // Determine the base image / command based on framework
  switch (config.framework) {
    case "fastapi":
      lines.push('    image: python:3.12-slim');
      lines.push('    command: uvicorn main:app --host 0.0.0.0 --port ' + config.port);
      break;
    case "express":
    case "nestjs":
      lines.push('    image: node:20-alpine');
      lines.push('    command: node dist/main.js');
      break;
    case "gin":
      lines.push('    image: golang:1.22-alpine');
      lines.push('    command: ./main');
      break;
    case "django":
      lines.push('    image: python:3.12-slim');
      lines.push('    command: gunicorn config.wsgi:application --bind 0.0.0.0:' + config.port);
      break;
    default:
      lines.push('    build: ./app');
      break;
  }

  lines.push("    ports:");
  lines.push(`      - "${config.port}:${config.port}"`);
  lines.push("    environment:");
  lines.push(`      - ENV=${config.env}`);
  lines.push(`      - PORT=${config.port}`);

  // Database URL
  const dbUrls: Record<string, string> = {
    postgres: `postgresql://postgres:postgres@db:5432/${config.project.replace(/-/g, "_")}`,
    mongo: `mongodb://mongo:27017/${config.project.replace(/-/g, "_")}`,
    mysql: `mysql://root:root@db:3306/${config.project.replace(/-/g, "_")}`,
    sqlite: `sqlite:///data/${config.project.replace(/-/g, "_")}.db`,
    planetscale: `mysql://root:root@db:3306/${config.project.replace(/-/g, "_")}`,
  };
  lines.push(`      - DATABASE_URL=${dbUrls[config.database] ?? "sqlite:///data/app.db"}`);

  // Cache URL
  if (config.cache === "redis") {
    lines.push("      - REDIS_URL=redis://redis:6379/0");
  } else if (config.cache === "memcached") {
    lines.push("      - MEMCACHED_URL=memcached:11211");
  } else if (config.cache === "dragonfly") {
    lines.push("      - REDIS_URL=redis://dragonfly:6379/0");
  }

  lines.push('      - SECRET_KEY=${SECRET_KEY:-changeme}');
  lines.push(`      - AUTH_STRATEGY=${config.auth}`);

  // depends_on
  const deps: string[] = [];
  if (["postgres", "mysql", "planetscale"].includes(config.database)) deps.push("db");
  if (config.database === "mongo") deps.push("mongo");
  if (config.cache === "redis") deps.push("redis");
  if (config.cache === "memcached") deps.push("memcached");
  if (config.cache === "dragonfly") deps.push("dragonfly");

  if (deps.length > 0) {
    lines.push("    depends_on:");
    for (const dep of deps) {
      if (["db", "mongo"].includes(dep)) {
        lines.push(`      ${dep}:`);
        lines.push("        condition: service_healthy");
      } else if (["redis", "dragonfly"].includes(dep)) {
        lines.push(`      ${dep}:`);
        lines.push("        condition: service_healthy");
      } else {
        lines.push(`      ${dep}:`);
        lines.push("        condition: service_started");
      }
    }
  }

  if (config.replicas > 1) {
    lines.push(`    deploy:`);
    lines.push(`      replicas: ${config.replicas}`);
  }

  lines.push("    restart: unless-stopped");
  lines.push("");

  // ── Database service ──
  if (config.database === "postgres") {
    const dbName = config.project.replace(/-/g, "_");
    lines.push("  db:");
    lines.push("    image: postgres:16-alpine");
    lines.push("    environment:");
    lines.push("      POSTGRES_USER: postgres");
    lines.push("      POSTGRES_PASSWORD: postgres");
    lines.push(`      POSTGRES_DB: ${dbName}`);
    lines.push("    volumes:");
    lines.push("      - pgdata:/var/lib/postgresql/data");
    lines.push("    healthcheck:");
    lines.push('      test: ["CMD-SHELL", "pg_isready -U postgres"]');
    lines.push("      interval: 10s");
    lines.push("      timeout: 5s");
    lines.push("      retries: 5");
    lines.push("    restart: unless-stopped");
    lines.push("");
  } else if (config.database === "mysql" || config.database === "planetscale") {
    const dbName = config.project.replace(/-/g, "_");
    lines.push("  db:");
    lines.push("    image: mysql:8.0");
    lines.push("    environment:");
    lines.push("      MYSQL_ROOT_PASSWORD: root");
    lines.push(`      MYSQL_DATABASE: ${dbName}`);
    lines.push("    volumes:");
    lines.push("      - mysqldata:/var/lib/mysql");
    lines.push("    healthcheck:");
    lines.push('      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]');
    lines.push("      interval: 10s");
    lines.push("      timeout: 5s");
    lines.push("      retries: 5");
    lines.push("    restart: unless-stopped");
    lines.push("");
  } else if (config.database === "mongo") {
    lines.push("  mongo:");
    lines.push("    image: mongo:7");
    lines.push("    volumes:");
    lines.push("      - mongodata:/data/db");
    lines.push("    healthcheck:");
    lines.push('      test: ["CMD", "mongosh", "--eval", "db.adminCommand(\'ping\')"]');
    lines.push("      interval: 10s");
    lines.push("      timeout: 5s");
    lines.push("      retries: 5");
    lines.push("    restart: unless-stopped");
    lines.push("");
  }

  // ── Cache service ──
  if (config.cache === "redis") {
    lines.push("  redis:");
    lines.push("    image: redis:7-alpine");
    lines.push("    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru");
    lines.push("    volumes:");
    lines.push("      - redisdata:/data");
    lines.push("    healthcheck:");
    lines.push('      test: ["CMD", "redis-cli", "ping"]');
    lines.push("      interval: 10s");
    lines.push("      timeout: 3s");
    lines.push("      retries: 5");
    lines.push("    restart: unless-stopped");
    lines.push("");
  } else if (config.cache === "memcached") {
    lines.push("  memcached:");
    lines.push("    image: memcached:1.6-alpine");
    lines.push("    command: memcached -m 256");
    lines.push("    restart: unless-stopped");
    lines.push("");
  } else if (config.cache === "dragonfly") {
    lines.push("  dragonfly:");
    lines.push("    image: docker.dragonflydb.io/dragonflydb/dragonfly");
    lines.push("    volumes:");
    lines.push("      - dragonflydata:/data");
    lines.push("    healthcheck:");
    lines.push('      test: ["CMD", "redis-cli", "ping"]');
    lines.push("      interval: 10s");
    lines.push("      timeout: 3s");
    lines.push("      retries: 5");
    lines.push("    restart: unless-stopped");
    lines.push("");
  }

  // ── Volumes ──
  const volumes: string[] = [];
  if (config.database === "postgres") volumes.push("pgdata");
  if (config.database === "mysql" || config.database === "planetscale") volumes.push("mysqldata");
  if (config.database === "mongo") volumes.push("mongodata");
  if (config.database === "sqlite") volumes.push("sqlitedata");
  if (config.cache === "redis") volumes.push("redisdata");
  if (config.cache === "dragonfly") volumes.push("dragonflydata");

  if (volumes.length > 0) {
    lines.push("volumes:");
    for (const v of volumes) {
      lines.push(`  ${v}:`);
    }
  }

  return lines.join("\n");
}

function generateEnvFile(config: Config): string {
  const lines: string[] = [];

  lines.push(`# ── ${config.project} environment variables (generated by bigback-mcp) ──`);
  lines.push("");
  lines.push(`# App`);
  lines.push(`ENV=${config.env}`);
  lines.push(`PORT=${config.port}`);
  lines.push(`PROJECT_NAME=${config.project}`);
  lines.push("");

  // Secret key
  lines.push("# Auth");
  lines.push("SECRET_KEY=CHANGE_ME_GENERATE_A_SECURE_KEY");
  lines.push(`AUTH_STRATEGY=${config.auth}`);
  lines.push("");

  // Database
  lines.push("# Database");
  const dbName = config.project.replace(/-/g, "_");
  switch (config.database) {
    case "postgres":
      lines.push("POSTGRES_USER=postgres");
      lines.push("POSTGRES_PASSWORD=postgres");
      lines.push(`POSTGRES_DB=${dbName}`);
      lines.push(`DATABASE_URL=postgresql://postgres:postgres@db:5432/${dbName}`);
      break;
    case "mysql":
    case "planetscale":
      lines.push("MYSQL_ROOT_PASSWORD=root");
      lines.push(`MYSQL_DATABASE=${dbName}`);
      lines.push(`DATABASE_URL=mysql://root:root@db:3306/${dbName}`);
      break;
    case "mongo":
      lines.push(`DATABASE_URL=mongodb://mongo:27017/${dbName}`);
      break;
    case "sqlite":
      lines.push(`DATABASE_URL=sqlite:///data/${dbName}.db`);
      break;
    default:
      lines.push(`DATABASE_URL=sqlite:///data/${dbName}.db`);
      break;
  }
  lines.push("");

  // Cache
  lines.push("# Cache");
  if (config.cache === "redis") {
    lines.push("REDIS_URL=redis://redis:6379/0");
  } else if (config.cache === "memcached") {
    lines.push("MEMCACHED_URL=memcached:11211");
  } else if (config.cache === "dragonfly") {
    lines.push("REDIS_URL=redis://dragonfly:6379/0");
  } else {
    lines.push("# No cache configured");
  }
  lines.push(`CACHE_TTL=${config.cacheTTL}`);
  lines.push("");

  // CORS
  lines.push("# CORS");
  lines.push('CORS_ORIGINS=["http://localhost:3000"]');
  lines.push("");

  // Performance
  lines.push("# Performance");
  lines.push(`RATE_LIMIT=${config.rateLimit}`);
  lines.push(`DB_POOL_SIZE=${config.poolSize}`);
  lines.push(`TIMEOUT=${config.timeout}`);
  lines.push("");

  // Deployment
  lines.push("# Deployment");
  lines.push(`REPLICAS=${config.replicas}`);
  lines.push(`INFRA_PROVIDER=${config.infra}`);
  lines.push(`REGION=${config.region}`);

  return lines.join("\n");
}

// ── JSON Schema helpers ───────────────────────────────────────────────────────

const configInputSchema = {
  type: "object" as const,
  properties: {
    project: { type: "string", description: "Project name (default: my-service)" },
    env: {
      type: "string",
      enum: ["development", "staging", "production"],
      description: "Environment (default: production)",
    },
    framework: {
      type: "string",
      enum: ["fastapi", "express", "nestjs", "gin", "django"],
      description: "Backend framework (default: fastapi)",
    },
    database: {
      type: "string",
      enum: ["postgres", "mongo", "mysql", "sqlite", "planetscale"],
      description: "Database engine (default: postgres)",
    },
    cache: {
      type: "string",
      enum: ["redis", "memcached", "dragonfly", "none"],
      description: "Cache layer (default: redis)",
    },
    auth: {
      type: "string",
      enum: ["jwt", "session", "oauth", "apikey", "none"],
      description: "Auth strategy (default: jwt)",
    },
    infra: {
      type: "string",
      enum: ["aws", "gcp", "azure", "on-prem"],
      description: "Infrastructure provider (default: aws)",
    },
    region: { type: "string", description: "Deployment region (default: us-east-1)" },
    replicas: { type: "number", description: "Number of replicas (default: 2)" },
    port: { type: "number", description: "Application port (default: 8000)" },
    timeout: { type: "number", description: "Request timeout in seconds (default: 30)" },
    rateLimit: { type: "number", description: "Rate limit requests per minute (default: 100)" },
    poolSize: { type: "number", description: "Database connection pool size (default: 20)" },
    cacheTTL: { type: "number", description: "Cache TTL in seconds (default: 300)" },
    features: {
      type: "object",
      description: "Feature flags",
      properties: {
        auth: { type: "boolean" },
        cors: { type: "boolean" },
        logging: { type: "boolean" },
        docker: { type: "boolean" },
        swagger: { type: "boolean" },
        rateLimiting: { type: "boolean" },
        compression: { type: "boolean" },
        prometheus: { type: "boolean" },
        healthChecks: { type: "boolean" },
        tracing: { type: "boolean" },
        ci: { type: "boolean" },
        tests: { type: "boolean" },
      },
    },
  },
  required: [] as string[],
};

// ── Server setup ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "bigback-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── List tools ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_config",
      description:
        "Generate a full backend infrastructure configuration JSON spec. Accepts optional parameters for project name, environment, framework, database, cache, auth strategy, infrastructure provider, region, replicas, port, timeout, rate limit, pool size, cache TTL, and feature flags. Returns the complete structured config matching the BackendMCP output schema.",
      inputSchema: configInputSchema,
    },
    {
      name: "list_frameworks",
      description:
        "List all available backend frameworks with their metadata including id, label, language, performance tier, color, and icon.",
      inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
    },
    {
      name: "list_databases",
      description:
        "List all available database engines with their metadata including id, label, color, and icon.",
      inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
    },
    {
      name: "list_caches",
      description: "List all available cache layers with their metadata including id, label, and icon.",
      inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
    },
    {
      name: "list_infrastructure",
      description:
        "List all available cloud/infrastructure providers with their regions.",
      inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
    },
    {
      name: "list_presets",
      description:
        "List all 5 built-in template presets (saas-starter, ml-api, realtime, microservice, edge-minimal) with their full configuration.",
      inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
    },
    {
      name: "apply_preset",
      description:
        "Apply a built-in preset by ID and return the full generated configuration JSON for that preset.",
      inputSchema: {
        type: "object" as const,
        properties: {
          preset: {
            type: "string",
            enum: ["saas-starter", "ml-api", "realtime", "microservice", "edge-minimal"],
            description: "The preset ID to apply",
          },
        },
        required: ["preset"],
      },
    },
    {
      name: "generate_docker_compose",
      description:
        "Generate a docker-compose.yml file string based on the given backend stack configuration parameters. Includes services for the app, database, and cache with healthchecks and proper networking.",
      inputSchema: configInputSchema,
    },
    {
      name: "generate_env_file",
      description:
        "Generate a .env file string based on the given backend stack configuration parameters. Includes DATABASE_URL, REDIS_URL, SECRET_KEY, ENV, CORS_ORIGINS, and other environment variables.",
      inputSchema: configInputSchema,
    },
  ],
}));

// ── Call tool handler ─────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "generate_config": {
      const config = buildConfig((args ?? {}) as Partial<Config>);
      const result = generateOutputJSON(config);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "list_frameworks": {
      const result = FRAMEWORKS.map(({ id, label, lang, perf, color, icon }) => ({
        id,
        label,
        lang,
        perf,
        color,
        icon,
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "list_databases": {
      const result = DATABASES.map(({ id, label, color, icon }) => ({
        id,
        label,
        color,
        icon,
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "list_caches": {
      const result = CACHES.map(({ id, label, icon }) => ({ id, label, icon }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "list_infrastructure": {
      const result = INFRA.map(({ id, label, icon, regions }) => ({
        id,
        label,
        icon,
        regions,
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "list_presets": {
      const result = PRESETS.map(({ id, label, icon, config }) => ({
        id,
        label,
        icon,
        config,
      }));
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "apply_preset": {
      const presetId = (args as { preset: string }).preset;
      const preset = PRESETS.find((p) => p.id === presetId);
      if (!preset) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: `Unknown preset: ${presetId}`,
                  available: PRESETS.map((p) => p.id),
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
      const result = generateOutputJSON(preset.config);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }

    case "generate_docker_compose": {
      const config = buildConfig((args ?? {}) as Partial<Config>);
      const result = generateDockerCompose(config);
      return { content: [{ type: "text", text: result }] };
    }

    case "generate_env_file": {
      const config = buildConfig((args ?? {}) as Partial<Config>);
      const result = generateEnvFile(config);
      return { content: [{ type: "text", text: result }] };
    }

    default: {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
          },
        ],
        isError: true,
      };
    }
  }
});

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("bigback-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
