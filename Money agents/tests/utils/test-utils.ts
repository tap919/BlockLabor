/**
 * Test Utilities and Mock Factories
 * Provides helper functions and mock data generators for tests
 */

// ============================================
// Mock Data Factories
// ============================================

export const mockProject = (overrides: Partial<any> = {}) => ({
  id: `project_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Project',
  description: 'Test project description',
  status: 'draft',
  mode: 'simulation',
  createdBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  startedAt: null,
  completedAt: null,
  ...overrides,
});

export const mockPhase = (overrides: Partial<any> = {}) => ({
  id: `phase_${Math.random().toString(36).substr(2, 9)}`,
  projectId: 'project_test',
  name: 'research',
  displayName: 'Research',
  description: 'Market research phase',
  order: 0,
  status: 'pending',
  startedAt: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockAgent = (overrides: Partial<any> = {}) => ({
  id: `agent_${Math.random().toString(36).substr(2, 9)}`,
  name: 'sentinel',
  displayName: 'Sentinel',
  description: 'Market surveillance agent',
  version: '1.0.0',
  icon: 'Radar',
  color: 'text-blue-500',
  enabled: true,
  config: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockAgentExecution = (overrides: Partial<any> = {}) => ({
  id: `exec_${Math.random().toString(36).substr(2, 9)}`,
  projectId: 'project_test',
  phaseId: 'phase_test',
  agentId: 'agent_test',
  status: 'pending',
  input: null,
  output: null,
  error: null,
  duration: null,
  tokensUsed: null,
  cost: null,
  startedAt: null,
  completedAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockPortfolio = (overrides: Partial<any> = {}) => ({
  id: `portfolio_${Math.random().toString(36).substr(2, 9)}`,
  projectId: 'project_test',
  cash: 100000,
  totalValue: 100000,
  dayPnL: 0,
  totalPnL: 0,
  sharpeRatio: null,
  var95: null,
  maxDrawdown: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockPosition = (overrides: Partial<any> = {}) => ({
  id: `position_${Math.random().toString(36).substr(2, 9)}`,
  portfolioId: 'portfolio_test',
  symbol: 'AAPL',
  quantity: 100,
  avgCost: 150.00,
  currentPrice: 155.00,
  marketValue: 15500,
  unrealizedPnL: 500,
  openedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockTransaction = (overrides: Partial<any> = {}) => ({
  id: `txn_${Math.random().toString(36).substr(2, 9)}`,
  portfolioId: 'portfolio_test',
  symbol: 'AAPL',
  type: 'buy',
  quantity: 100,
  price: 150.00,
  total: 15000,
  executedBy: 'oracle',
  ervDecision: null,
  executedAt: new Date().toISOString(),
  ...overrides,
});

export const mockERVDecision = (overrides: Partial<any> = {}) => ({
  id: `erv_${Math.random().toString(36).substr(2, 9)}`,
  policyId: null,
  phaseOutputId: 'output_test',
  action: 'execute',
  reasoning: 'Test reasoning',
  confidence: 0.85,
  context: '{}',
  overridden: false,
  overriddenBy: null,
  overriddenAt: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockERVPolicy = (overrides: Partial<any> = {}) => ({
  id: `policy_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Policy',
  description: 'Test policy description',
  category: 'financial',
  pattern: '.*',
  action: 'execute',
  priority: 0,
  conditions: null,
  enabled: true,
  createdBy: 'system',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockHumanApproval = (overrides: Partial<any> = {}) => ({
  id: `approval_${Math.random().toString(36).substr(2, 9)}`,
  projectId: 'project_test',
  ervDecisionId: 'erv_test',
  requester: 'oracle',
  action: 'execute_trade',
  context: '{}',
  status: 'pending',
  reviewedBy: null,
  reviewNotes: null,
  createdAt: new Date().toISOString(),
  reviewedAt: null,
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

export const mockAuditLog = (overrides: Partial<any> = {}) => ({
  id: `audit_${Math.random().toString(36).substr(2, 9)}`,
  projectId: 'project_test',
  executionId: null,
  userId: null,
  actor: 'system',
  action: 'test_action',
  resource: 'test_resource',
  details: '{}',
  hash: 'test_hash',
  previousHash: null,
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const mockUser = (overrides: Partial<any> = {}) => ({
  id: `user_${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  name: 'Test User',
  role: 'viewer',
  apiKey: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const mockFinancialData = (overrides: Partial<any> = {}) => ({
  id: `fd_${Math.random().toString(36).substr(2, 9)}`,
  symbol: 'AAPL',
  dataType: 'price',
  source: 'alpha_vantage',
  data: '{"price": 150.00}',
  fetchedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  ...overrides,
});

// ============================================
// Agent Definitions
// ============================================

export const AGENT_DEFINITIONS = [
  {
    name: 'sentinel',
    displayName: 'Sentinel',
    description: 'Market surveillance and anomaly detection agent',
    icon: 'Radar',
    color: 'text-blue-500',
  },
  {
    name: 'cipher',
    displayName: 'Cipher',
    description: 'Quantitative analysis and pattern recognition agent',
    icon: 'Calculator',
    color: 'text-purple-500',
  },
  {
    name: 'guardian',
    displayName: 'Guardian',
    description: 'Security validation and risk assessment agent',
    icon: 'Shield',
    color: 'text-red-500',
  },
  {
    name: 'oracle',
    displayName: 'Oracle',
    description: 'Predictive analytics and forecasting agent',
    icon: 'Sparkles',
    color: 'text-yellow-500',
  },
  {
    name: 'vector',
    displayName: 'Vector',
    description: 'Trade execution and portfolio optimization agent',
    icon: 'TrendingUp',
    color: 'text-green-500',
  },
  {
    name: 'ledger',
    displayName: 'Ledger',
    description: 'Audit trail and compliance verification agent',
    icon: 'BookOpen',
    color: 'text-gray-500',
  },
];

// ============================================
// Test Helpers
// ============================================

export const createMockPrismaClient = () => ({
  project: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  agent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  phase: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  agentExecution: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  phaseOutput: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  eRVDecision: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  eRVPolicy: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  humanApproval: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  portfolio: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  position: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  transaction: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  auditLog: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  user: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  financialData: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
  },
  systemConfig: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  apiQuota: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  agentMessage: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn()),
  $connect: jest.fn(),
  $disconnect: jest.fn(),
});

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateRandomString = (length: number = 10) => 
  Math.random().toString(36).substr(2, length);

export const generateRandomEmail = () => 
  `test_${generateRandomString(8)}@example.com`;

export const generateRandomSymbol = () => {
  const symbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM', 'V', 'WMT'];
  return symbols[Math.floor(Math.random() * symbols.length)];
};

// ============================================
// Assertion Helpers
// ============================================

export const assertValidUUID = (uuid: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  expect(uuid).toMatch(uuidRegex);
};

export const assertValidISODate = (date: string) => {
  const dateValue = new Date(date);
  expect(dateValue).toBeInstanceOf(Date);
  expect(dateValue.toString()).not.toBe('Invalid Date');
};

export const assertValidHash = (hash: string) => {
  // SHA-256 hash is 64 characters hex
  expect(hash).toHaveLength(64);
  expect(hash).toMatch(/^[0-9a-f]{64}$/i);
};

// ============================================
// Mock Socket Helper
// ============================================

export const createMockSocket = () => ({
  id: generateRandomString(),
  emit: jest.fn(),
  on: jest.fn(),
  once: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
  join: jest.fn(),
  leave: jest.fn(),
  to: jest.fn().mockReturnThis(),
  broadcast: {
    emit: jest.fn(),
  },
});
