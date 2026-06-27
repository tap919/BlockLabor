'use strict';

/**
 * Context Provenance — Origin Tracking.
 *
 * Tracks the origin, timestamp, and source metadata of every piece of contextual
 * data flowing through the middleware layer.  When multiple heterogeneous sources
 * provide values for the same key, provenance records allow the system to assess
 * reliability, detect conflicts, and resolve them deterministically rather than
 * silently discarding information.
 *
 * Provenance entry shape:
 *   {
 *     key:       string,          // the data key being tracked
 *     source:    string,          // name / identifier of the producing service or component
 *     value:     *,               // the data value at the time of recording
 *     timestamp: number,          // epoch ms
 *     requestId: string|null,     // optional correlation identifier
 *     metadata:  object,          // arbitrary caller-supplied metadata
 *   }
 */

const config = require('../config');

const provenanceStore = new Map(); // key → Array<ProvenanceEntry>

/** Maximum number of entries retained per key (prevents unbounded memory growth). */
const MAX_RECORDS_PER_KEY = config.provenance.maxRecordsPerKey || 1000;

/**
 * Record a new provenance entry for a data key.
 * When the number of entries for a key reaches MAX_RECORDS_PER_KEY, the oldest
 * entry is evicted to prevent unbounded memory growth.
 *
 * @param {string} key       - The data key (e.g. 'user.location', 'temperature').
 * @param {*}      value     - The value being recorded.
 * @param {string} source    - Identifier of the source providing the value.
 * @param {object} [options] - Optional: { requestId, metadata }.
 * @returns {object} The created provenance entry.
 */
function record(key, value, source, options = {}) {
  if (typeof key !== 'string' || !key) throw new TypeError('key must be a non-empty string');
  if (typeof source !== 'string' || !source) throw new TypeError('source must be a non-empty string');

  const entry = {
    key,
    source,
    value,
    timestamp: Date.now(),
    requestId: options.requestId || null,
    metadata: options.metadata && typeof options.metadata === 'object' ? options.metadata : {},
  };

  if (!provenanceStore.has(key)) {
    provenanceStore.set(key, []);
  }
  const entries = provenanceStore.get(key);
  entries.push(entry);
  if (entries.length > MAX_RECORDS_PER_KEY) {
    entries.shift(); // evict oldest entry (FIFO)
  }
  return entry;
}


/**
 * Retrieve the full provenance history for a data key.
 *
 * @param {string} key - The data key.
 * @returns {Array<object>} Ordered array of provenance records (oldest first).
 */
function getProvenance(key) {
  if (typeof key !== 'string' || !key) throw new TypeError('key must be a non-empty string');
  return (provenanceStore.get(key) || []).slice();
}

/**
 * Resolve the current authoritative value for a key by applying a conflict
 * resolution strategy across all recorded provenance entries.
 *
 * Strategies:
 *   'latest'             — return the most recently recorded value (default)
 *   'highest-confidence' — return the entry whose metadata.confidence is highest
 *   'first'              — return the earliest recorded value
 *
 * @param {string} key      - The data key.
 * @param {string} strategy - Conflict resolution strategy.
 * @returns {{ value: *, record: object }} The winning value and its provenance record.
 */
function resolveWithProvenance(key, strategy = 'latest') {
  if (typeof key !== 'string' || !key) throw new TypeError('key must be a non-empty string');

  const entries = provenanceStore.get(key);
  if (!entries || entries.length === 0) throw new Error(`No provenance records found for key: ${key}`);

  const VALID_STRATEGIES = new Set(['latest', 'highest-confidence', 'first']);
  if (!VALID_STRATEGIES.has(strategy)) {
    throw new TypeError(`strategy must be one of: ${[...VALID_STRATEGIES].join(', ')}`);
  }

  let winner;
  if (strategy === 'first') {
    winner = entries[0];
  } else if (strategy === 'highest-confidence') {
    winner = entries.reduce((best, e) => {
      const bConf = (best.metadata && best.metadata.confidence) || 0;
      const eConf = (e.metadata && e.metadata.confidence) || 0;
      return eConf > bConf ? e : best;
    });
  } else {
    // 'latest' — most recently recorded
    winner = entries[entries.length - 1];
  }

  return { value: winner.value, record: winner };
}

/**
 * List all keys that have at least one provenance record.
 *
 * @returns {string[]}
 */
function listTrackedKeys() {
  return Array.from(provenanceStore.keys());
}

/**
 * Remove all provenance records for a key (e.g. after request completes).
 *
 * @param {string} key - The data key to clear.
 * @returns {boolean} True if records existed and were removed.
 */
function clearProvenance(key) {
  if (typeof key !== 'string' || !key) throw new TypeError('key must be a non-empty string');
  return provenanceStore.delete(key);
}

/**
 * Express middleware that automatically records request context provenance
 * (method, path, source IP, request ID) so downstream handlers can trace origins.
 *
 * @param {string} [defaultSource='request'] - Source label to attach to each entry.
 */
function provenanceMiddleware(defaultSource = 'request') {
  return function (req, _res, next) {
    const requestId = req.headers['x-request-id'] || null;
    const key = `${req.method}:${req.path}`;
    record(key, { method: req.method, path: req.path, ip: req.ip }, defaultSource, {
      requestId,
      metadata: { userAgent: req.headers['user-agent'] || null },
    });
    next();
  };
}

module.exports = { record, getProvenance, resolveWithProvenance, listTrackedKeys, clearProvenance, provenanceMiddleware };
