#!/usr/bin/env node

/**
 * MCP Auto-Loader for Megacode
 * 
 * Automatically discovers and loads MCP servers from the MCP folder.
 * Creates a unified full-stack development system with:
 * - Game/animation tools (GameAnimation64)
 * - Voice chat (Voicebox)
 * - Business logic/backend tools
 * - Project assessment
 * - Consistent workflow sequence
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const MCP_FOLDER = path.join(__dirname, 'MCP');
const CONFIG_FILE = path.join(__dirname, '.mcp-autoload.json');

class MCPAutoLoader {
  constructor() {
    this.mcpProcesses = new Map();
    this.mcpConfigs = [];
    this.workflowSequence = [];
  }

  /**
   * Discover MCP servers in the MCP folder
   */
  discoverMCPServers() {
    console.log('🔍 Discovering MCP servers...');
    
    const servers = [];
    
    if (!fs.existsSync(MCP_FOLDER)) {
      console.log('⚠️  MCP folder not found:', MCP_FOLDER);
      return servers;
    }

    const entries = fs.readdirSync(MCP_FOLDER, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const mcpPath = path.join(MCP_FOLDER, entry.name);
      const serverConfig = this.analyzeMCPDirectory(mcpPath, entry.name);
      
      if (serverConfig) {
        servers.push(serverConfig);
        console.log(`  ✅ Found: ${serverConfig.name} (${serverConfig.type})`);
      }
    }
    
    return servers;
  }

  /**
   * Analyze an MCP directory to determine its type and configuration
   */
  analyzeMCPDirectory(dirPath, dirName) {
    const packageJsonPath = path.join(dirPath, 'package.json');
    const readmePath = path.join(dirPath, 'README.md');
    
    let name = dirName.replace(/-main$/, '').replace(/-/g, ' ');
    let type = 'unknown';
    let command = null;
    let args = [];
    let env = {};
    
    // Check for package.json
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        name = pkg.name || name;
        
        // Determine type based on package.json
        if (pkg.keywords?.includes('voice') || pkg.name?.includes('voicebox')) {
          type = 'voice';
          command = 'npm';
          args = ['start'];
          env = { ...process.env };
        } else if (pkg.keywords?.includes('game') || pkg.name?.includes('gameanimation')) {
          type = 'game';
          command = 'node';
          args = ['index.js'];
        } else if (pkg.keywords?.includes('business') || pkg.name?.includes('business-logic')) {
          type = 'business';
          command = 'node';
          // Check package.json for main field or look for common entry points
          if (pkg.main) {
            args = [pkg.main];
          } else if (fs.existsSync(path.join(dirPath, 'dist/index.js'))) {
            args = ['dist/index.js'];
          } else if (fs.existsSync(path.join(dirPath, 'index.js'))) {
            args = ['index.js'];
          } else {
            args = ['server.js'];
          }
        } else if (pkg.keywords?.includes('animation')) {
          type = 'animation';
        } else if (pkg.keywords?.includes('database') || pkg.name?.includes('bigback')) {
          type = 'database';
        } else if (pkg.keywords?.includes('ui') || pkg.name?.includes('glass')) {
          type = 'ui';
        } else if (pkg.keywords?.includes('vector') || pkg.name?.includes('ruvector')) {
          type = 'vector';
        } else if (pkg.keywords?.includes('icon') || pkg.name?.includes('lucide')) {
          type = 'icons';
        }
      } catch (e) {
        console.log(`  ⚠️  Could not parse package.json in ${dirName}:`, e.message);
      }
    }
    
    // Check README for clues
    if (fs.existsSync(readmePath)) {
      try {
        const readme = fs.readFileSync(readmePath, 'utf8').toLowerCase();
        if (readme.includes('voice') || readme.includes('speech') || readme.includes('audio')) {
          type = 'voice';
        } else if (readme.includes('game') || readme.includes('animation') || readme.includes('n64')) {
          type = 'game';
        } else if (readme.includes('business') || readme.includes('logic')) {
          type = 'business';
        } else if (readme.includes('database') || readme.includes('backend')) {
          type = 'database';
        } else if (readme.includes('ui') || readme.includes('interface') || readme.includes('glass')) {
          type = 'ui';
        }
      } catch (e) {
        // Ignore readme errors
      }
    }
    
    // Special handling for known MCPs
    if (dirName.includes('voicebox')) {
      type = 'voice';
      command = 'npm';
      args = ['run', 'dev'];
    } else if (dirName.includes('GameAnimation64')) {
      type = 'game';
      command = 'node';
      // Look for main file
      const possibleFiles = ['index.js', 'main.js', 'server.js', 'VibeAgent.js'];
      for (const file of possibleFiles) {
        if (fs.existsSync(path.join(dirPath, file))) {
          args = [file];
          break;
        }
      }
    } else if (dirName.includes('Business-Logic')) {
      type = 'business';
      command = 'node';
      if (fs.existsSync(path.join(dirPath, 'dist/index.js'))) {
        args = ['dist/index.js'];
      } else if (fs.existsSync(path.join(dirPath, 'index.js'))) {
        args = ['index.js'];
      } else {
        args = ['server.js'];
      }
    } else if (dirName.includes('Middle-Man')) {
      type = 'orchestration';
      command = 'node';
      args = ['src/mcp-server.js'];
    } else if (dirName.includes('BigBack')) {
      type = 'database';
      command = 'node';
      args = ['dist/index.js'];
    } else if (dirName.includes('OG-Glass')) {
      type = 'ui';
      command = 'node';
      args = ['dist/index.js'];
    } else if (dirName.includes('Bobby-Breakdown')) {
      type = 'business';
      command = 'node';
      args = ['dist-mcp/index.js'];
    } else if (dirName.includes('lucide')) {
      type = 'icons';
      command = 'node';
      // Lucide MCP server is in a subdirectory
      const mcpServerDist = path.join(dirPath, 'mcp-server', 'dist', 'index.js');
      if (fs.existsSync(mcpServerDist)) {
        args = ['mcp-server/dist/index.js'];
      } else {
        args = ['mcp-server/src/index.ts'];
      }
    } else if (dirName.includes('Monaco-Bluetooth')) {
      type = 'ui';
      command = 'node';
      args = ['dist/index.js'];
    } else if (dirName.includes('ruvector')) {
      type = 'vector';
      command = 'node';
      args = ['mcp-entry.js'];
    } else if (dirName.includes('UFC')) {
      type = 'business';
      command = 'node';
      args = ['dist/index.js'];
    }
    
    // Generate server ID
    const serverId = dirName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    return {
      id: serverId,
      name: name,
      type: type,
      path: dirPath,
      command: command,
      args: args,
      env: env,
      autoStart: type !== 'unknown' && command !== null
    };
  }

  /**
   * Start an MCP server
   */
  startMCPServer(config) {
    if (!config.command || !config.autoStart) {
      console.log(`  ⚠️  Skipping ${config.name} (no command or autoStart=false)`);
      return null;
    }
    
    console.log(`  🚀 Starting ${config.name} (${config.type})...`);
    
    try {
      const proc = spawn(config.command, config.args, {
        cwd: config.path,
        env: { ...process.env, ...config.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      this.mcpProcesses.set(config.id, proc);
      
      proc.stdout.on('data', (data) => {
        console.log(`[${config.name}] ${data.toString().trim()}`);
      });
      
      proc.stderr.on('data', (data) => {
        console.error(`[${config.name} ERROR] ${data.toString().trim()}`);
      });
      
      proc.on('close', (code) => {
        console.log(`[${config.name}] Process exited with code ${code}`);
        this.mcpProcesses.delete(config.id);
      });
      
      proc.on('error', (err) => {
        console.error(`[${config.name} FAILED]`, err.message);
        this.mcpProcesses.delete(config.id);
      });
      
      return proc;
    } catch (error) {
      console.error(`  ❌ Failed to start ${config.name}:`, error.message);
      return null;
    }
  }

  /**
   * Start all discovered MCP servers
   */
  startAllMCPServers(servers) {
    console.log('\n🚀 Starting MCP servers...');
    
    // Start servers in order of dependency
    const orderedServers = this.orderServersByDependency(servers);
    
    for (const server of orderedServers) {
      this.startMCPServer(server);
    }
    
    return this.mcpProcesses;
  }

  /**
   * Order servers by dependency (database first, then business logic, then UI, etc.)
   */
  orderServersByDependency(servers) {
    const typeOrder = {
      'database': 1,
      'vector': 2,
      'business': 3,
      'orchestration': 4,
      'game': 5,
      'animation': 6,
      'voice': 7,
      'ui': 8,
      'icons': 9,
      'unknown': 10
    };
    
    return servers.sort((a, b) => {
      const orderA = typeOrder[a.type] || 10;
      const orderB = typeOrder[b.type] || 10;
      return orderA - orderB;
    });
  }

  /**
   * Generate MCP configuration for Megacode
   */
  generateMCPConfig(servers) {
    const config = {
      mcpServers: servers
        .filter(s => s.command && s.autoStart)
        .map(server => ({
          id: server.id,
          name: server.name,
          type: server.type,
          command: server.command,
          args: server.args,
          cwd: server.path,
          env: server.env
        }))
    };
    
    // Save to file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(`\n📁 MCP configuration saved to: ${CONFIG_FILE}`);
    
    return config;
  }

  /**
   * Create workflow sequence for full-stack development
   */
  createWorkflowSequence(servers) {
    const sequence = [
      {
        id: 'assessment',
        name: 'Project Assessment',
        description: 'Analyze project structure, dependencies, and requirements',
        tools: ['bobby-breakdown', 'ruvector']
      },
      {
        id: 'planning',
        name: 'Architecture Planning',
        description: 'Design system architecture and data flow',
        tools: ['business-logic', 'middle-man']
      },
      {
        id: 'backend',
        name: 'Backend Development',
        description: 'Implement database, APIs, and business logic',
        tools: ['bigback', 'business-logic']
      },
      {
        id: 'frontend',
        name: 'Frontend Development',
        description: 'Build UI components and user interface',
        tools: ['og-glass', 'lucide']
      },
      {
        id: 'game-animation',
        name: 'Game & Animation',
        description: 'Create game logic, animations, and visual effects',
        tools: ['gameanimation64']
      },
      {
        id: 'integration',
        name: 'System Integration',
        description: 'Connect all components and test end-to-end',
        tools: ['middle-man', 'ufc-mcp']
      },
      {
        id: 'voice',
        name: 'Voice Integration',
        description: 'Add voice commands and audio feedback',
        tools: ['voicebox']
      },
      {
        id: 'testing',
        name: 'Testing & Deployment',
        description: 'Run tests, optimize, and deploy',
        tools: ['all']
      }
    ];
    
    this.workflowSequence = sequence;
    return sequence;
  }

  /**
   * Generate project assessment template
   */
  generateProjectAssessment() {
    return {
      assessment: {
        steps: [
          'Scan project structure and files',
          'Analyze dependencies and package.json',
          'Check for configuration files',
          'Identify entry points and main modules',
          'Review existing code quality',
          'Check for tests and documentation',
          'Assess build and deployment setup',
          'Identify potential issues and improvements'
        ],
        tools: [
          'file-scanner',
          'dependency-analyzer',
          'code-quality-checker',
          'architecture-validator'
        ]
      }
    };
  }

  /**
   * Stop all MCP servers
   */
  stopAllServers() {
    console.log('\n🛑 Stopping all MCP servers...');
    
    for (const [id, proc] of this.mcpProcesses) {
      console.log(`  Stopping ${id}...`);
      proc.kill('SIGTERM');
    }
    
    this.mcpProcesses.clear();
  }

  /**
   * Get status of all MCP servers
   */
  getStatus() {
    const status = [];
    
    for (const [id, proc] of this.mcpProcesses) {
      status.push({
        id,
        pid: proc.pid,
        alive: !proc.killed,
        exitCode: proc.exitCode
      });
    }
    
    return status;
  }
}

// Main execution
if (require.main === module) {
  const loader = new MCPAutoLoader();
  
  console.log('='.repeat(60));
  console.log('🔮 MEGACODE MCP AUTO-LOADER');
  console.log('='.repeat(60));
  
  // Discover MCP servers
  const servers = loader.discoverMCPServers();
  
  if (servers.length === 0) {
    console.log('\n❌ No MCP servers found in', MCP_FOLDER);
    process.exit(1);
  }
  
  console.log(`\n✅ Found ${servers.length} MCP servers`);
  
  // Generate configuration
  const config = loader.generateMCPConfig(servers);
  
  // Create workflow sequence
  const workflow = loader.createWorkflowSequence(servers);
  console.log('\n📋 Workflow Sequence Created:');
  workflow.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.name} - ${step.description}`);
  });
  
  // Generate project assessment
  const assessment = loader.generateProjectAssessment();
  console.log('\n🔍 Project Assessment Template Ready');
  
  // Start servers
  loader.startAllMCPServers(servers);
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 MCP System Ready!');
  console.log('='.repeat(60));
  console.log('\nNext steps:');
  console.log('1. Open Megacode UI: http://localhost:3000');
  console.log('2. Use "Open Folder" to load a project');
  console.log('3. Project assessment will run automatically');
  console.log('4. Follow the workflow sequence for full-stack development');
  console.log('5. Use voice commands with Voicebox integration');
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\nReceived SIGINT, shutting down...');
    loader.stopAllServers();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n\nReceived SIGTERM, shutting down...');
    loader.stopAllServers();
    process.exit(0);
  });
}

module.exports = MCPAutoLoader;