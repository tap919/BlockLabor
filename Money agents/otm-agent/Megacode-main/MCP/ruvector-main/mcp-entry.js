#!/usr/bin/env node

/**
 * RuVector MCP Entry Point for Megacode
 * 
 * Delegates to the full mega-server at npm/packages/ruvector/bin/mcp-server.js
 * This provides a clean, top-level entry point for the MCP autoloader.
 */

const path = require('path');

// Set up environment for MCP mode
process.env.MCP_SERVER = '1';

// Resolve the mega-server path
const megaServerPath = path.join(__dirname, 'npm', 'packages', 'ruvector', 'bin', 'mcp-server.js');

try {
  require(megaServerPath);
} catch (err) {
  // If the mega-server can't be loaded (missing deps), provide a minimal fallback
  console.error(`[ruvector-mcp] Failed to load mega-server: ${err.message}`);
  console.error(`[ruvector-mcp] Falling back to minimal MCP server...`);
  
  const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
  const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
  const {
    CallToolRequestSchema,
    ListToolsRequestSchema,
  } = require('@modelcontextprotocol/sdk/types.js');
  
  const server = new Server(
    { name: 'ruvector-mcp', version: '0.2.16' },
    { capabilities: { tools: {} } }
  );
  
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'ruvector_status',
        description: 'Check RuVector MCP server status and available capabilities',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'vector_search',
        description: 'Search the vector store for similar content using semantic search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query text' },
            limit: { type: 'number', description: 'Max results to return (default 10)' },
            namespace: { type: 'string', description: 'Optional namespace to search within' }
          },
          required: ['query']
        }
      },
      {
        name: 'vector_store',
        description: 'Store content in the vector database with embeddings',
        inputSchema: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'Content to store' },
            metadata: { type: 'object', description: 'Optional metadata to associate' },
            namespace: { type: 'string', description: 'Optional namespace' }
          },
          required: ['content']
        }
      },
      {
        name: 'hooks_list',
        description: 'List all registered RuVector hooks and their status',
        inputSchema: { type: 'object', properties: {}, required: [] }
      },
      {
        name: 'analyze_code',
        description: 'Analyze code using RuVector intelligence for patterns, complexity, and suggestions',
        inputSchema: {
          type: 'object',
          properties: {
            code: { type: 'string', description: 'Code to analyze' },
            language: { type: 'string', description: 'Programming language' }
          },
          required: ['code']
        }
      }
    ]
  }));
  
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    switch (name) {
      case 'ruvector_status':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: 'fallback',
              message: 'Running in fallback mode. Install full dependencies with: cd npm/packages/ruvector && npm install',
              availableTools: 5,
              fullServerTools: 91,
              megaServerPath: megaServerPath
            }, null, 2)
          }]
        };
      
      case 'vector_search':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              results: [],
              message: 'Vector search requires full server. Run: cd npm/packages/ruvector && npm install',
              query: args?.query || ''
            }, null, 2)
          }]
        };
      
      case 'vector_store':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              stored: false,
              message: 'Vector store requires full server. Run: cd npm/packages/ruvector && npm install'
            }, null, 2)
          }]
        };
      
      case 'hooks_list':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              hooks: [],
              message: 'Hooks require full server. Run: cd npm/packages/ruvector && npm install'
            }, null, 2)
          }]
        };
      
      case 'analyze_code':
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              analysis: null,
              message: 'Code analysis requires full server. Run: cd npm/packages/ruvector && npm install'
            }, null, 2)
          }]
        };
      
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true
        };
    }
  });
  
  async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('[ruvector-mcp] Fallback MCP server running');
  }
  
  main().catch(err => {
    console.error('[ruvector-mcp] Fatal:', err);
    process.exit(1);
  });
}
