'use strict';

/**
 * Interface Registry.
 *
 * Enforces standardized interface and port definitions before logic is implemented
 * (Feature 6: Standardized Interface and Port Definitions).
 * Provides validation and conflict resolution so the middleware layer can reconcile
 * mismatches between providers without ad hoc glue code.
 *
 * Schema shape:
 *   {
 *     operations: ['op1', 'op2'],           // optional list of supported operations
 *     required:   ['field1', 'field2'],     // required payload fields
 *     properties: {                         // optional type constraints
 *       field1: { type: 'string' },
 *       count:  { type: 'number' },
 *     },
 *     conflictResolution: 'last-write-wins' // 'last-write-wins' (default) | 'first-write-wins'
 *   }
 */

const interfaceRegistry = new Map();

const VALID_CONFLICT_STRATEGIES = new Set(['last-write-wins', 'first-write-wins']);

/**
 * Define (or overwrite) a named interface schema.
 *
 * @param {string} name   - Interface name.
 * @param {object} schema - Interface schema definition.
 * @returns {object} The stored schema.
 */
function defineInterface(name, schema) {
  if (typeof name !== 'string' || !name) throw new TypeError('Interface name must be a non-empty string');
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) throw new TypeError('Schema must be a plain object');
  if (schema.required !== undefined && !Array.isArray(schema.required)) {
    throw new TypeError('schema.required must be an array');
  }
  if (schema.properties !== undefined && (typeof schema.properties !== 'object' || Array.isArray(schema.properties) || schema.properties === null)) {
    throw new TypeError('schema.properties must be a plain object');
  }
  if (schema.conflictResolution !== undefined && !VALID_CONFLICT_STRATEGIES.has(schema.conflictResolution)) {
    throw new TypeError(`schema.conflictResolution must be one of: ${[...VALID_CONFLICT_STRATEGIES].join(', ')}`);
  }
  interfaceRegistry.set(name, { name, schema, definedAt: Date.now() });
  return schema;
}

/**
 * Retrieve a registered interface definition by name.
 *
 * @param {string} name - Interface name.
 * @returns {{ name, schema, definedAt } | null}
 */
function getInterface(name) {
  return interfaceRegistry.get(name) || null;
}

/**
 * Validate a payload against a named interface schema.
 * Checks required fields and basic type constraints.
 *
 * @param {string} name    - Interface name.
 * @param {object} payload - Payload to validate.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInterface(name, payload) {
  const iface = interfaceRegistry.get(name);
  if (!iface) throw new Error(`Interface not defined: ${name}`);
  if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('payload must be a non-null object');
  }

  const errors = [];
  const { schema } = iface;

  if (schema.required) {
    for (const field of schema.required) {
      if (payload[field] === undefined || payload[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.properties) {
    for (const [field, def] of Object.entries(schema.properties)) {
      if (payload[field] !== undefined && def.type) {
        if (typeof payload[field] !== def.type) {
          errors.push(`Field '${field}': expected ${def.type}, got ${typeof payload[field]}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Resolve a conflict when multiple sources provide differing values for the same field.
 * Strategy is read from the interface schema's `conflictResolution` property.
 *
 * @param {string} name    - Interface name.
 * @param {Array}  sources - Ordered array of candidate values (first registered = index 0).
 * @returns {*} The winning value.
 */
function resolveConflict(name, sources) {
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new TypeError('sources must be a non-empty array');
  }
  const iface = interfaceRegistry.get(name);
  if (!iface) throw new Error(`Interface not defined: ${name}`);

  const strategy = (iface.schema && iface.schema.conflictResolution) || 'last-write-wins';
  if (strategy === 'first-write-wins') {
    return sources[0];
  }
  // Default strategy: last-write-wins
  return sources[sources.length - 1];
}

/**
 * List all registered interfaces (for observability).
 *
 * @returns {Array<{ name, definedAt, operations, required }>}
 */
function listInterfaces() {
  return Array.from(interfaceRegistry.values()).map(({ name, schema, definedAt }) => ({
    name,
    definedAt,
    operations: schema.operations || [],
    required: schema.required || [],
    conflictResolution: schema.conflictResolution || 'last-write-wins',
  }));
}

module.exports = { defineInterface, getInterface, validateInterface, resolveConflict, listInterfaces };
