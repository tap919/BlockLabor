#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When running from dist/ or src/, icons and categories live two levels up
// from the mcp-server directory.
const MCP_SERVER_ROOT = path.resolve(__dirname, "..");
const ICONS_DIR = path.resolve(MCP_SERVER_ROOT, "..", "icons");
const CATEGORIES_DIR = path.resolve(MCP_SERVER_ROOT, "..", "categories");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IconEntry {
  name: string;
  tags: string[];
  categories: string[];
  svgPath: string;
}

interface CategoryEntry {
  name: string;
  title: string;
  icon: string;
  iconNames: string[]; // populated after scanning icons
}

// ---------------------------------------------------------------------------
// In-memory index
// ---------------------------------------------------------------------------

const iconIndex = new Map<string, IconEntry>();
const categoryIndex = new Map<string, CategoryEntry>();

/**
 * Load all icon metadata from the icons/ directory.
 * Each icon has a .json (metadata) and .svg (graphic) file.
 */
function loadIcons(): void {
  if (!fs.existsSync(ICONS_DIR)) {
    console.error(`[lucide-mcp] Icons directory not found: ${ICONS_DIR}`);
    return;
  }

  const files = fs.readdirSync(ICONS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  for (const jsonFile of jsonFiles) {
    const iconName = jsonFile.replace(/\.json$/, "");
    const jsonPath = path.join(ICONS_DIR, jsonFile);
    const svgPath = path.join(ICONS_DIR, `${iconName}.svg`);

    try {
      const raw = fs.readFileSync(jsonPath, "utf-8");
      const meta = JSON.parse(raw);

      iconIndex.set(iconName, {
        name: iconName,
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        categories: Array.isArray(meta.categories) ? meta.categories : [],
        svgPath,
      });
    } catch (err) {
      console.error(`[lucide-mcp] Failed to load icon metadata: ${jsonPath}`, err);
    }
  }

  console.error(`[lucide-mcp] Loaded ${iconIndex.size} icons from ${ICONS_DIR}`);
}

/**
 * Load category metadata from the categories/ directory and build
 * reverse mapping (category -> icon names) from the icon index.
 */
function loadCategories(): void {
  // First, load category metadata files
  if (fs.existsSync(CATEGORIES_DIR)) {
    const files = fs.readdirSync(CATEGORIES_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    for (const jsonFile of jsonFiles) {
      const catName = jsonFile.replace(/\.json$/, "");
      const catPath = path.join(CATEGORIES_DIR, jsonFile);

      try {
        const raw = fs.readFileSync(catPath, "utf-8");
        const meta = JSON.parse(raw);

        categoryIndex.set(catName, {
          name: catName,
          title: meta.title ?? catName,
          icon: meta.icon ?? "",
          iconNames: [],
        });
      } catch (err) {
        console.error(`[lucide-mcp] Failed to load category: ${catPath}`, err);
      }
    }
  }

  // Build reverse mapping: for each icon, add it to its categories
  for (const [iconName, entry] of iconIndex) {
    for (const cat of entry.categories) {
      let catEntry = categoryIndex.get(cat);
      if (!catEntry) {
        // Category referenced by icon but no category file exists – create it
        catEntry = { name: cat, title: cat, icon: "", iconNames: [] };
        categoryIndex.set(cat, catEntry);
      }
      catEntry.iconNames.push(iconName);
    }
  }

  console.error(`[lucide-mcp] Loaded ${categoryIndex.size} categories`);
}

// ---------------------------------------------------------------------------
// Search helpers
// ---------------------------------------------------------------------------

/**
 * Convert an icon name like "heart-crack" to "Heart Crack" for display,
 * and also produce a PascalCase component name like "HeartCrack".
 */
function toPascalCase(name: string): string {
  return name
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Fuzzy-ish search: checks if every word in the query appears as a substring
 * in the icon name or any of its tags.
 */
function matchesQuery(entry: IconEntry, queryWords: string[]): boolean {
  const haystack = [entry.name, ...entry.tags].join(" ").toLowerCase();
  return queryWords.every((word) => haystack.includes(word));
}

/**
 * Score an icon match – lower is better. Prioritises name matches over tag
 * matches and exact matches over substring matches.
 */
function scoreMatch(entry: IconEntry, queryWords: string[]): number {
  let score = 0;
  const nameLower = entry.name.toLowerCase();

  for (const word of queryWords) {
    if (nameLower === word) {
      // Exact full-name match
      score -= 100;
    } else if (nameLower.startsWith(word)) {
      score -= 50;
    } else if (nameLower.includes(word)) {
      score -= 25;
    }
    // Tag matches get no bonus (baseline 0)
  }

  return score;
}

/**
 * Read the SVG content for a given icon. Returns the SVG string or an error
 * message.
 */
function readSvg(entry: IconEntry): string {
  try {
    if (!fs.existsSync(entry.svgPath)) {
      return `[SVG file not found: ${entry.svgPath}]`;
    }
    return fs.readFileSync(entry.svgPath, "utf-8");
  } catch {
    return `[Error reading SVG: ${entry.svgPath}]`;
  }
}

// ---------------------------------------------------------------------------
// MCP Server setup
// ---------------------------------------------------------------------------

const server = new Server(
  { name: "lucide-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "search_icons",
    description:
      "Search the Lucide icon library by name or tags. Returns matching icon names with their tags and categories. Supports fuzzy matching on icon names and tags.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "Search query to match against icon names and tags",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_icon",
    description:
      "Get full details for a specific Lucide icon including SVG content, tags, and categories.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The icon name (e.g. 'heart', 'arrow-right')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_icon_svg",
    description: "Get just the raw SVG string for a specific Lucide icon.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The icon name (e.g. 'heart', 'arrow-right')",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "list_categories",
    description:
      "List all available Lucide icon categories with the number of icons in each.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_icons_by_category",
    description: "Get all icon names belonging to a specific category.",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          description: "Category name (e.g. 'medical', 'arrows', 'gaming')",
        },
        limit: {
          type: "number",
          description: "Maximum number of icons to return (default 50)",
        },
      },
      required: ["category"],
    },
  },
  {
    name: "get_icon_react",
    description:
      "Get a React/JSX usage snippet for a Lucide icon, including the import statement and component usage.",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "The icon name (e.g. 'heart', 'arrow-right')",
        },
        size: {
          type: "number",
          description: "Icon size in pixels (default 24)",
        },
        color: {
          type: "string",
          description: 'Icon color (default "currentColor")',
        },
      },
      required: ["name"],
    },
  },
];

// ---------------------------------------------------------------------------
// Request handlers
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // ---- search_icons ----
      case "search_icons": {
        const query = String(args?.query ?? "").trim().toLowerCase();
        const limit = Number(args?.limit) || 20;

        if (!query) {
          return {
            content: [
              { type: "text", text: JSON.stringify({ error: "query is required" }, null, 2) },
            ],
          };
        }

        const queryWords = query.split(/\s+/).filter(Boolean);
        const matches: { entry: IconEntry; score: number }[] = [];

        for (const entry of iconIndex.values()) {
          if (matchesQuery(entry, queryWords)) {
            matches.push({ entry, score: scoreMatch(entry, queryWords) });
          }
        }

        matches.sort((a, b) => a.score - b.score);
        const results = matches.slice(0, limit).map((m) => ({
          name: m.entry.name,
          tags: m.entry.tags,
          categories: m.entry.categories,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ query, total: matches.length, results }, null, 2),
            },
          ],
        };
      }

      // ---- get_icon ----
      case "get_icon": {
        const iconName = String(args?.name ?? "").trim().toLowerCase();
        const entry = iconIndex.get(iconName);

        if (!entry) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: `Icon '${iconName}' not found. Use search_icons to find available icons.` },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const svg = readSvg(entry);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  name: entry.name,
                  tags: entry.tags,
                  categories: entry.categories,
                  componentName: toPascalCase(entry.name),
                  svg,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // ---- get_icon_svg ----
      case "get_icon_svg": {
        const iconName = String(args?.name ?? "").trim().toLowerCase();
        const entry = iconIndex.get(iconName);

        if (!entry) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: `Icon '${iconName}' not found. Use search_icons to find available icons.` },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const svg = readSvg(entry);
        return {
          content: [{ type: "text", text: svg }],
        };
      }

      // ---- list_categories ----
      case "list_categories": {
        const categories = Array.from(categoryIndex.values())
          .map((cat) => ({
            name: cat.name,
            title: cat.title,
            icon: cat.icon,
            iconCount: cat.iconNames.length,
          }))
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ total: categories.length, categories }, null, 2),
            },
          ],
        };
      }

      // ---- get_icons_by_category ----
      case "get_icons_by_category": {
        const catName = String(args?.category ?? "").trim().toLowerCase();
        const limit = Number(args?.limit) || 50;
        const catEntry = categoryIndex.get(catName);

        if (!catEntry) {
          const available = Array.from(categoryIndex.keys()).sort();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    error: `Category '${catName}' not found.`,
                    availableCategories: available,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const icons = catEntry.iconNames.slice(0, limit).sort();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  category: catEntry.name,
                  title: catEntry.title,
                  total: catEntry.iconNames.length,
                  showing: icons.length,
                  icons,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // ---- get_icon_react ----
      case "get_icon_react": {
        const iconName = String(args?.name ?? "").trim().toLowerCase();
        const size = Number(args?.size) || 24;
        const color = String(args?.color ?? "currentColor");
        const entry = iconIndex.get(iconName);

        if (!entry) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { error: `Icon '${iconName}' not found. Use search_icons to find available icons.` },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        const componentName = toPascalCase(entry.name);
        const importStatement = `import { ${componentName} } from "lucide-react";`;
        const usage = `<${componentName} size={${size}} color="${color}" />`;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  name: entry.name,
                  componentName,
                  import: importStatement,
                  usage,
                  example: `${importStatement}\n\nfunction MyComponent() {\n  return ${usage};\n}`,
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      // ---- unknown tool ----
      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
            },
          ],
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: message }, null, 2),
        },
      ],
    };
  }
});

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.error("[lucide-mcp] Starting Lucide icon library MCP server...");
  console.error(`[lucide-mcp] Icons directory: ${ICONS_DIR}`);
  console.error(`[lucide-mcp] Categories directory: ${CATEGORIES_DIR}`);

  // Build in-memory index
  loadIcons();
  loadCategories();

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("[lucide-mcp] Server running on stdio");
}

main().catch((err) => {
  console.error("[lucide-mcp] Fatal error:", err);
  process.exit(1);
});
