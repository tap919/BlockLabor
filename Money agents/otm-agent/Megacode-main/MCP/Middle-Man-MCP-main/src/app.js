'use strict';

const express = require('express');
const config = require('./config');

// Middleware
const corsMiddleware = require('./middleware/cors');
const compressionMiddleware = require('./middleware/compression');
const rateLimiter = require('./middleware/rateLimiter');
const helmetMiddleware = require('./middleware/helmet');
const logging = require('./middleware/logging');
const auth = require('./middleware/auth');
const bodyParser = require('./middleware/bodyParser');
const timeoutMiddleware = require('./middleware/timeout');

// Transforms
const headerStripper = require('./transforms/headerStripper');
const requestId = require('./transforms/requestId');
const logSanitizer = require('./transforms/logSanitizer');

// Monitoring
const { register, metricsMiddleware } = require('./monitoring/prometheus');
const tracing = require('./monitoring/tracing');
const { router: healthRouter } = require('./monitoring/healthCheck');

// Proxies
const { createServiceProxy } = require('./proxies/serviceProxy');

// Webhooks
const { router: webhookStripeRouter } = require('./webhooks/stripe');
const { router: webhookGithubRouter } = require('./webhooks/github');

// Features
const serviceDiscovery = require('./features/serviceDiscovery');
const { getAllFlows, getFlowStatus } = require('./features/workflowOrchestrator');
const { listInterfaces } = require('./features/interfaceRegistry');
const { listTrackedKeys, getProvenance, resolveWithProvenance } = require('./features/contextProvenance');
const { listDomains, validateDomainRules, domainErrorHandler } = require('./features/domainErrorReporter');
const { listTemplates, getTemplate, generateFromTemplate } = require('./features/codeGenerator');

const app = express();

// Auto-register configured services into the service discovery registry
// (Feature 5: dynamic binding — removes hardcoded service lookups at runtime)
if (config.serviceDiscovery.enabled) {
  for (const [name, svc] of Object.entries(config.services)) {
    serviceDiscovery.register(name, svc.target, { path: svc.path });
  }
}

// Apply middleware in specified order
app.use(corsMiddleware);
app.use(compressionMiddleware);
app.use(rateLimiter);
app.use(helmetMiddleware);
app.use(logging);

// Transforms
app.use(headerStripper);
app.use(requestId);
app.use(logSanitizer);

// Pre-auth routes: Prometheus scraping and webhooks use their own auth mechanisms
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

app.use(webhookStripeRouter);
app.use(webhookGithubRouter);

// Auth
app.use(auth);

// Body parsing
app.use(bodyParser);

// Timeout
app.use(timeoutMiddleware);

// Monitoring
app.use(tracing);
app.use(metricsMiddleware);

// Health check
app.use(healthRouter);

// Orchestration observability — list all registered flows and per-flow status
// (Feature 3: centralized observability; Feature 4: workflow orchestration)
// These endpoints are behind auth to prevent exposure of internal service topology.
app.get('/api/orchestration/flows', (req, res) => {
  res.json(getAllFlows());
});
app.get('/api/orchestration/flows/:name', (req, res) => {
  const status = getFlowStatus(req.params.name);
  if (!status) return res.status(404).json({ error: `Flow not found: ${req.params.name}` });
  res.json(status);
});

// Service discovery — list all registered services
// (Feature 5: service discovery and dynamic binding)
app.get('/api/discovery/services', (req, res) => {
  res.json(serviceDiscovery.list());
});

// Interface registry — list all defined interface schemas
// (Feature 6: standardized interface and port definitions)
app.get('/api/interfaces', (req, res) => {
  res.json(listInterfaces());
});

// Service proxies
app.use(
  config.services.users.path.replace('/*', ''),
  createServiceProxy(config.services.users.target, { rewrite: true })
);
app.use(
  config.services.payments.path.replace('/*', ''),
  createServiceProxy(config.services.payments.target, { auth: true })
);
app.use(
  config.services.media.path.replace('/*', ''),
  createServiceProxy(config.services.media.target, { cache: true })
);

// Context Provenance — list tracked keys and retrieve per-key provenance history
// (Feature: context provenance / origin tracking)
if (config.provenance.enabled) {
  app.get('/api/provenance', (req, res) => {
    res.json(listTrackedKeys());
  });
  app.get('/api/provenance/:key', (req, res) => {
    try {
      const history = getProvenance(req.params.key);
      res.json(history);
    } catch (err) {
      if (err instanceof TypeError) {
        res.status(400).json({ error: 'Invalid key parameter' });
      } else {
        res.status(500).json({ error: 'Failed to retrieve provenance history' });
      }
    }
  });
  app.post('/api/provenance/:key/resolve', (req, res) => {
    try {
      const strategy = (req.body && req.body.strategy) || 'latest';
      const result = resolveWithProvenance(req.params.key, strategy);
      res.json(result);
    } catch (err) {
      const status = err instanceof TypeError ? 400 : 404;
      res.status(status).json({ error: err.message });
    }
  });
}

// Domain Error Reporter — list domains and validate payloads
// (Feature: domain-semantic error reporting)
if (config.domainErrors.enabled) {
  app.get('/api/domains', (req, res) => {
    res.json(listDomains());
  });
  app.post('/api/domains/:name/validate', (req, res) => {
    try {
      const result = validateDomainRules(req.params.name, req.body);
      res.json(result);
    } catch (err) {
      res.status(err.message.startsWith('Domain not registered') ? 404 : 400).json({ error: err.message });
    }
  });
}

// Code Generator — list templates and generate code
// (Feature: automated infrastructure code generation with 5 React templates)
if (config.codeGenerator.enabled) {
  app.get('/api/codegen/templates', (req, res) => {
    res.json(listTemplates());
  });
  app.get('/api/codegen/templates/:name', (req, res) => {
    const t = getTemplate(req.params.name);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json(t);
  });
  app.post('/api/codegen/generate', (req, res) => {
    try {
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Request body must be a JSON object' });
      }
      const { template, params } = req.body;
      if (typeof template !== 'string' || !template) {
        return res.status(400).json({ error: '"template" field is required' });
      }
      const result = generateFromTemplate(template, params || {});
      res.json(result);
    } catch (err) {
      res.status(err.message.startsWith('Template not found') ? 404 : 400).json({ error: err.message });
    }
  });
}

// Domain-semantic error handler — handles domain errors (422) before the generic boundary
app.use(domainErrorHandler);

// Generic error boundary — fallback for all other errors
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (err.code === 'ETIMEDOUT') {
    return res.status(408).json({ error: 'Request Timeout' });
  }

  console.error('Error boundary caught:', err);
  res.status(status).json({ error: message });
});

module.exports = app;
