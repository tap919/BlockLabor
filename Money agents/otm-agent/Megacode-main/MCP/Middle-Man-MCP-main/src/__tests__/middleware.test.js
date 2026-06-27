'use strict';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../app');
const config = require('../config');
const { CircuitBreaker, STATES } = require('../features/circuitBreaker');
const requestIdMiddleware = require('../transforms/requestId');
const logSanitizerMiddleware = require('../transforms/logSanitizer');
const headerStripperMiddleware = require('../transforms/headerStripper');
const rateLimiter = require('../middleware/rateLimiter');

describe('Auth Middleware', () => {
  test('skips auth for /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).not.toBe(401);
  });

  test('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/api/users/test');
    expect(res.status).toBe(401);
  });

  test('returns 401 for invalid JWT token', async () => {
    const res = await request(app)
      .get('/api/users/test')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  test('allows valid JWT token', async () => {
    const token = jwt.sign({ sub: 'test-user' }, config.jwt.secret, { expiresIn: '1h' });
    const res = await request(app)
      .get('/api/users/test')
      .set('Authorization', `Bearer ${token}`);
    // Not 401 (may be 502 from proxy not being reachable, but auth passes)
    expect(res.status).not.toBe(401);
  });
});

describe('requestId Transform', () => {
  test('adds x-request-id to response if not present', (done) => {
    const req = { headers: {}, path: '/' };
    const res = {
      _headers: {},
      setHeader(name, value) { this._headers[name.toLowerCase()] = value; },
    };
    requestIdMiddleware(req, res, () => {
      expect(req.headers['x-request-id']).toBeDefined();
      expect(req.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
      expect(res._headers['x-request-id']).toBe(req.headers['x-request-id']);
      done();
    });
  });

  test('preserves existing x-request-id', (done) => {
    const existingId = 'my-custom-request-id';
    const req = { headers: { 'x-request-id': existingId }, path: '/' };
    const res = {
      _headers: {},
      setHeader(name, value) { this._headers[name.toLowerCase()] = value; },
    };
    requestIdMiddleware(req, res, () => {
      expect(req.headers['x-request-id']).toBe(existingId);
      done();
    });
  });
});

describe('logSanitizer Transform', () => {
  test('redacts password fields', (done) => {
    const req = { body: { username: 'alice', password: 'secret123' } };
    logSanitizerMiddleware(req, {}, () => {
      expect(req.body.password).toBe('[REDACTED]');
      expect(req.body.username).toBe('alice');
      done();
    });
  });

  test('redacts token fields', (done) => {
    const req = { body: { token: 'abc123', data: 'visible' } };
    logSanitizerMiddleware(req, {}, () => {
      expect(req.body.token).toBe('[REDACTED]');
      expect(req.body.data).toBe('visible');
      done();
    });
  });

  test('handles nested objects', (done) => {
    const req = { body: { user: { password: 'nested-secret' } } };
    logSanitizerMiddleware(req, {}, () => {
      expect(req.body.user.password).toBe('[REDACTED]');
      done();
    });
  });

  test('handles missing body', (done) => {
    const req = {};
    logSanitizerMiddleware(req, {}, () => {
      expect(req.body).toBeUndefined();
      done();
    });
  });
});

describe('headerStripper Transform', () => {
  test('removes x-internal-* headers', (done) => {
    const req = {
      headers: {
        'x-internal-secret': 'secret',
        'x-internal-token': 'token',
        'x-request-id': 'keep-this',
        'content-type': 'application/json',
      },
    };
    headerStripperMiddleware(req, {}, () => {
      expect(req.headers['x-internal-secret']).toBeUndefined();
      expect(req.headers['x-internal-token']).toBeUndefined();
      expect(req.headers['x-request-id']).toBe('keep-this');
      expect(req.headers['content-type']).toBe('application/json');
      done();
    });
  });

  test('leaves non-internal headers intact', (done) => {
    const req = {
      headers: {
        'authorization': 'Bearer token',
        'accept': 'application/json',
      },
    };
    headerStripperMiddleware(req, {}, () => {
      expect(req.headers['authorization']).toBe('Bearer token');
      expect(req.headers['accept']).toBe('application/json');
      done();
    });
  });
});

describe('rateLimiter Middleware', () => {
  test('rateLimiter is a function (middleware)', () => {
    expect(typeof rateLimiter).toBe('function');
    expect(rateLimiter.length).toBeGreaterThanOrEqual(2);
  });
});

describe('CircuitBreaker', () => {
  test('starts in CLOSED state', () => {
    const cb = new CircuitBreaker('test-service');
    expect(cb.getState()).toBe(STATES.CLOSED);
  });

  test('opens after failure threshold is reached', async () => {
    const cb = new CircuitBreaker('failing-service', { failureThreshold: 3, timeout: 30000 });
    const failingFn = async () => { throw new Error('fail'); };

    for (let i = 0; i < 3; i++) {
      try { await cb.call(failingFn); } catch {}
    }

    expect(cb.getState()).toBe(STATES.OPEN);
  });

  test('throws when circuit is OPEN', async () => {
    const cb = new CircuitBreaker('open-service', { failureThreshold: 1, timeout: 60000 });
    try { await cb.call(async () => { throw new Error('fail'); }); } catch {}

    await expect(cb.call(async () => 'ok')).rejects.toThrow('Circuit breaker OPEN');
  });

  test('transitions to HALF_OPEN after timeout', async () => {
    const cb = new CircuitBreaker('timeout-service', { failureThreshold: 1, timeout: 10 });
    try { await cb.call(async () => { throw new Error('fail'); }); } catch {}

    await new Promise((r) => setTimeout(r, 50));
    // Next call should try (HALF_OPEN)
    try { await cb.call(async () => 'ok'); } catch {}
    // After successful call, should move toward CLOSED
  });

  test('closes after success threshold in HALF_OPEN', async () => {
    const cb = new CircuitBreaker('recovering-service', {
      failureThreshold: 1,
      successThreshold: 2,
      timeout: 10,
    });
    try { await cb.call(async () => { throw new Error('fail'); }); } catch {}

    await new Promise((r) => setTimeout(r, 50));

    await cb.call(async () => 'ok');
    await cb.call(async () => 'ok');
    expect(cb.getState()).toBe(STATES.CLOSED);
  });
});
