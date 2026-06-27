// Types for the Autonomous Agent Sandbox

export interface Agent {
  id: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  icon: string | null;
  color: string | null;
  enabled: boolean;
  config: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { executions: number };
}

export interface Phase {
  id: string;
  projectId: string;
  name: string;
  displayName: string;
  description: string | null;
  order: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  outputs?: PhaseOutput[];
}

export interface PhaseOutput {
  id: string;
  phaseId: string;
  agentName: string;
  outputType: string;
  content: string;
  confidence: number | null;
  metadata: string | null;
  createdAt: Date;
}

export interface AgentExecution {
  id: string;
  projectId: string;
  phaseId: string;
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout';
  input: string | null;
  output: string | null;
  error: string | null;
  duration: number | null;
  tokensUsed: number | null;
  cost: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  agent?: Agent;
}

export interface Portfolio {
  id: string;
  projectId: string;
  cash: number;
  totalValue: number;
  dayPnL: number;
  totalPnL: number;
  sharpeRatio: number | null;
  var95: number | null;
  maxDrawdown: number | null;
  createdAt: Date;
  updatedAt: Date;
  positions?: Position[];
  transactions?: Transaction[];
}

export interface Position {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number | null;
  marketValue: number | null;
  unrealizedPnL: number | null;
  openedAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  portfolioId: string;
  symbol: string;
  type: 'buy' | 'sell' | 'dividend' | 'split';
  quantity: number;
  price: number;
  total: number;
  executedBy: string;
  ervDecision: string | null;
  executedAt: Date;
}

export interface HumanApproval {
  id: string;
  projectId: string;
  ervDecisionId: string;
  requester: string;
  action: string;
  context: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  expiresAt: Date | null;
  project?: { name: string };
  ervDecision?: ERVDecision;
}

export interface ERVDecision {
  id: string;
  policyId: string | null;
  phaseOutputId: string;
  action: 'execute' | 'refuse' | 'verify';
  reasoning: string;
  confidence: number | null;
  context: string | null;
  overridden: boolean;
  overriddenBy: string | null;
  overriddenAt: Date | null;
  createdAt: Date;
}

export interface AgentMessage {
  id: string;
  projectId: string;
  fromAgent: string;
  toAgent: string;
  messageType: 'request' | 'response' | 'notification' | 'verification';
  action: string;
  payload: string;
  status: 'sent' | 'delivered' | 'processed' | 'failed';
  priority: number;
  createdAt: Date;
  processedAt: Date | null;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: 'draft' | 'running' | 'paused' | 'completed' | 'failed';
  mode: 'simulation' | 'live';
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  phases?: Phase[];
  executions?: AgentExecution[];
  portfolio?: Portfolio | null;
  approvals?: HumanApproval[];
  messages?: AgentMessage[];
}

export interface WebSocketEvents {
  'agents:definitions': Agent[];
  'project:created': { project: Project };
  'project:started': { projectId: string; phases: Phase[] };
  'project:completed': { projectId: string };
  'projects:list': Project[];
  'project:details': Project;
  'phase:started': { projectId: string; phaseId: string; phaseName: string };
  'phase:completed': { projectId: string; phaseId: string; phaseName: string };
  'phase:failed': { projectId: string; phaseId: string; error: string };
  'agent:started': { projectId: string; phaseId: string; agentName: string; executionId: string };
  'agent:completed': { projectId: string; phaseId: string; agentName: string; executionId: string; output: string; ervDecision: string; duration: number };
  'agent:failed': { projectId: string; phaseId: string; agentName: string; executionId: string; error: string };
  'agent:message': AgentMessage;
  'approval:required': { projectId: string; agentName: string; action: string; reasoning: string };
  'approval:resolved': { approval: HumanApproval; approved: boolean };
  'error': { message: string; error: string };
}
