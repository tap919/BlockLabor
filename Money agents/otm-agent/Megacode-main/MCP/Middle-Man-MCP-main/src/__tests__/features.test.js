'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const config = require('../config');
const { createTask, createFlow, runFlow, getFlowStatus, getAllFlows } = require('../features/workflowOrchestrator');
const { register, discover, list, updateHealth, deregister } = require('../features/serviceDiscovery');
const { defineInterface, getInterface, validateInterface, resolveConflict, listInterfaces } = require('../features/interfaceRegistry');
const { record, getProvenance, resolveWithProvenance, listTrackedKeys, clearProvenance, provenanceMiddleware } = require('../features/contextProvenance');
const { registerDomain, getDomain, listDomains, createDomainError, validateDomainRules, domainErrorHandler } = require('../features/domainErrorReporter');
const { listTemplates, getTemplate, generateFromTemplate, registerTemplate, validateParams, indent } = require('../features/codeGenerator');

// ─────────────────────────────────────────────
// Workflow Orchestrator
// ─────────────────────────────────────────────

describe('Workflow Orchestrator — createTask', () => {
  test('creates a task with name and fn', () => {
    const fn = async () => 'result';
    const task = createTask('myTask', fn);
    expect(task.name).toBe('myTask');
    expect(task.fn).toBe(fn);
  });

  test('throws on missing name', () => {
    expect(() => createTask('', async () => {})).toThrow(TypeError);
  });

  test('throws when fn is not a function', () => {
    expect(() => createTask('t', 'not-a-fn')).toThrow(TypeError);
  });
});

describe('Workflow Orchestrator — createFlow', () => {
  test('registers a flow and returns it', () => {
    const flow = createFlow('testFlow', [createTask('t1', async () => 1)]);
    expect(flow.name).toBe('testFlow');
    expect(flow.tasks).toHaveLength(1);
    expect(flow.createdAt).toBeDefined();
  });

  test('throws on empty flow name', () => {
    expect(() => createFlow('', [])).toThrow(TypeError);
  });

  test('throws when tasks is not an array', () => {
    expect(() => createFlow('f', null)).toThrow(TypeError);
  });
});

describe('Workflow Orchestrator — runFlow', () => {
  test('runs a successful flow and returns run record', async () => {
    createFlow('successFlow', [
      createTask('step1', async () => 'a'),
      createTask('step2', async (ctx) => ctx.step1 + 'b'),
    ]);
    const run = await runFlow('successFlow', {});
    expect(run.status).toBe('success');
    expect(run.tasks).toHaveLength(2);
    expect(run.tasks[0].status).toBe('success');
    expect(run.tasks[1].status).toBe('success');
    expect(typeof run.durationMs).toBe('number');
    expect(typeof run.tasks[0].durationMs).toBe('number');
  });

  test('marks flow and task failed when task throws', async () => {
    createFlow('failFlow', [
      createTask('goodTask', async () => 'ok'),
      createTask('badTask', async () => { throw new Error('oops'); }, { retry: { retries: 0 } }),
    ]);
    await expect(runFlow('failFlow', {})).rejects.toThrow('oops');
    const status = getFlowStatus('failFlow');
    expect(status.lastRun.status).toBe('failed');
    expect(status.lastRun.failedTask).toBe('badTask');
  });

  test('runId is a UUID v4', async () => {
    createFlow('uuidFlow', [createTask('noop', async () => {})]);
    const run = await runFlow('uuidFlow', {});
    expect(run.runId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  test('throws when flow does not exist', async () => {
    await expect(runFlow('nonExistent')).rejects.toThrow('Flow not found');
  });

  test('passes context between tasks', async () => {
    let receivedCtx;
    createFlow('ctxFlow', [
      createTask('producer', async () => 42),
      createTask('consumer', async (ctx) => { receivedCtx = ctx; return ctx.producer * 2; }),
    ]);
    const run = await runFlow('ctxFlow', { initial: true });
    expect(receivedCtx.producer).toBe(42);
    expect(receivedCtx.initial).toBe(true);
    expect(run.status).toBe('success');
  });
});

describe('Workflow Orchestrator — getFlowStatus / getAllFlows', () => {
  test('getFlowStatus returns null for unknown flow', () => {
    expect(getFlowStatus('unknownFlow')).toBeNull();
  });

  test('getAllFlows includes registered flows', () => {
    createFlow('listedFlow', [createTask('t', async () => {})]);
    const all = getAllFlows();
    const names = all.map((f) => f.name);
    expect(names).toContain('listedFlow');
  });
});

// ─────────────────────────────────────────────
// Service Discovery
// ─────────────────────────────────────────────

describe('Service Discovery — register / discover', () => {
  afterEach(() => {
    deregister('svc-test');
  });

  test('registers and discovers a service', () => {
    register('svc-test', 'http://svc-test:3000', { version: '1.0' });
    const svc = discover('svc-test');
    expect(svc.name).toBe('svc-test');
    expect(svc.url).toBe('http://svc-test:3000');
    expect(svc.metadata.version).toBe('1.0');
    expect(svc.healthy).toBe(true);
  });

  test('throws on invalid name', () => {
    expect(() => register('', 'http://x')).toThrow(TypeError);
  });

  test('throws on invalid url', () => {
    expect(() => register('x', '')).toThrow(TypeError);
  });

  test('discover throws for unknown service', () => {
    expect(() => discover('no-such-service')).toThrow('Service not found');
  });

  test('discover throws for unhealthy service', () => {
    register('svc-test', 'http://svc-test:3000');
    updateHealth('svc-test', false);
    expect(() => discover('svc-test')).toThrow('Service unhealthy');
  });
});

describe('Service Discovery — list / deregister', () => {
  test('list returns all registered services', () => {
    register('list-svc', 'http://list:3000');
    const names = list().map((s) => s.name);
    expect(names).toContain('list-svc');
    deregister('list-svc');
  });

  test('deregister removes the service', () => {
    register('to-remove', 'http://remove:9000');
    expect(deregister('to-remove')).toBe(true);
    expect(() => discover('to-remove')).toThrow('Service not found');
  });

  test('deregister returns false for unknown service', () => {
    expect(deregister('ghost')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Interface Registry
// ─────────────────────────────────────────────

describe('Interface Registry — defineInterface / getInterface', () => {
  test('defines and retrieves an interface', () => {
    const schema = { required: ['id'], properties: { id: { type: 'string' } } };
    defineInterface('IUser', schema);
    const iface = getInterface('IUser');
    expect(iface.name).toBe('IUser');
    expect(iface.schema).toEqual(schema);
  });

  test('returns null for undefined interface', () => {
    expect(getInterface('IDoesNotExist')).toBeNull();
  });

  test('throws on empty name', () => {
    expect(() => defineInterface('', {})).toThrow(TypeError);
  });

  test('throws on non-object schema', () => {
    expect(() => defineInterface('IBad', null)).toThrow(TypeError);
  });

  test('throws when schema.required is not an array', () => {
    expect(() => defineInterface('IBadRequired', { required: 'notAnArray' })).toThrow(TypeError);
  });

  test('throws when schema.properties is not a plain object', () => {
    expect(() => defineInterface('IBadProps', { properties: ['notAnObject'] })).toThrow(TypeError);
  });

  test('throws on invalid conflictResolution value', () => {
    expect(() => defineInterface('IBadCR', { conflictResolution: 'unknown-strategy' })).toThrow(TypeError);
  });

  test('accepts valid conflictResolution values', () => {
    expect(() => defineInterface('IValidCR1', { conflictResolution: 'last-write-wins' })).not.toThrow();
    expect(() => defineInterface('IValidCR2', { conflictResolution: 'first-write-wins' })).not.toThrow();
  });
});

describe('Interface Registry — validateInterface', () => {
  beforeAll(() => {
    defineInterface('IPayment', {
      required: ['amount', 'currency'],
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' },
      },
    });
  });

  test('returns valid for a correct payload', () => {
    const result = validateInterface('IPayment', { amount: 99.99, currency: 'USD' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('reports missing required fields', () => {
    const result = validateInterface('IPayment', { amount: 10 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('currency'))).toBe(true);
  });

  test('reports type mismatch', () => {
    const result = validateInterface('IPayment', { amount: 'not-a-number', currency: 'USD' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('amount'))).toBe(true);
  });

  test('throws for undefined interface', () => {
    expect(() => validateInterface('IUnknown', {})).toThrow('Interface not defined');
  });

  test('throws when payload is null', () => {
    expect(() => validateInterface('IPayment', null)).toThrow(TypeError);
  });

  test('throws when payload is undefined', () => {
    expect(() => validateInterface('IPayment', undefined)).toThrow(TypeError);
  });

  test('throws when payload is an array', () => {
    expect(() => validateInterface('IPayment', [])).toThrow(TypeError);
  });
});

describe('Interface Registry — resolveConflict', () => {
  test('last-write-wins (default) returns last source', () => {
    defineInterface('IConflict', {});
    expect(resolveConflict('IConflict', ['a', 'b', 'c'])).toBe('c');
  });

  test('first-write-wins returns first source', () => {
    defineInterface('IConflictFirst', { conflictResolution: 'first-write-wins' });
    expect(resolveConflict('IConflictFirst', ['x', 'y'])).toBe('x');
  });

  test('throws on empty sources array', () => {
    defineInterface('IEmpty', {});
    expect(() => resolveConflict('IEmpty', [])).toThrow(TypeError);
  });

  test('throws for undefined interface', () => {
    expect(() => resolveConflict('INoSuch', ['a'])).toThrow('Interface not defined');
  });
});

describe('Interface Registry — listInterfaces', () => {
  test('returns an array that includes defined interfaces', () => {
    defineInterface('IListTest', { operations: ['read', 'write'], required: ['id'] });
    const all = listInterfaces();
    const found = all.find((i) => i.name === 'IListTest');
    expect(found).toBeDefined();
    expect(found.operations).toContain('read');
    expect(found.required).toContain('id');
  });
});

// ─────────────────────────────────────────────
// HTTP Endpoints (integration)
// ─────────────────────────────────────────────

function authHeader() {
  const token = jwt.sign({ sub: 'test-user' }, config.jwt.secret, { expiresIn: '1h' });
  return `Bearer ${token}`;
}

describe('GET /api/orchestration/flows', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/orchestration/flows');
    expect(res.status).toBe(401);
  });

  test('returns JSON array with valid auth', async () => {
    const res = await request(app).get('/api/orchestration/flows').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/orchestration/flows/:name', () => {
  test('returns 404 for an unknown flow', async () => {
    const res = await request(app)
      .get('/api/orchestration/flows/__nonexistent__')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  test('returns 200 for a known flow', async () => {
    createFlow('endpointFlow', [createTask('t', async () => {})]);
    const res = await request(app)
      .get('/api/orchestration/flows/endpointFlow')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('endpointFlow');
  });
});

describe('GET /api/discovery/services', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/discovery/services');
    expect(res.status).toBe(401);
  });

  test('returns JSON array including auto-registered services', async () => {
    const res = await request(app)
      .get('/api/discovery/services')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const names = res.body.map((s) => s.name);
    // Config services should be auto-registered
    expect(names).toContain('users');
    expect(names).toContain('payments');
    expect(names).toContain('media');
  });
});

describe('GET /api/interfaces', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/interfaces');
    expect(res.status).toBe(401);
  });

  test('returns JSON array of registered interfaces with valid auth', async () => {
    const res = await request(app).get('/api/interfaces').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Context Provenance
// ─────────────────────────────────────────────

describe('Context Provenance — record / getProvenance', () => {
  afterEach(() => {
    clearProvenance('temp.key');
    clearProvenance('conflict.key');
  });

  test('records an entry and retrieves it', () => {
    record('temp.key', 42, 'sensor-A');
    const history = getProvenance('temp.key');
    expect(history).toHaveLength(1);
    expect(history[0].source).toBe('sensor-A');
    expect(history[0].value).toBe(42);
    expect(typeof history[0].timestamp).toBe('number');
  });

  test('accumulates multiple entries for the same key', () => {
    record('temp.key', 1, 'sensor-A');
    record('temp.key', 2, 'sensor-B');
    expect(getProvenance('temp.key')).toHaveLength(2);
  });

  test('stores optional metadata and requestId', () => {
    record('temp.key', 'val', 'svc', { requestId: 'req-1', metadata: { confidence: 0.9 } });
    const [entry] = getProvenance('temp.key');
    expect(entry.requestId).toBe('req-1');
    expect(entry.metadata.confidence).toBe(0.9);
  });

  test('throws on empty key', () => {
    expect(() => record('', 1, 'src')).toThrow(TypeError);
  });

  test('throws on empty source', () => {
    expect(() => record('k', 1, '')).toThrow(TypeError);
  });

  test('getProvenance returns empty array for unknown key', () => {
    expect(getProvenance('no.such.key')).toEqual([]);
  });

  test('getProvenance throws on empty key', () => {
    expect(() => getProvenance('')).toThrow(TypeError);
  });
});

describe('Context Provenance — resolveWithProvenance', () => {
  beforeEach(() => {
    clearProvenance('resolve.key');
  });

  test('latest strategy returns last recorded value', () => {
    record('resolve.key', 'first', 'src-A');
    record('resolve.key', 'last', 'src-B');
    const { value } = resolveWithProvenance('resolve.key', 'latest');
    expect(value).toBe('last');
  });

  test('first strategy returns first recorded value', () => {
    record('resolve.key', 'alpha', 'src-A');
    record('resolve.key', 'beta', 'src-B');
    const { value } = resolveWithProvenance('resolve.key', 'first');
    expect(value).toBe('alpha');
  });

  test('highest-confidence strategy returns entry with max confidence', () => {
    record('resolve.key', 'low', 'src-A', { metadata: { confidence: 0.3 } });
    record('resolve.key', 'high', 'src-B', { metadata: { confidence: 0.9 } });
    record('resolve.key', 'mid', 'src-C', { metadata: { confidence: 0.5 } });
    const { value, record: provenanceRecord } = resolveWithProvenance('resolve.key', 'highest-confidence');
    expect(value).toBe('high');
    expect(provenanceRecord.source).toBe('src-B');
  });

  test('throws for unknown key', () => {
    expect(() => resolveWithProvenance('ghost.key')).toThrow('No provenance records found');
  });

  test('throws for invalid strategy', () => {
    record('resolve.key', 1, 'src');
    expect(() => resolveWithProvenance('resolve.key', 'unknown-strategy')).toThrow(TypeError);
  });
});

describe('Context Provenance — listTrackedKeys / clearProvenance', () => {
  test('listTrackedKeys includes recorded keys', () => {
    record('tracked.key', 1, 'src');
    expect(listTrackedKeys()).toContain('tracked.key');
    clearProvenance('tracked.key');
  });

  test('clearProvenance removes the key', () => {
    record('clear.me', 99, 'src');
    expect(clearProvenance('clear.me')).toBe(true);
    expect(getProvenance('clear.me')).toEqual([]);
  });

  test('clearProvenance returns false for non-existent key', () => {
    expect(clearProvenance('never.existed')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Domain Error Reporter
// ─────────────────────────────────────────────

describe('Domain Error Reporter — registerDomain / getDomain', () => {
  test('registers a domain and retrieves it', () => {
    registerDomain('order', [
      { field: 'amount', required: true, type: 'number', message: 'Order amount must be a positive number' },
    ], { description: 'E-commerce orders' });
    const d = getDomain('order');
    expect(d.name).toBe('order');
    expect(d.description).toBe('E-commerce orders');
    expect(d.rules).toHaveLength(1);
  });

  test('throws on empty domain name', () => {
    expect(() => registerDomain('', [])).toThrow(TypeError);
  });

  test('throws when rules is not an array', () => {
    expect(() => registerDomain('x', null)).toThrow(TypeError);
  });

  test('throws when a rule is missing field', () => {
    expect(() => registerDomain('x', [{ message: 'msg' }])).toThrow(TypeError);
  });

  test('throws when a rule is missing message', () => {
    expect(() => registerDomain('x', [{ field: 'f' }])).toThrow(TypeError);
  });

  test('getDomain returns null for unregistered domain', () => {
    expect(getDomain('nonexistent')).toBeNull();
  });

  test('listDomains includes registered domain', () => {
    registerDomain('catalog', [{ field: 'sku', required: true, message: 'SKU is required' }]);
    const names = listDomains().map((d) => d.name);
    expect(names).toContain('catalog');
  });
});

describe('Domain Error Reporter — createDomainError', () => {
  test('creates an enriched Error with domain metadata', () => {
    const err = createDomainError('payment', 'INVALID_AMOUNT', 'Amount must be positive', { field: 'amount' });
    expect(err).toBeInstanceOf(Error);
    expect(err.isDomainError).toBe(true);
    expect(err.domain).toBe('payment');
    expect(err.code).toBe('INVALID_AMOUNT');
    expect(err.message).toBe('Amount must be positive');
    expect(err.details.field).toBe('amount');
    expect(typeof err.timestamp).toBe('number');
  });

  test('throws on empty domain', () => {
    expect(() => createDomainError('', 'CODE', 'msg')).toThrow(TypeError);
  });

  test('throws on empty code', () => {
    expect(() => createDomainError('dom', '', 'msg')).toThrow(TypeError);
  });

  test('throws on empty message', () => {
    expect(() => createDomainError('dom', 'CODE', '')).toThrow(TypeError);
  });
});

describe('Domain Error Reporter — validateDomainRules', () => {
  beforeAll(() => {
    registerDomain('invoice', [
      { field: 'total', required: true, type: 'number', message: 'Invoice total must be a number' },
      { field: 'currency', required: true, type: 'string', message: 'Currency code is required' },
      {
        field: 'total',
        required: false,
        validate: (v) => v > 0,
        message: 'Invoice total must be greater than zero',
      },
    ]);
  });

  test('returns valid for correct payload', () => {
    const result = validateDomainRules('invoice', { total: 100, currency: 'USD' });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('reports missing required field with domain message', () => {
    const result = validateDomainRules('invoice', { total: 50 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Currency'))).toBe(true);
  });

  test('reports type mismatch with domain message', () => {
    const result = validateDomainRules('invoice', { total: 'not-a-number', currency: 'USD' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'TYPE_MISMATCH')).toBe(true);
  });

  test('reports custom validation failure', () => {
    const result = validateDomainRules('invoice', { total: -10, currency: 'USD' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'VALIDATION_FAILED')).toBe(true);
  });

  test('throws for unregistered domain', () => {
    expect(() => validateDomainRules('unknown-domain', {})).toThrow('Domain not registered');
  });

  test('throws when payload is null', () => {
    expect(() => validateDomainRules('invoice', null)).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────
// Code Generator
// ─────────────────────────────────────────────

describe('Code Generator — listTemplates / getTemplate', () => {
  test('returns exactly 5 built-in templates', () => {
    const templates = listTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(5);
  });

  test('includes all five expected React templates', () => {
    const names = listTemplates().map((t) => t.name);
    expect(names).toContain('react-query-hook');
    expect(names).toContain('websocket-hook');
    expect(names).toContain('auth-provider');
    expect(names).toContain('api-service');
    expect(names).toContain('event-stream-hook');
  });

  test('each template has name, description, and params', () => {
    for (const t of listTemplates()) {
      expect(typeof t.name).toBe('string');
      expect(typeof t.description).toBe('string');
      expect(typeof t.params).toBe('object');
    }
  });

  test('getTemplate returns null for unknown template', () => {
    expect(getTemplate('does-not-exist')).toBeNull();
  });

  test('getTemplate returns template metadata', () => {
    const t = getTemplate('react-query-hook');
    expect(t).not.toBeNull();
    expect(t.name).toBe('react-query-hook');
  });
});

describe('Code Generator — generateFromTemplate', () => {
  test('generates react-query-hook code', () => {
    const { template, code } = generateFromTemplate('react-query-hook', {
      hookName: 'useUsers',
      endpoint: '/api/users',
    });
    expect(template).toBe('react-query-hook');
    expect(code).toContain('useUsers');
    expect(code).toContain('/api/users');
    expect(code).toContain('useQuery');
    expect(typeof code).toBe('string');
  });

  test('generates websocket-hook code', () => {
    const { code } = generateFromTemplate('websocket-hook', {
      hookName: 'useOrders',
      path: '/api/orders',
    });
    expect(code).toContain('useOrders');
    expect(code).toContain('/api/orders');
    expect(code).toContain('WebSocket');
  });

  test('generates auth-provider code', () => {
    const { code } = generateFromTemplate('auth-provider', { loginEndpoint: '/api/auth/login' });
    expect(code).toContain('AuthProvider');
    expect(code).toContain('useAuth');
    expect(code).toContain('/api/auth/login');
  });

  test('generates api-service code', () => {
    const { code } = generateFromTemplate('api-service', {
      serviceName: 'UsersService',
      basePath: '/api/users',
    });
    expect(code).toContain('UsersService');
    expect(code).toContain('/api/users');
    expect(code).toContain('axios');
  });

  test('generates event-stream-hook code', () => {
    const { code } = generateFromTemplate('event-stream-hook', {
      hookName: 'useNotifications',
      endpoint: '/api/events/notifications',
    });
    expect(code).toContain('useNotifications');
    expect(code).toContain('EventSource');
    expect(code).toContain('/api/events/notifications');
  });

  test('result includes generatedAt timestamp', () => {
    const result = generateFromTemplate('auth-provider', {});
    expect(typeof result.generatedAt).toBe('number');
  });

  test('throws for unknown template', () => {
    expect(() => generateFromTemplate('no-such-template', {})).toThrow('Template not found');
  });

  test('throws when required params are missing', () => {
    expect(() => generateFromTemplate('react-query-hook', {})).toThrow('Missing required parameters');
  });

  test('throws on non-object params', () => {
    expect(() => generateFromTemplate('react-query-hook', 'bad')).toThrow(TypeError);
  });

  test('throws on empty templateName', () => {
    expect(() => generateFromTemplate('', {})).toThrow(TypeError);
  });
});

describe('Code Generator — registerTemplate', () => {
  test('registers a custom template and generates code', () => {
    registerTemplate(
      'my-template',
      'A custom test template',
      { greeting: { type: 'string', required: true, description: 'Greeting word' } },
      ({ greeting }) => `export const greeting = '${greeting}';`
    );
    const { code } = generateFromTemplate('my-template', { greeting: 'Hello' });
    expect(code).toContain("'Hello'");
  });

  test('throws on empty name', () => {
    expect(() => registerTemplate('', 'desc', {}, () => '')).toThrow(TypeError);
  });

  test('throws when generate is not a function', () => {
    expect(() => registerTemplate('t', 'desc', {}, 'not-fn')).toThrow(TypeError);
  });
});

// ─────────────────────────────────────────────
// Code Generator — indent helper
// ─────────────────────────────────────────────

describe('Code Generator — indent helper', () => {
  test('indents every non-empty line by 2 spaces by default', () => {
    const result = indent('line1\nline2\nline3');
    expect(result).toBe('  line1\n  line2\n  line3');
  });

  test('uses a custom indentation amount', () => {
    const result = indent('a\nb', 4);
    expect(result).toBe('    a\n    b');
  });

  test('leaves empty lines as empty strings (no trailing whitespace)', () => {
    const result = indent('a\n\nb');
    const lines = result.split('\n');
    expect(lines[0]).toBe('  a');
    expect(lines[1]).toBe('');
    expect(lines[2]).toBe('  b');
  });

  test('handles a single-line string', () => {
    expect(indent('hello')).toBe('  hello');
  });

  test('handles an empty string', () => {
    expect(indent('')).toBe('');
  });
});

// ─────────────────────────────────────────────
// Code Generator — validateParams
// ─────────────────────────────────────────────

describe('Code Generator — validateParams', () => {
  test('accepts valid identifier and path values', () => {
    expect(() => validateParams({ hookName: 'useUsers', endpoint: '/api/users' })).not.toThrow();
  });

  test('rejects hookName with special characters', () => {
    expect(() => validateParams({ hookName: 'use-Users' })).toThrow(TypeError);
  });

  test('rejects hookName starting with a digit', () => {
    expect(() => validateParams({ hookName: '1useUsers' })).toThrow(TypeError);
  });

  test('rejects hookName with backtick injection attempt', () => {
    expect(() => validateParams({ hookName: 'useData`; maliciousCode();' })).toThrow(TypeError);
  });

  test('rejects endpoint not starting with /', () => {
    expect(() => validateParams({ endpoint: 'api/users' })).toThrow(TypeError);
  });

  test('rejects path with special characters', () => {
    expect(() => validateParams({ path: '/api/users?foo=bar' })).toThrow(TypeError);
  });

  test('skips keys not in identifier or path categories', () => {
    expect(() => validateParams({ queryKey: 'my-key with spaces' })).not.toThrow();
  });
});

// ─────────────────────────────────────────────
// Context Provenance — provenanceMiddleware
// ─────────────────────────────────────────────

describe('Context Provenance — provenanceMiddleware', () => {
  afterEach(() => {
    clearProvenance('GET:/mw-test');
  });

  test('records request context and calls next()', () => {
    const mw = provenanceMiddleware('test-source');
    const req = { method: 'GET', path: '/mw-test', ip: '127.0.0.1', headers: { 'x-request-id': 'req-42', 'user-agent': 'jest' } };
    let nextCalled = false;
    mw(req, {}, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    const history = getProvenance('GET:/mw-test');
    expect(history).toHaveLength(1);
    expect(history[0].source).toBe('test-source');
    expect(history[0].value.method).toBe('GET');
    expect(history[0].requestId).toBe('req-42');
    expect(history[0].metadata.userAgent).toBe('jest');
  });

  test('handles missing headers gracefully', () => {
    const mw = provenanceMiddleware();
    const req = { method: 'GET', path: '/mw-test', ip: null, headers: {} };
    let nextCalled = false;
    mw(req, {}, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    const history = getProvenance('GET:/mw-test');
    expect(history).toHaveLength(1);
    expect(history[0].requestId).toBeNull();
    expect(history[0].metadata.userAgent).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Domain Error Reporter — domainErrorHandler
// ─────────────────────────────────────────────

describe('Domain Error Reporter — domainErrorHandler', () => {
  function mockRes() {
    const res = { _status: null, _body: null };
    res.status = (code) => { res._status = code; return res; };
    res.json = (body) => { res._body = body; return res; };
    return res;
  }

  test('returns 422 with domain error structure for domain errors', () => {
    const err = createDomainError('test-domain', 'BAD_FIELD', 'Field is invalid', { field: 'x' });
    const res = mockRes();
    let nextErr = null;
    domainErrorHandler(err, {}, res, (e) => { nextErr = e; });
    expect(res._status).toBe(422);
    expect(res._body.error.domain).toBe('test-domain');
    expect(res._body.error.code).toBe('BAD_FIELD');
    expect(nextErr).toBeNull();
  });

  test('calls next(err) for non-domain errors', () => {
    const err = new Error('generic error');
    const res = mockRes();
    let nextErr = null;
    domainErrorHandler(err, {}, res, (e) => { nextErr = e; });
    expect(res._status).toBeNull();
    expect(nextErr).toBe(err);
  });

  test('calls next(err) for ETIMEDOUT errors', () => {
    const err = new Error('timeout');
    err.code = 'ETIMEDOUT';
    const res = mockRes();
    let nextErr = null;
    domainErrorHandler(err, {}, res, (e) => { nextErr = e; });
    expect(res._status).toBeNull();
    expect(nextErr).toBe(err);
  });
});

// ─────────────────────────────────────────────
// Context Provenance — maxRecordsPerKey cap
// ─────────────────────────────────────────────

describe('Context Provenance — maxRecordsPerKey eviction', () => {
  const capKey = 'cap.test.key';

  afterEach(() => {
    clearProvenance(capKey);
  });

  test('does not exceed MAX_RECORDS_PER_KEY (default 1000)', () => {
    for (let i = 0; i < 1005; i++) {
      record(capKey, i, 'src');
    }
    const history = getProvenance(capKey);
    expect(history.length).toBeLessThanOrEqual(1000);
    // The most recent entries should be retained (FIFO eviction)
    expect(history[history.length - 1].value).toBe(1004);
  });
});

// ─────────────────────────────────────────────
// HTTP Endpoints for new features (integration)
// ─────────────────────────────────────────────

describe('GET /api/provenance', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/provenance');
    expect(res.status).toBe(401);
  });

  test('returns JSON array with valid auth', async () => {
    const res = await request(app).get('/api/provenance').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/domains', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/domains');
    expect(res.status).toBe(401);
  });

  test('returns JSON array with valid auth', async () => {
    const res = await request(app).get('/api/domains').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /api/codegen/templates', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).get('/api/codegen/templates');
    expect(res.status).toBe(401);
  });

  test('returns JSON array with 5+ built-in templates', async () => {
    const res = await request(app).get('/api/codegen/templates').set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(5);
  });
});

describe('GET /api/codegen/templates/:name', () => {
  test('returns 404 for unknown template', async () => {
    const res = await request(app)
      .get('/api/codegen/templates/__nonexistent__')
      .set('Authorization', authHeader());
    expect(res.status).toBe(404);
  });

  test('returns 200 with template metadata for known template', async () => {
    const res = await request(app)
      .get('/api/codegen/templates/react-query-hook')
      .set('Authorization', authHeader());
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('react-query-hook');
  });
});

describe('POST /api/codegen/generate', () => {
  test('returns 401 without auth', async () => {
    const res = await request(app).post('/api/codegen/generate').send({});
    expect(res.status).toBe(401);
  });

  test('generates code for a valid template + params', async () => {
    const res = await request(app)
      .post('/api/codegen/generate')
      .set('Authorization', authHeader())
      .send({ template: 'react-query-hook', params: { hookName: 'useItems', endpoint: '/api/items' } });
    expect(res.status).toBe(200);
    expect(res.body.template).toBe('react-query-hook');
    expect(typeof res.body.code).toBe('string');
    expect(res.body.code).toContain('useItems');
  });

  test('returns 404 for unknown template', async () => {
    const res = await request(app)
      .post('/api/codegen/generate')
      .set('Authorization', authHeader())
      .send({ template: 'no-such-template', params: {} });
    expect(res.status).toBe(404);
  });

  test('returns 400 when required params are missing', async () => {
    const res = await request(app)
      .post('/api/codegen/generate')
      .set('Authorization', authHeader())
      .send({ template: 'react-query-hook', params: {} });
    expect(res.status).toBe(400);
  });

  test('returns 400 when template field is missing', async () => {
    const res = await request(app)
      .post('/api/codegen/generate')
      .set('Authorization', authHeader())
      .send({ params: {} });
    expect(res.status).toBe(400);
  });

  test('returns 400 when hookName contains injection characters', async () => {
    const res = await request(app)
      .post('/api/codegen/generate')
      .set('Authorization', authHeader())
      .send({ template: 'react-query-hook', params: { hookName: 'use`inject`', endpoint: '/api/x' } });
    expect(res.status).toBe(400);
  });
});
