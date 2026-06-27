'use strict';

/**
 * Code Generator — Automated "Bookkeeping" and Infrastructure Code Generation.
 *
 * Implements a lightweight Model-Driven Software Development (MDSD) approach:
 * developers describe their intent via a parameter model and the generator
 * produces the repetitive "bookkeeping" code automatically.
 *
 * Five built-in React frontend templates:
 *
 *   1. react-query-hook      — Custom React Query (TanStack) data-fetching hook
 *   2. websocket-hook        — Custom WebSocket hook wired to the MiddleMan WS proxy
 *   3. auth-provider         — JWT authentication context + provider component
 *   4. api-service           — Axios-based API service layer with JWT + error handling
 *   5. event-stream-hook     — Server-Sent Events (SSE) consumer hook
 *
 * Security notes:
 *   - Generated code stores JWTs in localStorage. This is a widely-used client-side
 *     pattern but is susceptible to XSS. Implement a strong Content-Security-Policy
 *     and sanitize all user input in the consuming application.
 *   - registerTemplate() should only be called with trusted, developer-defined
 *     generator functions. Never pass user-controlled functions to registerTemplate().
 */

/** @type {Map<string, { name, description, params, generate: Function }>} */
const templateRegistry = new Map();

// ─────────────────────────────────────────
// Parameter validation helpers
// ─────────────────────────────────────────

/** Valid JS identifier: letter followed by alphanumeric chars (no special chars). */
const IDENTIFIER_RE = /^[a-zA-Z][a-zA-Z0-9]*$/;
/** Valid URL path: starts with /, followed by URL-safe chars. */
const PATH_RE = /^\/[a-zA-Z0-9/_\-.]*$/;

/**
 * Validate template parameter values against expected patterns to prevent
 * code injection via user-controlled strings.
 *
 * @param {object} params - Parameters to validate.
 * @throws {TypeError} if any parameter value contains unsafe characters.
 */
function validateParams(params) {
  const identifierKeys = ['hookName', 'serviceName'];
  const pathKeys = ['endpoint', 'path', 'basePath', 'loginEndpoint'];

  for (const key of identifierKeys) {
    if (params[key] !== undefined && params[key] !== null) {
      if (typeof params[key] !== 'string' || !IDENTIFIER_RE.test(params[key])) {
        throw new TypeError(
          `Parameter '${key}' must be a valid JavaScript identifier (letters and digits only, starting with a letter)`
        );
      }
    }
  }

  for (const key of pathKeys) {
    if (params[key] !== undefined && params[key] !== null) {
      if (typeof params[key] !== 'string' || !PATH_RE.test(params[key])) {
        throw new TypeError(
          `Parameter '${key}' must be a valid URL path starting with / and containing only URL-safe characters`
        );
      }
    }
  }
}

// ─────────────────────────────────────────
// Helper
// ─────────────────────────────────────────

/** Indent every line of `code` by `n` spaces. */
function indent(code, n = 2) {
  const pad = ' '.repeat(n);
  return code
    .split('\n')
    .map((l) => (l.trim() === '' ? '' : `${pad}${l}`))
    .join('\n');
}

// ─────────────────────────────────────────
// Built-in template definitions
// ─────────────────────────────────────────

templateRegistry.set('react-query-hook', {
  name: 'react-query-hook',
  description: 'Custom React Query (TanStack Query v5) data-fetching hook with JWT bearer auth',
  params: {
    hookName: { type: 'string', required: true, description: 'Name of the generated hook (e.g. useUsers)' },
    endpoint: { type: 'string', required: true, description: 'API endpoint path (e.g. /api/users)' },
    queryKey: { type: 'string', required: false, description: 'React Query cache key (defaults to hookName)' },
  },
  generate({ hookName, endpoint, queryKey }) {
    const key = queryKey || hookName;
    return `import { useQuery } from '@tanstack/react-query';

const BASE_URL = process.env.REACT_APP_API_URL ?? '';

// NOTE: This template stores the JWT in localStorage for simplicity.
// localStorage is accessible to JavaScript, making it susceptible to XSS.
// Apply a strict Content-Security-Policy and sanitize all user input.
async function fetchData(endpoint) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(\`\${BASE_URL}\${endpoint}\`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: \`Bearer \${token}\` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error?.message ?? \`Request failed: \${res.status}\`);
    err.status = res.status;
    err.domain = body?.error?.domain;
    err.code = body?.error?.code;
    throw err;
  }
  return res.json();
}

export function ${hookName}(options = {}) {
  return useQuery({
    queryKey: ['${key}'],
    queryFn: () => fetchData('${endpoint}'),
    staleTime: 30_000,
    ...options,
  });
}
`;
  },
});

templateRegistry.set('websocket-hook', {
  name: 'websocket-hook',
  description: 'React hook for real-time WebSocket connection via the MiddleMan WebSocket proxy',
  params: {
    hookName: { type: 'string', required: true, description: 'Name of the generated hook (e.g. useOrderUpdates)' },
    path: { type: 'string', required: true, description: 'WebSocket path on the proxy (e.g. /api/orders)' },
  },
  generate({ hookName, path }) {
    return `import { useEffect, useRef, useState, useCallback } from 'react';

// NOTE: The WebSocket API does not support custom headers for the initial handshake.
// This hook relies on the server accepting cookie-based authentication (HttpOnly cookies
// set at login are sent automatically by the browser for same-origin connections).
// If the server requires an explicit token, consult your server's WebSocket upgrade
// handler for supported authentication mechanisms.
export function ${hookName}() {
  const [lastMessage, setLastMessage] = useState(null);
  const [readyState, setReadyState] = useState(WebSocket.CONNECTING);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    let attempts = 0;
    const maxAttempts = 5;

    function initWebSocket() {
      if (!isMountedRef.current) return;
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = process.env.REACT_APP_WS_HOST ?? window.location.host;
      const ws = new WebSocket(\`\${protocol}://\${host}${path}\`);
      wsRef.current = ws;

      ws.onopen = () => { setReadyState(WebSocket.OPEN); attempts = 0; };
      ws.onerror = () => ws.close();
      ws.onclose = () => {
        setReadyState(WebSocket.CLOSED);
        if (!isMountedRef.current) return;
        if (attempts < maxAttempts) {
          const delay = Math.min(30000, 1000 * Math.pow(2, attempts));
          attempts += 1;
          reconnectTimeoutRef.current = setTimeout(initWebSocket, delay);
        }
      };
      ws.onmessage = (evt) => {
        try { setLastMessage(JSON.parse(evt.data)); }
        catch { setLastMessage(evt.data); }
      };
    }

    initWebSocket();

    return () => {
      isMountedRef.current = false;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }, []);

  return { lastMessage, readyState, send };
}
`;
  },
});

templateRegistry.set('auth-provider', {
  name: 'auth-provider',
  description: 'JWT authentication React context + provider component for MiddleMan-backed APIs',
  params: {
    loginEndpoint: {
      type: 'string',
      required: false,
      description: 'Login API endpoint (defaults to /api/auth/login)',
    },
  },
  generate({ loginEndpoint = '/api/auth/login' }) {
    return `import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

const BASE_URL = process.env.REACT_APP_API_URL ?? '';

// NOTE: This template stores the JWT in localStorage for simplicity.
// localStorage is accessible to JavaScript, making it susceptible to XSS.
// Apply a strict Content-Security-Policy and sanitize all user input.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);

  const login = useCallback(async (credentials) => {
    setError(null);
    try {
      const res = await fetch(\`\${BASE_URL}${loginEndpoint}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? 'Login failed');
      }
      const { token: newToken, user: newUser } = await res.json();
      localStorage.setItem('auth_token', newToken);
      setToken(newToken);
      setUser(newUser);
      return newUser;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, error, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
`;
  },
});

templateRegistry.set('api-service', {
  name: 'api-service',
  description: 'Axios-based API service class with JWT injection, domain-error parsing, and request-id propagation',
  params: {
    serviceName: {
      type: 'string',
      required: true,
      description: 'PascalCase service class name (e.g. UsersService)',
    },
    basePath: {
      type: 'string',
      required: true,
      description: 'Base API path (e.g. /api/users)',
    },
  },
  generate({ serviceName, basePath }) {
    return `import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// NOTE: This template stores the JWT in localStorage for simplicity.
// localStorage is accessible to JavaScript, making it susceptible to XSS.
// Apply a strict Content-Security-Policy and sanitize all user input.
const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
});

// Inject JWT and request-id on every outgoing request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) config.headers.Authorization = \`Bearer \${token}\`;
  config.headers['X-Request-Id'] = uuidv4();
  return config;
});

// Parse domain-semantic errors from MiddleMan responses
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const body = err.response?.data;
    if (body?.error?.domain) {
      const domainErr = new Error(body.error.message ?? 'Domain error');
      domainErr.domain = body.error.domain;
      domainErr.code = body.error.code;
      domainErr.details = body.error.details ?? {};
      return Promise.reject(domainErr);
    }
    return Promise.reject(err);
  }
);

export class ${serviceName} {
  static async getAll(params = {}) {
    const { data } = await client.get('${basePath}', { params });
    return data;
  }

  static async getById(id) {
    const { data } = await client.get(\`${basePath}/\${id}\`);
    return data;
  }

  static async create(payload) {
    const { data } = await client.post('${basePath}', payload);
    return data;
  }

  static async update(id, payload) {
    const { data } = await client.put(\`${basePath}/\${id}\`, payload);
    return data;
  }

  static async remove(id) {
    await client.delete(\`${basePath}/\${id}\`);
  }
}
`;
  },
});

templateRegistry.set('event-stream-hook', {
  name: 'event-stream-hook',
  description: 'React hook for consuming Server-Sent Events (SSE) from a MiddleMan SSE endpoint',
  params: {
    hookName: {
      type: 'string',
      required: true,
      description: 'Name of the generated hook (e.g. useNotifications)',
    },
    endpoint: {
      type: 'string',
      required: true,
      description: 'SSE endpoint path (e.g. /api/events/notifications)',
    },
  },
  generate({ hookName, endpoint }) {
    return `import { useEffect, useRef, useState } from 'react';

// NOTE: EventSource does not support custom headers. This hook uses
// { withCredentials: true } so the browser automatically sends HttpOnly
// cookies set at login. Ensure the server sets CORS Access-Control-Allow-Origin
// and Access-Control-Allow-Credentials headers accordingly.
export function ${hookName}() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef(null);
  const isMountedRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;

    const base = process.env.REACT_APP_API_URL ?? '';
    const url = \`\${base}${endpoint}\`;

    const connect = () => {
      if (!isMountedRef.current) return;

      const es = new EventSource(url, { withCredentials: true });
      sourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0;
      };

      es.onerror = () => {
        if (!isMountedRef.current) return;

        setConnected(false);
        setError('SSE connection lost');
        es.close();

        const maxAttempts = 5;
        const nextAttempt = reconnectAttemptsRef.current + 1;
        if (nextAttempt > maxAttempts) return;
        reconnectAttemptsRef.current = nextAttempt;

        const delay = Math.min(30000, 1000 * Math.pow(2, nextAttempt - 1));
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, delay);
      };

      es.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data);
          setEvents((prev) => [...prev, parsed]);
        } catch {
          setEvents((prev) => [...prev, evt.data]);
        }
      };
    };

    connect();

    return () => {
      isMountedRef.current = false;
      if (sourceRef.current) sourceRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      setConnected(false);
    };
  }, []);

  const clear = () => setEvents([]);

  return { events, error, connected, clear };
}
`;
  },
});

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

/**
 * List all available templates with their name, description, and parameter schema.
 *
 * @returns {Array<{ name, description, params }>}
 */
function listTemplates() {
  return Array.from(templateRegistry.values()).map(({ name, description, params }) => ({
    name,
    description,
    params,
  }));
}

/**
 * Retrieve a single template definition by name.
 *
 * @param {string} name - Template name.
 * @returns {{ name, description, params } | null}
 */
function getTemplate(name) {
  const t = templateRegistry.get(name);
  if (!t) return null;
  const { name: n, description, params } = t;
  return { name: n, description, params };
}

/**
 * Generate code from a named template given a parameter model.
 * Missing required parameters and unsafe parameter values are reported as errors.
 *
 * @param {string} templateName - Name of the template to use.
 * @param {object} params       - Parameter model (key → value).
 * @returns {{ template: string, code: string, generatedAt: number }}
 */
function generateFromTemplate(templateName, params = {}) {
  if (typeof templateName !== 'string' || !templateName) {
    throw new TypeError('templateName must be a non-empty string');
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new TypeError('params must be a plain object');
  }

  const template = templateRegistry.get(templateName);
  if (!template) throw new Error(`Template not found: ${templateName}`);

  // Validate required parameters
  const missing = [];
  for (const [key, def] of Object.entries(template.params)) {
    if (def.required && (params[key] === undefined || params[key] === null || params[key] === '')) {
      missing.push(key);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required parameters for template '${templateName}': ${missing.join(', ')}`);
  }

  // Validate parameter values to prevent code injection
  validateParams(params);

  const code = template.generate(params);
  return { template: templateName, code, generatedAt: Date.now() };
}

/**
 * Register a custom template (for extensibility).
 *
 * SECURITY: The `generate` function is executed server-side when
 * POST /api/codegen/generate is called. Only register templates with
 * trusted, developer-defined generator functions. Never pass user-controlled
 * functions to this API.
 *
 * @param {string}   name        - Unique template name.
 * @param {string}   description - Human-readable description.
 * @param {object}   params      - Parameter schema { paramName: { type, required, description } }.
 * @param {Function} generate    - Function(params) → string code.
 */
function registerTemplate(name, description, params, generate) {
  if (typeof name !== 'string' || !name) throw new TypeError('name must be a non-empty string');
  if (typeof description !== 'string') throw new TypeError('description must be a string');
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new TypeError('params must be a plain object');
  if (typeof generate !== 'function') throw new TypeError('generate must be a function');

  templateRegistry.set(name, { name, description, params, generate });
}

module.exports = { listTemplates, getTemplate, generateFromTemplate, registerTemplate, validateParams, indent };
