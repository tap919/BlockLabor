#!/usr/bin/env node

/**
 * Megacode CLI Wrapper for Tapclaw Draymond Agent
 * Maps Draymond coding requests directly to Megacode's multi-LLM TaskRouter.
 */

const path = require('path');
const fs = require('fs');

// Verify compilation
const indexJsPath = path.join(__dirname, '..', 'dist', 'index.js');
if (!fs.existsSync(indexJsPath)) {
  console.error('[ERROR] Megacode not built. Run `npm run build` or `npm run esbuild:build` in the Megacode-main directory.');
  process.exit(1);
}

const { ConfigFactory } = require('../dist/index.js');

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node megacode.js <task_type> "<prompt>"');
    console.log('Task types: daily, research, complex_logic, creative, templates, etc.');
    console.log('Example: node megacode.js daily "Fix the login bug in auth.ts"');
    process.exit(1);
  }

  const taskType = args[0];
  const prompt = args.slice(1).join(' ');

  try {
    // Build provider overrides from environment
    // Supports OPENAI_BASE_URL to redirect to OpenCode Zen or any OpenAI-compat endpoint
    const openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://opencode.ai/zen';
    const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENCODE_API_KEY;
    const openaiModel = process.env.OPENAI_MODEL || 'claude-opus-4-6';

    const providerOverrides = {};
    if (openaiBaseUrl || openaiKey) {
      providerOverrides.openai = {
        ...(openaiBaseUrl ? { baseUrl: openaiBaseUrl } : {}),
        ...(openaiKey ? { apiKey: openaiKey } : {}),
        models: [openaiModel],
        defaultModel: openaiModel,
      };
    }

    // When using openai/OpenCode Zen, remap all task types to use openai provider
    const taskMappingOverride = openaiKey ? {
      daily: ['openai'],
      research: ['openai'],
      complex_logic: ['openai'],
      creative: ['openai'],
      templates: ['openai'],
      the_block: ['openai'],
      general: ['openai'],
    } : undefined;

    const factory = new ConfigFactory({ 
      debug: process.env.DEBUG === 'true' || false,
      apiKeys: openaiKey ? { openai: openaiKey } : undefined,
      providers: Object.keys(providerOverrides).length > 0 ? providerOverrides : undefined,
      taskMapping: taskMappingOverride,
    });
    
    const taskRouter = factory.createTaskRouter();

    // Call Megacode's task router directly
    const response = await taskRouter.complete({
      messages: [{ role: 'user', content: prompt }]
    }, taskType);

    // Stdout is captured by Draymond
    console.log(response.content);
    
  } catch (error) {
    console.error(`[Megacode Execution Error]: ${error.message}`);
    if (error.stack && process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
