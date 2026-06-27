#!/usr/bin/env node
/**
 * Demo: Megacode MCP Capabilities
 * 
 * This script demonstrates the end-to-end functionality of Megacode
 * with integrated MCP servers.
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

async function demo() {
    console.log('═'.repeat(60));
    console.log('🔮 MEGACODE MCP DEMONSTRATION');
    console.log('═'.repeat(60));
    
    try {
        // 1. Check server status
        console.log('\n1️⃣  Checking Megacode Server Status...');
        const status = await fetchJSON(`${BASE_URL}/api/tools/status`);
        console.log(`   ✅ Server available: ${status.available}`);
        console.log(`   ✅ Tools count: ${status.toolsCount}`);
        console.log(`   ✅ IDE connected: ${status.ideConnected}`);
        
        // 2. List all tools
        console.log('\n2️⃣  Listing Available Tools...');
        const tools = await fetchJSON(`${BASE_URL}/api/tools`);
        console.log(`   ✅ Total tools: ${tools.tools.length}`);
        
        const mcpTools = tools.tools.filter(t => t.source === 'mcp');
        const ideTools = tools.tools.filter(t => t.source === 'ide');
        console.log(`   ✅ MCP tools: ${mcpTools.length}`);
        console.log(`   ✅ IDE tools: ${ideTools.length}`);
        
        // 3. Group MCP tools by server
        const mcpByServer = {};
        mcpTools.forEach(tool => {
            // Extract server name from tool ID (mcp.tool_name format)
            const serverMatch = tool.description?.match(/from MCP server: (.+)/);
            if (serverMatch) {
                const server = serverMatch[1];
                mcpByServer[server] = (mcpByServer[server] || 0) + 1;
            }
        });
        
        console.log('\n3️⃣  MCP Servers Connected:');
        Object.entries(mcpByServer).forEach(([server, count]) => {
            console.log(`   🔌 ${server}: ${count} tools`);
        });
        
        // 4. Test Business Logic MCP
        console.log('\n4️⃣  Testing Business Logic MCP...');
        const bizLogicResult = await fetchJSON(`${BASE_URL}/api/tools/execute`, {
            method: 'POST',
            body: JSON.stringify({
                toolId: 'mcp.list_operations',
                params: {}
            })
        });
        
        if (bizLogicResult.ok) {
            const content = bizLogicResult.result.result.content[0].text;
            const operations = JSON.parse(content);
            console.log(`   ✅ Business operations listed: ${operations.length} operations`);
            console.log(`   📋 Sample: ${operations[0]?.operation || 'N/A'}`);
        }
        
        // 5. Test OG Glass UI MCP
        console.log('\n5️⃣  Testing OG Glass UI MCP...');
        const styleResult = await fetchJSON(`${BASE_URL}/api/tools/execute`, {
            method: 'POST',
            body: JSON.stringify({
                toolId: 'mcp.suggest_style',
                params: {
                    description: 'dark futuristic AI development tool',
                    output_format: 'full'
                }
            })
        });
        
        if (styleResult.ok) {
            const content = styleResult.result.result.content[0].text;
            const suggestion = JSON.parse(content);
            console.log(`   ✅ Style suggestion: ${suggestion.preset_id}`);
            console.log(`   🎨 Confidence: ${suggestion.confidence}`);
        }
        
        // 6. Test UFC File Converter MCP
        console.log('\n6️⃣  Testing UFC File Converter MCP...');
        const formatsResult = await fetchJSON(`${BASE_URL}/api/tools/execute`, {
            method: 'POST',
            body: JSON.stringify({
                toolId: 'mcp.get_supported_formats',
                params: {}
            })
        });
        
        if (formatsResult.ok) {
            const content = formatsResult.result.result.content[0].text;
            const formats = JSON.parse(content);
            console.log(`   ✅ Supported formats:`);
            console.log(`      🎵 Audio: ${formats.audio?.join(', ').substring(0, 40)}...`);
            console.log(`      🎬 Video: ${formats.video?.join(', ').substring(0, 40)}...`);
            console.log(`      🖼️  Image: ${formats.image?.join(', ').substring(0, 40)}...`);
        }
        
        // 7. Show sales page info
        console.log('\n7️⃣  Megacode Sales Website:');
        console.log(`   🌐 Sales page: ${BASE_URL}/sales`);
        console.log(`   💻 Main UI: ${BASE_URL}`);
        console.log(`   🔧 API Status: ${BASE_URL}/api/status`);
        
        // 8. Summary
        console.log('\n' + '═'.repeat(60));
        console.log('🎉 DEMONSTRATION COMPLETE');
        console.log('═'.repeat(60));
        console.log('\nMegacode now provides:');
        console.log(`  • ${status.toolsCount} total development tools`);
        console.log(`  • ${mcpTools.length} MCP tools across ${Object.keys(mcpByServer).length} servers`);
        console.log(`  • ${ideTools.length} built-in IDE tools`);
        console.log(`  • Full-stack development capabilities`);
        console.log(`  • Real MCP protocol implementation`);
        console.log(`  • End-to-end tool execution`);
        console.log(`\nVisit ${BASE_URL}/sales to see the sales website!`);
        
    } catch (error) {
        console.error('\n❌ Demo failed:', error.message);
        console.error('\nMake sure Megacode server is running:');
        console.error('  cd products/Megacode-main');
        console.error('  npm run ui');
        process.exit(1);
    }
}

async function fetchJSON(url, options = {}) {
    const urlObj = new URL(url);
    const opts = {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        }
    };
    
    if (options.body) {
        opts.body = options.body;
    }
    
    return new Promise((resolve, reject) => {
        const req = http.request(urlObj, opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
                }
            });
        });
        
        req.on('error', reject);
        if (options.body) {
            req.write(options.body);
        }
        req.end();
    });
}

// Run demo
demo().catch(console.error);