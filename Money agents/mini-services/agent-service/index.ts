/**
 * Agent Service - WebSocket Server & Agent Execution Engine
 * 
 * This service handles:
 * - Real-time WebSocket communication with frontend
 * - Agent execution orchestration via LLM
 * - ERV policy evaluation
 * - Message routing between agents
 * 
 * Database operations are delegated to the main app's API routes
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import { randomUUID } from 'crypto';
import ZAI from 'z-ai-web-dev-sdk';

const PORT = 3003;
const MAIN_APP_URL = 'http://localhost:3000';

// ============================================================================
// TYPES
// ============================================================================

interface AgentMessage {
  id: string;
  projectId: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'request' | 'response' | 'notification' | 'verification';
  action: string;
  payload: Record<string, unknown>;
  priority: number;
  timestamp: Date;
}

interface ProjectState {
  id: string;
  status: string;
  currentPhase: number;
  phases: PhaseState[];
}

interface PhaseState {
  id: string;
  name: string;
  status: string;
  outputs: Record<string, unknown>[];
}

interface AgentDefinition {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  systemPrompt: string;
}

// ============================================================================
// AGENT DEFINITIONS
// ============================================================================

const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    name: 'sentinel',
    displayName: 'Sentinel',
    description: 'Macro-economic analyst that monitors market trends and economic indicators',
    icon: 'Radar',
    color: 'text-blue-500',
    systemPrompt: `You are Sentinel, a macro-economic analysis agent. Your role is to:
- Analyze market trends and economic indicators
- Identify potential risks and opportunities
- Provide insights on macro-economic conditions
- Monitor GDP, inflation, interest rates, and employment data
- Generate economic forecasts based on available data`
  },
  {
    name: 'cipher',
    displayName: 'Cipher',
    description: 'Quantitative analyst that runs financial models and simulations',
    icon: 'Calculator',
    color: 'text-purple-500',
    systemPrompt: `You are Cipher, a quantitative analysis agent. Your role is to:
- Execute quantitative models (Monte Carlo, DCF, etc.)
- Calculate financial metrics and valuations
- Run risk simulations and scenario analysis
- Generate probability distributions
- Perform statistical analysis on financial data`
  },
  {
    name: 'guardian',
    displayName: 'Guardian',
    description: 'Security and compliance monitor that validates agent outputs',
    icon: 'Shield',
    color: 'text-red-500',
    systemPrompt: `You are Guardian, a security and compliance agent. Your role is to:
- Scan outputs for security violations
- Enforce compliance rules and policies
- Validate data integrity and accuracy
- Flag suspicious or anomalous activities
- Ensure adherence to regulatory requirements`
  },
  {
    name: 'oracle',
    displayName: 'Oracle',
    description: 'Strategic synthesizer that aggregates insights and provides recommendations',
    icon: 'Sparkles',
    color: 'text-amber-500',
    systemPrompt: `You are Oracle, a strategic synthesis agent. Your role is to:
- Aggregate outputs from other agents
- Synthesize strategic recommendations
- Identify patterns and correlations
- Generate executive summaries
- Provide actionable insights for decision-making`
  },
  {
    name: 'vector',
    displayName: 'Vector',
    description: 'Marketing analyst that models customer acquisition and lifetime value',
    icon: 'TrendingUp',
    color: 'text-green-500',
    systemPrompt: `You are Vector, a marketing analysis agent. Your role is to:
- Model customer acquisition costs (CAC)
- Calculate customer lifetime value (LTV)
- Analyze marketing funnel performance
- Forecast revenue growth
- Optimize marketing spend allocation`
  },
  {
    name: 'ledger',
    displayName: 'Ledger',
    description: 'Compliance and audit agent that ensures regulatory adherence',
    icon: 'BookOpen',
    color: 'text-indigo-500',
    systemPrompt: `You are Ledger, a compliance and audit agent. Your role is to:
- Verify compliance with regulations
- Maintain audit trails and records
- Check against rule engines and policies
- Generate compliance reports
- Ensure proper documentation of all actions`
  }
];

// ============================================================================
// PROJECT PHASES CONFIGURATION
// ============================================================================

const PROJECT_PHASES = [
  { name: 'research', displayName: 'Research', description: 'Market research and data gathering', agents: ['sentinel'] },
  { name: 'analysis', displayName: 'Analysis', description: 'Quantitative and qualitative analysis', agents: ['cipher', 'vector'] },
  { name: 'validation', displayName: 'Validation', description: 'Security and compliance validation', agents: ['guardian', 'ledger'] },
  { name: 'synthesis', displayName: 'Synthesis', description: 'Strategic synthesis and recommendations', agents: ['oracle'] },
  { name: 'execution', displayName: 'Execution', description: 'Action execution and monitoring', agents: ['oracle'] }
];

// ============================================================================
// ERV POLICY ENGINE
// ============================================================================

const DEFAULT_POLICIES = [
  {
    name: 'High-Value Trade Verification',
    category: 'financial',
    pattern: 'trade.*value.*[0-9]{6,}',
    action: 'verify' as const,
    priority: 100,
    description: 'Trades over $100,000 require human verification'
  },
  {
    name: 'Block Unauthorized API Access',
    category: 'security',
    pattern: 'access.*(admin|root|system)',
    action: 'refuse' as const,
    priority: 200,
    description: 'Block attempts to access system resources'
  },
  {
    name: 'Data Export Verification',
    category: 'compliance',
    pattern: 'export.*(data|customer|user)',
    action: 'verify' as const,
    priority: 100,
    description: 'Data exports require human verification'
  },
  {
    name: 'Standard Operations',
    category: 'operational',
    pattern: '.*',
    action: 'execute' as const,
    priority: 0,
    description: 'Default policy: allow standard operations'
  }
];

async function evaluateERV(action: string, context: Record<string, unknown>): Promise<{
  decision: 'execute' | 'refuse' | 'verify';
  reasoning: string;
  confidence: number;
}> {
  // Check policies in priority order
  const sortedPolicies = [...DEFAULT_POLICIES].sort((a, b) => b.priority - a.priority);
  
  for (const policy of sortedPolicies) {
    const regex = new RegExp(policy.pattern, 'i');
    if (regex.test(action)) {
      return {
        decision: policy.action,
        reasoning: `Matched policy: ${policy.name}. ${policy.description}`,
        confidence: 0.85
      };
    }
  }
  
  // Default: execute with low confidence
  return {
    decision: 'execute',
    reasoning: 'No specific policy matched. Defaulting to execute.',
    confidence: 0.5
  };
}

// ============================================================================
// API HELPERS
// ============================================================================

async function apiGet(endpoint: string) {
  const response = await fetch(`${MAIN_APP_URL}${endpoint}`);
  return response.json();
}

async function apiPost(endpoint: string, data: unknown) {
  const response = await fetch(`${MAIN_APP_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

async function apiPatch(endpoint: string, data: unknown) {
  const response = await fetch(`${MAIN_APP_URL}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return response.json();
}

// ============================================================================
// AGENT EXECUTOR
// ============================================================================

async function executeAgent(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  agentName: string,
  task: string,
  context: Record<string, unknown>
): Promise<{
  output: string;
  tokensUsed: number;
  cost: number;
}> {
  const agent = AGENT_DEFINITIONS.find(a => a.name === agentName);
  if (!agent) {
    throw new Error(`Unknown agent: ${agentName}`);
  }
  
  const completion = await zai.chat.completions.create({
    messages: [
      { role: 'system', content: agent.systemPrompt },
      { 
        role: 'user', 
        content: `Task: ${task}\n\nContext: ${JSON.stringify(context, null, 2)}` 
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });
  
  const output = completion.choices[0]?.message?.content || '';
  const tokensUsed = completion.usage?.total_tokens || 0;
  const estimatedCost = tokensUsed * 0.00001;
  
  return { output, tokensUsed, cost: estimatedCost };
}

// ============================================================================
// WEBSOCKET SERVER
// ============================================================================

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Track active projects and their states
const activeProjects = new Map<string, ProjectState>();

io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);
  
  // Send agent definitions to new client
  socket.emit('agents:definitions', AGENT_DEFINITIONS);
  
  // Handle project start
  socket.on('project:start', async (projectId: string) => {
    try {
      console.log(`[WS] Starting project: ${projectId}`);
      
      // Get project details from API
      const project = await apiGet(`/api/projects/${projectId}`);
      
      if (!project || project.error) {
        socket.emit('error', { message: 'Project not found', error: project?.error || 'Unknown error' });
        return;
      }
      
      // Initialize project state
      const projectState: ProjectState = {
        id: projectId,
        status: 'running',
        currentPhase: 0,
        phases: (project.phases || []).map((p: { id: string; name: string; status: string }) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          outputs: []
        }))
      };
      activeProjects.set(projectId, projectState);
      
      // Notify clients
      io.emit('project:started', { projectId, phases: project.phases });
      
      // Start first phase
      await executePhase(projectId, 0);
      
    } catch (error) {
      console.error('[WS] Error starting project:', error);
      socket.emit('error', { message: 'Failed to start project', error: String(error) });
    }
  });
  
  // Handle project list request
  socket.on('projects:list', async () => {
    try {
      const projects = await apiGet('/api/projects');
      socket.emit('projects:list', projects);
    } catch (error) {
      socket.emit('error', { message: 'Failed to fetch projects', error: String(error) });
    }
  });
  
  // Handle project details request
  socket.on('project:details', async (projectId: string) => {
    try {
      const project = await apiGet(`/api/projects/${projectId}`);
      socket.emit('project:details', project);
    } catch (error) {
      socket.emit('error', { message: 'Failed to fetch project', error: String(error) });
    }
  });
  
  // Handle human approval
  socket.on('approval:respond', async (data: { approvalId: string; approved: boolean; notes?: string }) => {
    try {
      const result = await apiPatch('/api/approvals', {
        approvalId: data.approvalId,
        approved: data.approved,
        notes: data.notes
      });
      
      io.emit('approval:resolved', { approval: result, approved: data.approved });
      
    } catch (error) {
      socket.emit('error', { message: 'Failed to process approval', error: String(error) });
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ============================================================================
// PHASE EXECUTION
// ============================================================================

async function executePhase(projectId: string, phaseIndex: number): Promise<void> {
  const projectState = activeProjects.get(projectId);
  if (!projectState || phaseIndex >= projectState.phases.length) {
    // Project complete
    await completeProject(projectId);
    return;
  }
  
  const phase = projectState.phases[phaseIndex];
  const phaseConfig = PROJECT_PHASES[phaseIndex];
  
  console.log(`[Phase] Starting phase ${phaseIndex}: ${phase.name}`);
  
  io.emit('phase:started', { projectId, phaseId: phase.id, phaseName: phase.name });
  
  try {
    // Initialize ZAI
    const zai = await ZAI.create();
    
    // Execute agents for this phase
    for (const agentName of phaseConfig.agents) {
      await executeAgentForPhase(zai, projectId, phase.id, agentName, phase.name);
    }
    
    io.emit('phase:completed', { projectId, phaseId: phase.id, phaseName: phase.name });
    
    // Continue to next phase
    projectState.currentPhase = phaseIndex + 1;
    await executePhase(projectId, phaseIndex + 1);
    
  } catch (error) {
    console.error(`[Phase] Error in phase ${phase.name}:`, error);
    io.emit('phase:failed', { projectId, phaseId: phase.id, error: String(error) });
  }
}

async function executeAgentForPhase(
  zai: Awaited<ReturnType<typeof ZAI.create>>,
  projectId: string,
  phaseId: string,
  agentName: string,
  phaseName: string
): Promise<void> {
  console.log(`[Agent] Starting ${agentName} for phase ${phaseName}`);
  
  const executionId = randomUUID();
  
  io.emit('agent:started', { 
    projectId, 
    phaseId, 
    agentName, 
    executionId 
  });
  
  try {
    // Build task based on agent and phase
    const task = `Perform ${phaseName} analysis for the project. Provide detailed insights and recommendations.`;
    const context = { phaseName, previousPhase: phaseName };
    
    // Execute agent
    const startTime = Date.now();
    const result = await executeAgent(zai, agentName, task, context);
    const duration = Date.now() - startTime;
    
    // Evaluate ERV
    const ervResult = await evaluateERV(`${agentName}:${phaseName}`, { output: result.output });
    
    console.log(`[Agent] ${agentName} completed - ERV: ${ervResult.decision}`);
    
    io.emit('agent:completed', { 
      projectId, 
      phaseId, 
      agentName, 
      executionId,
      output: result.output,
      ervDecision: ervResult.decision,
      duration,
      tokensUsed: result.tokensUsed
    });
    
    // Handle VERIFY decision - create human approval request
    if (ervResult.decision === 'verify') {
      io.emit('approval:required', { 
        projectId, 
        agentName, 
        action: `${agentName}:${phaseName}`,
        reasoning: ervResult.reasoning,
        output: result.output
      });
    }
    
  } catch (error) {
    console.error(`[Agent] Error in ${agentName}:`, error);
    
    io.emit('agent:failed', { 
      projectId, 
      phaseId, 
      agentName, 
      executionId,
      error: String(error)
    });
  }
}

async function completeProject(projectId: string): Promise<void> {
  console.log(`[Project] Completed: ${projectId}`);
  activeProjects.delete(projectId);
  io.emit('project:completed', { projectId });
}

// ============================================================================
// INITIALIZE & START
// ============================================================================

async function main() {
  console.log('[Agent Service] Initializing...');
  console.log('[Agent Service] Available agents:', AGENT_DEFINITIONS.map(a => a.name).join(', '));
  
  // Start HTTP server
  httpServer.listen(PORT, () => {
    console.log(`[Agent Service] WebSocket server running on port ${PORT}`);
  });
}

main().catch(console.error);

process.on('SIGINT', () => {
  console.log('[Agent Service] Shutting down...');
  process.exit(0);
});
