'use strict';

const crypto = require('crypto');

const env = process.env.NODE_ENV || 'development';

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  if (env === 'production') {
    console.error('FATAL: JWT_SECRET environment variable must be set in production');
    process.exit(1);
  }
  jwtSecret = crypto.randomBytes(32).toString('hex');
}

const config = {
  env,
  port: parseInt(process.env.PORT, 10) || 8080,

  jwt: {
    secret: jwtSecret,
    exclude: ['/health', '/public/*'],
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    message: 'Too many requests',
  },

  compression: {
    threshold: 1024,
  },

  cors: {
    // reflect the request origin so credentials can be included;
    // set CORS_ORIGINS env var to a comma-separated list to restrict in production
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : true,
    credentials: true,
  },

  bodyParser: {
    jsonLimit: '10mb',
    urlencodedExtended: true,
  },

  timeout: {
    duration: '30s',
  },

  cache: {
    ttl: 60,
    cacheHeadersTtl: 300,
  },

  services: {
    users: {
      path: '/api/users/*',
      target: process.env.USER_SERVICE_URL || 'http://user-service:3001',
      rewrite: true,
    },
    payments: {
      path: '/api/payments/*',
      target: process.env.PAYMENT_SERVICE_URL || 'http://payment-service:3002',
      auth: true,
    },
    media: {
      path: '/api/media/*',
      target: process.env.CDN_URL || 'http://cdn:8080',
      cache: true,
    },
  },

  webhooks: {
    stripe: {
      secret: process.env.STRIPE_WEBHOOK_SECRET || '',
      path: '/webhook/stripe',
      timeout: '10s',
    },
    github: {
      secret: process.env.GITHUB_WEBHOOK_SECRET || '',
      path: '/webhook/github',
      events: ['push', 'pull_request'],
    },
  },

  monitoring: {
    prometheus: true,
    tracing: true,
    healthPath: '/health',
    logLevel: 'info',
  },

  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    timeout: 30000,
  },

  retry: {
    retries: 3,
    delay: 1000,
    backoff: 2,
  },

  // Workflow orchestration (Feature 4: structured flows and tasks)
  workflow: {
    maxRunsPerFlow: 100,
  },

  // Service discovery (Feature 5: dynamic binding, location transparency)
  serviceDiscovery: {
    enabled: true,
  },

  // Context Provenance (origin tracking for heterogeneous data sources)
  provenance: {
    enabled: true,
    maxRecordsPerKey: 1000,
  },

  // Domain Error Reporter (domain-semantic validation and error messages)
  domainErrors: {
    enabled: true,
  },

  // Code Generator (MDSD-style React template generation)
  codeGenerator: {
    enabled: true,
  },
};

module.exports = config;
