#!/usr/bin/env node

/**
 * MCP Manager - Manage your MCP servers
 * 
 * Usage:
 *   node mcp-manager.js list          # List all MCPs
 *   node mcp-manager.js start <name>  # Start specific MCP
 *   node mcp-manager.js stop <name>   # Stop specific MCP
 *   node mcp-manager.js status        # Show status
 *   node mcp-manager.js install       # Install dependencies
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const MCP_FOLDER = path.join(__dirname, 'MCP');

class MCPManager {
  constructor() {
    this.processes = new Map();
  }

  listMCPS() {
    console.log('📁 MCP Directory Listing:\n');
    
    if (!fs.existsSync(MCP_FOLDER)) {
      console.log('❌ MCP folder not found:', MCP_FOLDER);
      return;
    }

    const entries = fs.readdirSync(MCP_FOLDER, { withFileTypes: true });
    
    entries.forEach(entry => {
      if (!entry.isDirectory()) return;
      
      const mcpPath = path.join(MCP_FOLDER, entry.name);
      const packageJsonPath = path.join(mcpPath, 'package.json');
      const readmePath = path.join(mcpPath, 'README.md');
      
      let name = entry.name.replace(/-main$/, '').replace(/-/g, ' ');
      let description = '';
      let hasPackageJson = false;
      
      // Read package.json
      if (fs.existsSync(packageJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
          name = pkg.name || name;
          description = pkg.description || '';
          hasPackageJson = true;
        } catch (e) {
          // Ignore
        }
      }
      
      // Read README first line
      if (!description && fs.existsSync(readmePath)) {
        try {
          const readme = fs.readFileSync(readmePath, 'utf8');
          const firstLine = readme.split('\n')[0].replace(/^#+\s*/, '');
          if (firstLine && firstLine.length < 100) {
            description = firstLine;
          }
        } catch (e) {
          // Ignore
        }
      }
      
      console.log(`🔸 ${name}`);
      console.log(`   Path: ${entry.name}`);
      if (description) console.log(`   Desc: ${description}`);
      console.log(`   Type: ${this.detectMCPType(entry.name)}`);
      console.log(`   Package: ${hasPackageJson ? '✅' : '❌'}`);
      console.log();
    });
    
    console.log(`Total: ${entries.filter(e => e.isDirectory()).length} MCPs`);
  }

  detectMCPType(dirName) {
    const lower = dirName.toLowerCase();
    
    if (lower.includes('voice')) return '🎤 Voice';
    if (lower.includes('game') || lower.includes('animation')) return '🎮 Game/Animation';
    if (lower.includes('bobby') || lower.includes('breakdown')) return '🧠 Concept Analysis';
    if (lower.includes('business') || lower.includes('logic')) return '💼 Business Logic';
    if (lower.includes('database') || lower.includes('bigback')) return '🗄️ Infrastructure';
    if (lower.includes('ui') || lower.includes('glass')) return '🎨 UI';
    if (lower.includes('middle') || lower.includes('man')) return '🔄 Orchestration';
    if (lower.includes('monaco') || lower.includes('bluetooth')) return '🎮 Controller';
    if (lower.includes('vector') || lower.includes('ruvector') || lower.includes('embed')) return '🧮 Vector';
    if (lower.includes('icon') || lower.includes('lucide')) return '🎯 Icons';
    if (lower.includes('ufc') || lower.includes('converter')) return '🔄 File Converter';
    
    return '❓ Unknown';
  }

  installDependencies() {
    console.log('📦 Installing dependencies for all MCPs...\n');
    
    if (!fs.existsSync(MCP_FOLDER)) {
      console.log('❌ MCP folder not found');
      return;
    }

    const entries = fs.readdirSync(MCP_FOLDER, { withFileTypes: true });
    let installed = 0;
    let skipped = 0;
    let failed = 0;
    
    entries.forEach(entry => {
      if (!entry.isDirectory()) return;
      
      const mcpPath = path.join(MCP_FOLDER, entry.name);
      const packageJsonPath = path.join(mcpPath, 'package.json');
      
      if (!fs.existsSync(packageJsonPath)) {
        console.log(`⏭️  Skipping ${entry.name} (no package.json)`);
        skipped++;
        return;
      }
      
      console.log(`📦 Installing ${entry.name}...`);
      
      try {
        // Check if node_modules exists
        const nodeModulesPath = path.join(mcpPath, 'node_modules');
        if (fs.existsSync(nodeModulesPath)) {
          console.log(`   ✅ Already installed`);
          installed++;
          return;
        }
        
        // Run npm install
        execSync('npm install --no-audit --no-fund', {
          cwd: mcpPath,
          stdio: 'inherit'
        });
        
        console.log(`   ✅ Installed successfully`);
        installed++;
      } catch (error) {
        console.log(`   ❌ Failed: ${error.message}`);
        failed++;
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Installed: ${installed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
  }

  startMCP(mcpName) {
    console.log(`🚀 Starting ${mcpName}...`);
    
    const mcpPath = path.join(MCP_FOLDER, mcpName);
    if (!fs.existsSync(mcpPath)) {
      console.log(`❌ MCP not found: ${mcpName}`);
      return;
    }
    
    const packageJsonPath = path.join(mcpPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      console.log(`❌ No package.json found for ${mcpName}`);
      return;
    }
    
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Determine start command
      let command = 'npm';
      let args = ['start'];
      
      if (pkg.scripts && pkg.scripts.dev) {
        args = ['run', 'dev'];
      } else if (pkg.scripts && pkg.scripts.start) {
        args = ['start'];
      } else if (fs.existsSync(path.join(mcpPath, 'index.js'))) {
        command = 'node';
        args = ['index.js'];
      } else if (fs.existsSync(path.join(mcpPath, 'server.js'))) {
        command = 'node';
        args = ['server.js'];
      } else if (fs.existsSync(path.join(mcpPath, 'main.js'))) {
        command = 'node';
        args = ['main.js'];
      }
      
      console.log(`   Command: ${command} ${args.join(' ')}`);
      
      const proc = spawn(command, args, {
        cwd: mcpPath,
        stdio: 'inherit',
        shell: true
      });
      
      this.processes.set(mcpName, proc);
      
      proc.on('close', (code) => {
        console.log(`\n[${mcpName}] Process exited with code ${code}`);
        this.processes.delete(mcpName);
      });
      
      proc.on('error', (err) => {
        console.error(`[${mcpName}] Error:`, err.message);
        this.processes.delete(mcpName);
      });
      
      console.log(`✅ Started ${mcpName} (PID: ${proc.pid})`);
      console.log(`   Press Ctrl+C to stop`);
      
    } catch (error) {
      console.error(`❌ Failed to start ${mcpName}:`, error.message);
    }
  }

  stopMCP(mcpName) {
    const proc = this.processes.get(mcpName);
    
    if (!proc) {
      console.log(`❌ MCP not running: ${mcpName}`);
      return;
    }
    
    console.log(`🛑 Stopping ${mcpName}...`);
    proc.kill('SIGTERM');
    this.processes.delete(mcpName);
    console.log(`✅ Stopped ${mcpName}`);
  }

  status() {
    console.log('📊 MCP Status:\n');
    
    if (this.processes.size === 0) {
      console.log('No MCPs currently running');
      return;
    }
    
    for (const [name, proc] of this.processes) {
      const alive = !proc.killed;
      console.log(`🔸 ${name}`);
      console.log(`   PID: ${proc.pid}`);
      console.log(`   Status: ${alive ? '✅ Running' : '❌ Stopped'}`);
      console.log(`   Exit Code: ${proc.exitCode || 'N/A'}`);
      console.log();
    }
  }
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];
const param = args[1];

const manager = new MCPManager();

switch (command) {
  case 'list':
    manager.listMCPS();
    break;
    
  case 'install':
    manager.installDependencies();
    break;
    
  case 'start':
    if (!param) {
      console.log('Usage: node mcp-manager.js start <mcp-name>');
      console.log('Example: node mcp-manager.js start voicebox-main');
      process.exit(1);
    }
    manager.startMCP(param);
    break;
    
  case 'stop':
    if (!param) {
      console.log('Usage: node mcp-manager.js stop <mcp-name>');
      process.exit(1);
    }
    manager.stopMCP(param);
    break;
    
  case 'status':
    manager.status();
    break;
    
  default:
    console.log('🔮 MCP Manager - Manage your MCP servers\n');
    console.log('Usage:');
    console.log('  node mcp-manager.js list          # List all MCPs');
    console.log('  node mcp-manager.js install       # Install dependencies');
    console.log('  node mcp-manager.js start <name>  # Start specific MCP');
    console.log('  node mcp-manager.js stop <name>   # Stop specific MCP');
    console.log('  node mcp-manager.js status        # Show running status');
    console.log('\nExamples:');
    console.log('  node mcp-manager.js list');
    console.log('  node mcp-manager.js install');
    console.log('  node mcp-manager.js start voicebox-main');
    console.log('  node mcp-manager.js stop voicebox-main');
    break;
}