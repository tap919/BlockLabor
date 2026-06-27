/**
 * MCPToolIndex — Item #2
 *
 * Flat, searchable index of all tools across all 9 MCP servers.
 * MCPFlowCoordinator populates this at boot by calling register() after
 * discovering each server's tools. CascadeMode uses it to answer
 * "which server has a tool for X?" without knowing server IDs.
 */

export interface IndexedTool {
  serverId: string;
  serverName: string;
  toolName: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolSearchResult {
  tool: IndexedTool;
  /** Relevance score: higher is better. */
  score: number;
}

export interface ServerSummary {
  serverId: string;
  serverName: string;
  toolCount: number;
}

export class MCPToolIndex {
  private tools: IndexedTool[] = [];

  // --------------------------------------------------------------------------
  // Registration
  // --------------------------------------------------------------------------

  /** Register (or re-register) all tools from one server. */
  register(
    serverId: string,
    serverName: string,
    tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>
  ): void {
    // Remove stale entries for this server before re-indexing
    this.tools = this.tools.filter(t => t.serverId !== serverId);
    for (const tool of tools) {
      this.tools.push({
        serverId,
        serverName,
        toolName: tool.name,
        description: tool.description ?? "",
        inputSchema: tool.inputSchema,
      });
    }
  }

  /** Remove all tools for a server (e.g. on disconnect). */
  unregister(serverId: string): void {
    this.tools = this.tools.filter(t => t.serverId !== serverId);
  }

  /** Clear the entire index. */
  clear(): void {
    this.tools = [];
  }

  // --------------------------------------------------------------------------
  // Querying
  // --------------------------------------------------------------------------

  /**
   * Full-text search across tool name, description, and server name.
   * Scores: exact name match = 10, name substring = 3, description = 2, server = 1.
   */
  search(query: string, limit = 20): ToolSearchResult[] {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const results: ToolSearchResult[] = [];
    for (const tool of this.tools) {
      const name = tool.toolName.toLowerCase();
      const desc = tool.description.toLowerCase();
      const server = tool.serverName.toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (name === term) score += 10;
        else if (name.includes(term)) score += 3;
        if (desc.includes(term)) score += 2;
        if (server.includes(term)) score += 1;
      }
      if (score > 0) results.push({ tool, score });
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Exact tool name lookup — returns all servers that expose this tool. */
  findByName(toolName: string): IndexedTool[] {
    return this.tools.filter(t => t.toolName === toolName);
  }

  /** All tools from a specific server. */
  listByServer(serverId: string): IndexedTool[] {
    return this.tools.filter(t => t.serverId === serverId);
  }

  /** All indexed tools. */
  all(): IndexedTool[] {
    return [...this.tools];
  }

  /** Total tool count across all servers. */
  get count(): number {
    return this.tools.length;
  }

  /** Per-server tool counts. */
  summary(): ServerSummary[] {
    const map = new Map<string, ServerSummary>();
    for (const tool of this.tools) {
      if (!map.has(tool.serverId)) {
        map.set(tool.serverId, {
          serverId: tool.serverId,
          serverName: tool.serverName,
          toolCount: 0,
        });
      }
      map.get(tool.serverId)!.toolCount++;
    }
    return [...map.values()];
  }
}
