'use strict';

/**
 * Domain-Semantic Error Reporting.
 *
 * Standard HTTP errors and generic stack traces are difficult to act on because
 * they are divorced from the application's domain vocabulary.  This module
 * provides error creation and validation utilities whose messages are rooted in
 * the semantics of the domain — e.g. "Payment amount must be a positive number"
 * rather than "TypeError: expected number".
 *
 * Key capabilities:
 *   1. createDomainError   — structured error objects with domain context
 *   2. validateDomainRules — validate a payload against declarative domain rules
 *                            and report violations in human-readable domain language
 *   3. domainErrorHandler  — Express error-handling middleware that translates
 *                            raw errors into domain-aware HTTP responses
 *   4. registerDomain      — register a named domain with its rule set so that
 *                            validators and the error handler can look rules up
 */

const domainRegistry = new Map(); // domainName → { rules, description }

// ─────────────────────────────────────────
// Domain registration
// ─────────────────────────────────────────

/**
 * Register a named domain together with its validation rule set.
 *
 * Rule shape:
 *   {
 *     field:    string,             // payload field this rule applies to
 *     required: boolean,            // whether the field must be present
 *     type:     'string'|'number'|'boolean'|'object'|'array', // optional type check
 *     validate: (value) => boolean, // optional custom predicate
 *     message:  string,             // domain-semantic error message
 *   }
 *
 * @param {string}   name        - Domain identifier (e.g. 'payment', 'user').
 * @param {Array}    rules       - Array of rule objects.
 * @param {object}   [options]   - Optional: { description }.
 * @returns {object} The registered domain record.
 */
function registerDomain(name, rules, options = {}) {
  if (typeof name !== 'string' || !name) throw new TypeError('Domain name must be a non-empty string');
  if (!Array.isArray(rules)) throw new TypeError('rules must be an array');

  for (const rule of rules) {
    if (typeof rule.field !== 'string' || !rule.field) {
      throw new TypeError('Each rule must have a non-empty string field');
    }
    if (typeof rule.message !== 'string' || !rule.message) {
      throw new TypeError('Each rule must have a non-empty string message');
    }
  }

  // Prevent accidental or malicious overwrites of existing domains.
  if (domainRegistry.has(name)) {
    throw new Error(`Domain '${name}' is already registered and cannot be overwritten`);
  }

  // Store an immutable copy of the rules and domain metadata to avoid mutation.
  const frozenRules = rules.map((rule) => Object.freeze({ ...rule }));
  const entry = Object.freeze({
    name,
    rules: frozenRules,
    description: options.description || '',
    registeredAt: Date.now(),
  });
  domainRegistry.set(name, entry);
  return entry;
}

/**
 * Retrieve a registered domain by name.
 *
 * @param {string} name - Domain name.
 * @returns {object|null}
 */
function getDomain(name) {
  return domainRegistry.get(name) || null;
}

/**
 * List all registered domains.
 *
 * @returns {Array<{ name, description, registeredAt }>}
 */
function listDomains() {
  return Array.from(domainRegistry.values()).map(({ name, description, registeredAt }) => ({
    name,
    description,
    registeredAt,
  }));
}

// ─────────────────────────────────────────
// Domain error creation
// ─────────────────────────────────────────

/**
 * Create a structured domain error object.
 * The returned object extends Error so it can be thrown and caught normally.
 *
 * @param {string} domain  - Domain context (e.g. 'payment').
 * @param {string} code    - Machine-readable error code (e.g. 'INVALID_AMOUNT').
 * @param {string} message - Human-readable domain-semantic message.
 * @param {object} [details] - Optional extra context (field, value, etc.).
 * @returns {Error} Enriched error object with domain metadata.
 */
function createDomainError(domain, code, message, details = {}) {
  if (typeof domain !== 'string' || !domain) throw new TypeError('domain must be a non-empty string');
  if (typeof code !== 'string' || !code) throw new TypeError('code must be a non-empty string');
  if (typeof message !== 'string' || !message) throw new TypeError('message must be a non-empty string');

  const err = new Error(message);
  err.domain = domain;
  err.code = code;
  err.details = details;
  err.isDomainError = true;
  err.timestamp = Date.now();
  return err;
}

// ─────────────────────────────────────────
// Domain rule validation
// ─────────────────────────────────────────

/**
 * Validate a payload against the rules of a registered domain.
 * Reports violations using domain-semantic messages rather than generic type errors.
 *
 * @param {string} domainName - Name of the registered domain.
 * @param {object} payload    - Object to validate.
 * @returns {{ valid: boolean, errors: Array<{ field, code, message }> }}
 */
function validateDomainRules(domainName, payload) {
  const domain = domainRegistry.get(domainName);
  if (!domain) throw new Error(`Domain not registered: ${domainName}`);
  if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('payload must be a non-null plain object');
  }

  const errors = [];

  for (const rule of domain.rules) {
    const value = payload[rule.field];
    const missing = value === undefined || value === null;

    if (rule.required && missing) {
      errors.push({ field: rule.field, code: 'REQUIRED', message: rule.message });
      continue;
    }

    if (!missing && rule.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== rule.type) {
        errors.push({ field: rule.field, code: 'TYPE_MISMATCH', message: rule.message });
        continue;
      }
    }

    if (!missing && typeof rule.validate === 'function') {
      let passed;
      try {
        passed = rule.validate(value);
      } catch {
        passed = false;
      }
      if (!passed) {
        errors.push({ field: rule.field, code: 'VALIDATION_FAILED', message: rule.message });
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────
// Express error-handling middleware
// ─────────────────────────────────────────

/**
 * Express error-handling middleware that translates domain errors into structured
 * 422 Unprocessable Entity responses with full domain context.  All other errors
 * are passed to the next error handler via next(err) so the generic error boundary
 * remains responsible for them.
 *
 * Must be registered BEFORE the generic error boundary so domain errors are
 * intercepted before the fallback handler sends a response:
 *   app.use(domainErrorHandler);
 *   app.use(genericErrorBoundary);
 */
function domainErrorHandler(err, req, res, next) {
  if (err.isDomainError) {
    return res.status(422).json({
      error: {
        domain: err.domain,
        code: err.code,
        message: err.message,
        details: err.details || {},
        timestamp: err.timestamp,
      },
    });
  }
  return next(err);
}

module.exports = {
  registerDomain,
  getDomain,
  listDomains,
  createDomainError,
  validateDomainRules,
  domainErrorHandler,
};
