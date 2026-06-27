# 🔮 Megacode Full-Stack System

**One unified system for complete software development** - from voice chat to game animation, with automatic project assessment and workflow sequencing.

## 🚀 Quick Start

```bash
# Windows
start-fullstack.bat

# Manual start
npm run esbuild:build
node mcp-autoloader.js
node ui/server.js
```

Then open: **http://localhost:3000**

## 🎯 What This System Does

### 1. **Auto-Discovers & Loads All MCPs**
- Scans `MCP/` folder for servers
- Auto-starts: Voicebox, GameAnimation64, Business Logic, etc.
- Creates unified tool registry

### 2. **Project Assessment on Open**
- When you open a project folder:
  - Scans structure and files
  - Analyzes dependencies
  - Checks for configuration
  - Identifies issues
  - Generates recommendations

### 3. **8-Step Workflow Sequence**
1. **Assessment** - Analyze project
2. **Planning** - Design architecture  
3. **Backend** - Database & APIs
4. **Frontend** - UI components
5. **Game/Animation** - Visual effects
6. **Integration** - Connect everything
7. **Voice** - Add voice commands
8. **Testing** - Test & deploy

### 4. **Voice Chat Integration**
- Talk to Megacode via Voicebox
- Natural language commands
- Voice feedback for actions

## 📁 MCP Toolbox

Your `MCP/` folder contains:

| MCP | Type | Purpose |
|-----|------|---------|
| **voicebox-main** | Voice | Speech synthesis & recognition |
| **GameAnimation64-main** | Game | Game logic & animation system |
| **Business-Logic-MCP-main** | Business | Backend logic & APIs |
| **Middle-Man-MCP-main** | Orchestration | System coordination |
| **BigBack--main** | Database | Database operations |
| **OG-Glass-main** | UI | User interface components |
| **Monaco-Bluetooth--main** | Connectivity | Device connections |
| **UFC-MCP-main** | Real-time | Live data & APIs |
| **Bobby-Breakdown--main** | Analysis | Code analysis |
| **lucide-main** | Icons | Icon library |
| **ruvector-main** | Vector | Embeddings & search |

## 🎮 Features

### **Editor Mode**
- Real Monaco editor with tabs
- File tree browser
- Git integration
- Terminal panel
- Apply AI code directly

### **Chat Mode**
- Multi-LLM providers (DeepSeek, OpenAI, etc.)
- Task type routing
- Code quality scoring
- Safety checks
- Glossary & explanations

### **Full-Stack Tools**
- **🔍 Assess** - Project assessment modal
- **📋 Workflow** - Step-by-step development
- **🔌 MCP** - Server status monitor
- **🏥 Health** - Provider status
- **📖 Glossary** - Plain language explanations
- **🏗️ Scaffold** - Project scaffolding
- **🔍 Deps** - Dependency advisor

## 🔄 Workflow Example

**Starting in the middle of a project:**
1. Open project folder
2. **Auto-assessment runs** → finds issues
3. Review assessment results
4. Follow workflow sequence:
   - Fix backend issues (Business Logic MCP)
   - Update UI (OG-Glass MCP)
   - Add animations (GameAnimation64)
   - Integrate voice (Voicebox)
5. Test & deploy

**Starting new project:**
1. Open empty folder
2. Assessment suggests structure
3. Use Scaffold tool
4. Follow workflow from step 1

## 🎤 Voice Commands

With Voicebox integration:
- "Hey Megacode, analyze this project"
- "Create a React component for user profile"
- "Fix the TypeScript errors in utils.ts"
- "Deploy to production"
- "Show me the workflow"

## ⚙️ Configuration

### Auto-Loader Config
Generated: `.mcp-autoload.json`
```json
{
  "mcpServers": [
    {
      "id": "voicebox",
      "name": "voicebox",
      "type": "voice",
      "command": "npm",
      "args": ["run", "dev"],
      "cwd": "MCP/voicebox-main"
    }
    // ... all discovered MCPs
  ]
}
```

### Custom Workflow
Edit workflow in `ui/server.js`:
```javascript
const workflowSequence = [
  {
    id: 'custom-step',
    name: 'My Custom Step',
    description: 'Custom workflow step',
    tools: ['my-mcp-tool']
  }
];
```

## 🛠️ Development

### Adding New MCPs
1. Add to `MCP/` folder
2. Restart system
3. Auto-detected on next launch

### Extending Assessment
Edit `runProjectAssessment()` in `ui/server.js`:
```javascript
// Add custom checks
assessment.customCheck = await runCustomCheck(projectPath);
```

### Creating Workflow Steps
Add to `executeWorkflowStep()`:
```javascript
case 'my-step':
  result.actions.push({ action: 'my_action', status: 'started' });
  // Your logic here
  result.actions[0].status = 'completed';
  break;
```

## 📊 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/assessment/template` | GET | Assessment template |
| `/api/assessment/run` | POST | Run assessment |
| `/api/workflow/sequence` | GET | Get workflow |
| `/api/workflow/execute-step` | POST | Execute step |
| `/api/mcp/status` | GET | MCP server status |
| `/api/tools` | GET | All tools |
| `/api/files/tree` | GET | File tree |
| `/api/git/status` | GET | Git status |
| `/api/terminal/exec` | POST | Run command |

## 🚨 Troubleshooting

### MCPs Not Starting
- Check `node_modules` in each MCP folder
- Run `npm install` in problematic MCPs
- Check console for errors

### Assessment Not Running
- Verify workspace is opened
- Check browser console
- Ensure server is running

### Voicebox Issues
- Check Voicebox is running
- Verify microphone permissions
- Check browser audio settings

## 🎯 Ideal Use Cases

1. **Game Development** - Use GameAnimation64 + Voicebox
2. **Web Apps** - Business Logic + OG-Glass
3. **API Services** - Business Logic + BigBack
4. **Animation Projects** - GameAnimation64 + UI tools
5. **Voice Apps** - Voicebox + Business Logic

## 📈 Next Steps

1. **Try it**: `start-fullstack.bat`
2. **Open a project**: Click "Open Folder"
3. **Run assessment**: Click "🔍 Assess"
4. **Follow workflow**: Click "📋 Workflow"
5. **Add voice**: Talk via Voicebox

---

**Built for:** Complete software development in one unified system  
**Philosophy:** Start anywhere, assessment first, workflow always  
**Goal:** Make full-stack development seamless and voice-native