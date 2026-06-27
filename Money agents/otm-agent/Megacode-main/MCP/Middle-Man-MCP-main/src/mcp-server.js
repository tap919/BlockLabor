'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// ─────────────────────────────────────────
// Feature module imports
// ─────────────────────────────────────────
const {
  listTemplates,
  getTemplate,
  generateFromTemplate,
} = require('./features/codeGenerator.js');

const {
  register,
  discover,
  list,
} = require('./features/serviceDiscovery.js');

const {
  defineInterface,
  getInterface,
  validateInterface,
  listInterfaces,
} = require('./features/interfaceRegistry.js');

const {
  registerDomain,
  getDomain,
  listDomains,
  validateDomainRules,
} = require('./features/domainErrorReporter.js');

const {
  createFlow,
  getAllFlows,
  getFlowStatus,
} = require('./features/workflowOrchestrator.js');

const { getCircuitBreaker } = require('./features/circuitBreaker.js');

const {
  record,
  getProvenance,
  listTrackedKeys,
} = require('./features/contextProvenance.js');

const config = require('./config');

// ─────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────

const TOOLS = [
  // ── Code Generator ──
  {
    name: 'list_code_templates',
    description:
      'List all available MDSD code generation templates with their descriptions and required parameters. ' +
      'Templates include: react-query-hook, websocket-hook, auth-provider, api-service, event-stream-hook.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'generate_code',
    description:
      'Generate code from a named template. Provide the template name and a params object with ' +
      'template-specific parameters (e.g. hookName, endpoint, serviceName, basePath, loginEndpoint, path, queryKey).',
    inputSchema: {
      type: 'object',
      properties: {
        template: {
          type: 'string',
          description:
            'Template name: react-query-hook | websocket-hook | auth-provider | api-service | event-stream-hook',
        },
        params: {
          type: 'object',
          description: 'Template-specific parameters (e.g. { hookName: "useUsers", endpoint: "/api/users" })',
        },
      },
      required: ['template'],
    },
  },

  // ── Service Discovery ──
  {
    name: 'register_service',
    description:
      'Register a service in the in-memory service discovery registry. ' +
      'Provides location transparency so consumers do not need hardcoded endpoints.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Unique service name' },
        url: { type: 'string', description: 'Base URL of the service' },
        metadata: {
          type: 'object',
          description: 'Optional metadata (version, owner, tags, etc.)',
        },
      },
      required: ['name', 'url'],
    },
  },
  {
    name: 'discover_service',
    description:
      'Look up a registered service by name. Returns the service record including URL, metadata, and health status.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Service name to discover' },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_services',
    description: 'List all services registered in the service discovery registry (healthy and unhealthy).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ── Interface Registry ──
  {
    name: 'define_interface',
    description:
      'Define a named interface schema for standardized port definitions. ' +
      'Schema may include operations (array of operation names), required fields, ' +
      'properties with type constraints, and a conflictResolution strategy.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Interface name' },
        schema: {
          type: 'object',
          description:
            'Interface schema: { operations?: string[], required?: string[], properties?: { field: { type } }, conflictResolution?: "last-write-wins" | "first-write-wins" }',
        },
      },
      required: ['name', 'schema'],
    },
  },
  {
    name: 'validate_interface',
    description:
      'Validate a payload against a previously defined interface schema. ' +
      'Returns { valid: boolean, errors: string[] }.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Interface name to validate against' },
        payload: { type: 'object', description: 'Payload object to validate' },
      },
      required: ['name', 'payload'],
    },
  },
  {
    name: 'list_interfaces',
    description: 'List all defined interface schemas with their names, operations, required fields, and conflict resolution strategies.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ── Domain Error Reporter ──
  {
    name: 'register_domain',
    description:
      'Register a domain with its validation rules for domain-semantic error reporting. ' +
      'Each rule must have: field (string), message (string), and optionally: required (boolean), ' +
      'type ("string"|"number"|"boolean"|"object"|"array").',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Domain identifier (e.g. "payment", "user")' },
        rules: {
          type: 'array',
          description:
            'Array of rule objects: [{ field: string, message: string, required?: boolean, type?: string }]',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string' },
              message: { type: 'string' },
              required: { type: 'boolean' },
              type: { type: 'string' },
            },
            required: ['field', 'message'],
          },
        },
        description: {
          type: 'string',
          description: 'Human-readable description of the domain',
        },
      },
      required: ['name', 'rules'],
    },
  },
  {
    name: 'validate_domain',
    description:
      'Validate a payload against a registered domain\'s rules. ' +
      'Returns { valid: boolean, errors: [{ field, code, message }] } with domain-semantic messages.',
    inputSchema: {
      type: 'object',
      properties: {
        domainName: { type: 'string', description: 'Registered domain name' },
        payload: { type: 'object', description: 'Payload to validate' },
      },
      required: ['domainName', 'payload'],
    },
  },
  {
    name: 'list_domains',
    description: 'List all registered domains with their names, descriptions, and registration timestamps.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ── Workflow Orchestrator ──
  {
    name: 'create_workflow',
    description:
      'Create a workflow (flow) definition with named tasks. Since functions cannot be passed via MCP, ' +
      'this creates a stub workflow with placeholder tasks that log their names. ' +
      'Tasks can be described for documentation purposes.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Unique flow name' },
        tasks: {
          type: 'array',
          description: 'Array of task definitions: [{ name: string, description?: string }]',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Task name' },
              description: { type: 'string', description: 'Description of what this task does' },
            },
            required: ['name'],
          },
        },
      },
      required: ['name', 'tasks'],
    },
  },
  {
    name: 'list_workflows',
    description: 'List all registered workflow flows with their status, task count, and last run info.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },

  // ── Circuit Breaker ──
  {
    name: 'get_circuit_breaker_state',
    description:
      'Get the current state (CLOSED, OPEN, or HALF_OPEN) of a named circuit breaker, ' +
      'along with failure count and threshold information.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Circuit breaker name' },
      },
      required: ['name'],
    },
  },

  // ── Context Provenance ──
  {
    name: 'record_provenance',
    description:
      'Record a data provenance entry, tracking the origin, source, and metadata of a value for a given key.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Data key (e.g. "user.location", "temperature")' },
        value: { description: 'The value being recorded (any JSON type)' },
        source: { type: 'string', description: 'Identifier of the source providing the value' },
        metadata: {
          type: 'object',
          description: 'Optional metadata (e.g. { confidence: 0.95, region: "us-east-1" })',
        },
      },
      required: ['key', 'value', 'source'],
    },
  },
  {
    name: 'get_provenance',
    description:
      'Retrieve the full provenance history for a data key. Returns an array of provenance records ordered oldest-first.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Data key to look up' },
      },
      required: ['key'],
    },
  },

  // ── Proxy Configuration ──
  {
    name: 'get_proxy_config',
    description:
      'Return the current Middle Man proxy configuration including registered services, ' +
      'routes, middleware chain, and feature flags.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
];

// ─────────────────────────────────────────
// Tool handlers
// ─────────────────────────────────────────

/**
 * Wrap a handler so errors are returned as MCP tool error responses
 * instead of crashing the server.
 */
function handleTool(fn) {
  try {
    const result = fn();
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: err.message }, null, 2),
        },
      ],
      isError: true,
    };
  }
}

function dispatchTool(name, args) {
  switch (name) {
    // ── Code Generator ──
    case 'list_code_templates':
      return handleTool(() => listTemplates());

    case 'generate_code':
      return handleTool(() => {
        const { template, params = {} } = args;
        return generateFromTemplate(template, params);
      });

    // ── Service Discovery ──
    case 'register_service':
      return handleTool(() => {
        const { name: svcName, url, metadata = {} } = args;
        register(svcName, url, metadata);
        return {
          registered: true,
          service: { name: svcName, url, metadata },
        };
      });

    case 'discover_service':
      return handleTool(() => {
        return discover(args.name);
      });

    case 'list_services':
      return handleTool(() => list());

    // ── Interface Registry ──
    case 'define_interface':
      return handleTool(() => {
        const { name: ifaceName, schema } = args;
        const result = defineInterface(ifaceName, schema);
        return { defined: true, name: ifaceName, schema: result };
      });

    case 'validate_interface':
      return handleTool(() => {
        const { name: ifaceName, payload } = args;
        return validateInterface(ifaceName, payload);
      });

    case 'list_interfaces':
      return handleTool(() => listInterfaces());

    // ── Domain Error Reporter ──
    case 'register_domain':
      return handleTool(() => {
        const { name: domainName, rules, description = '' } = args;
        return registerDomain(domainName, rules, { description });
      });

    case 'validate_domain':
      return handleTool(() => {
        const { domainName, payload } = args;
        return validateDomainRules(domainName, payload);
      });

    case 'list_domains':
      return handleTool(() => listDomains());

    // ── Workflow Orchestrator ──
    case 'create_workflow':
      return handleTool(() => {
        const { name: flowName, tasks: taskDefs } = args;
        // Since we can't pass actual functions over MCP, create stub tasks
        // that return their description as context. The createTask function
        // is imported from the orchestrator indirectly through createFlow.
        const { createTask } = require('./features/workflowOrchestrator.js');
        const tasks = taskDefs.map((t) =>
          createTask(t.name, (ctx) => {
            return { stub: true, task: t.name, description: t.description || 'No description', context: ctx };
          })
        );
        const flow = createFlow(flowName, tasks);
        return {
          created: true,
          name: flow.name,
          taskCount: flow.tasks.length,
          tasks: flow.tasks.map((t) => t.name),
          createdAt: flow.createdAt,
        };
      });

    case 'list_workflows':
      return handleTool(() => getAllFlows());

    // ── Circuit Breaker ──
    case 'get_circuit_breaker_state':
      return handleTool(() => {
        const breaker = getCircuitBreaker(args.name);
        return {
          name: breaker.name,
          state: breaker.getState(),
          failureCount: breaker.failureCount,
          failureThreshold: breaker.failureThreshold,
          successCount: breaker.successCount,
          successThreshold: breaker.successThreshold,
          lastFailureTime: breaker.lastFailureTime,
          timeout: breaker.timeout,
        };
      });

    // ── Context Provenance ──
    case 'record_provenance':
      return handleTool(() => {
        const { key, value, source, metadata = {} } = args;
        return record(key, value, source, { metadata });
      });

    case 'get_provenance':
      return handleTool(() => {
        const history = getProvenance(args.key);
        return {
          key: args.key,
          recordCount: history.length,
          records: history,
        };
      });

    // ── Proxy Configuration ──
    case 'get_proxy_config':
      return handleTool(() => {
        return {
          services: config.services,
          middleware: [
            'cors',
            'compression',
            'rateLimiter',
            'helmet',
            'logging (morgan)',
            'headerStripper',
            'requestId',
            'logSanitizer',
            'auth (JWT)',
            'bodyParser',
            'timeout',
            'tracing',
            'metricsMiddleware (prometheus)',
          ],
          features: {
            serviceDiscovery: { enabled: config.serviceDiscovery.enabled },
            provenance: { enabled: config.provenance.enabled, maxRecordsPerKey: config.provenance.maxRecordsPerKey },
            domainErrors: { enabled: config.domainErrors.enabled },
            codeGenerator: { enabled: config.codeGenerator.enabled },
            circuitBreaker: config.circuitBreaker,
            retry: config.retry,
            workflow: config.workflow,
          },
          webhooks: {
            stripe: { path: config.webhooks.stripe.path },
            github: { path: config.webhooks.github.path, events: config.webhooks.github.events },
          },
          monitoring: config.monitoring,
          rateLimit: { windowMs: config.rateLimit.windowMs, max: config.rateLimit.max },
        };
      });

    default:
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2),
          },
        ],
        isError: true,
      };
  }
}

// ─────────────────────────────────────────
// Server setup and startup
// ─────────────────────────────────────────

async function main() {
  const server = new Server(
    {
      name: 'middleman-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register the tool listing handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Register the tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    return dispatchTool(name, args);
  });

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with the MCP stdio protocol
  console.error('Middle Man MCP server running on stdio');
}

main().catch((err) => {
  console.error('Fatal error starting MCP server:', err);
  process.exit(1);
});
