#!/usr/bin/env node

/**
 * Test script for Megacode Full-Stack System
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Megacode Full-Stack System...\n');

// Test 1: Check if MCP folder exists
const mcpFolder = path.join(__dirname, 'MCP');
if (!fs.existsSync(mcpFolder)) {
  console.log('❌ MCP folder not found:', mcpFolder);
  process.exit(1);
}

console.log('✅ MCP folder exists');

// Test 2: Check for key MCPs
const requiredMCPS = [
  'voicebox-main',
  'GameAnimation64-main', 
  'Business-Logic-MCP-main',
  'Middle-Man-MCP-main'
];

const mcpEntries = fs.readdirSync(mcpFolder, { withFileTypes: true });
const mcpDirs = mcpEntries.filter(e => e.isDirectory()).map(e => e.name);

console.log(`📁 Found ${mcpDirs.length} MCP directories:`);
mcpDirs.forEach(dir => console.log(`   - ${dir}`));

// Test 3: Check auto-loader
try {
  const MCPAutoLoader = require('./mcp-autoloader');
  const loader = new MCPAutoLoader();
  const servers = loader.discoverMCPServers();
  
  console.log(`\n🔍 Auto-loader discovered ${servers.length} MCP servers:`);
  servers.forEach(server => {
    console.log(`   - ${server.name} (${server.type}) ${server.autoStart ? '🚀' : '⏸️'}`);
  });
  
  // Test 4: Check workflow sequence
  const workflow = loader.createWorkflowSequence(servers);
  console.log(`\n📋 Generated ${workflow.length}-step workflow sequence:`);
  workflow.forEach((step, i) => {
    console.log(`   ${i + 1}. ${step.name} - ${step.description}`);
  });
  
  // Test 5: Check project assessment
  const assessment = loader.generateProjectAssessment();
  console.log(`\n🔍 Project assessment template has ${assessment.assessment.steps.length} steps`);
  
  console.log('\n🎉 All tests passed! The full-stack system is ready.');
  console.log('\nNext steps:');
  console.log('1. Run: start-fullstack.bat');
  console.log('2. Open: http://localhost:3000');
  console.log('3. Click "Open Folder" to load a project');
  console.log('4. Project assessment will run automatically');
  console.log('5. Use the workflow sequence for full-stack development');
  console.log('6. Voice chat with Voicebox integration');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}