'use strict';

/**
 * Service Discovery registry.
 *
 * Allows services to register themselves and be located by name,
 * eliminating hardcoded endpoints (Feature 5: Service Discovery and Dynamic Binding).
 * Provides location transparency so consumers don't need to know where a service is hosted.
 */

const registry = new Map();

/**
 * Register a service with the discovery registry.
 *
 * @param {string} name     - Unique service name.
 * @param {string} url      - Base URL of the service.
 * @param {object} metadata - Optional metadata (version, owner, etc.).
 */
function register(name, url, metadata = {}) {
  if (typeof name !== 'string' || !name) throw new TypeError('Service name must be a non-empty string');
  if (typeof url !== 'string' || !url) throw new TypeError('Service url must be a non-empty string');
  registry.set(name, {
    name,
    url,
    metadata,
    registeredAt: Date.now(),
    healthy: true,
  });
}

/**
 * Discover a service by name and return its registration record.
 * Throws if the service is unknown or currently marked unhealthy.
 *
 * @param {string} name - Service name.
 * @returns {{ name, url, metadata, registeredAt, healthy }}
 */
function discover(name) {
  const service = registry.get(name);
  if (!service) throw new Error(`Service not found: ${name}`);
  if (!service.healthy) throw new Error(`Service unhealthy: ${name}`);
  return service;
}

/**
 * List all registered services (healthy and unhealthy).
 *
 * @returns {Array} Array of service registration records.
 */
function list() {
  return Array.from(registry.values());
}

/**
 * Update the health status of a registered service.
 *
 * @param {string}  name    - Service name.
 * @param {boolean} healthy - New health status.
 */
function updateHealth(name, healthy) {
  const service = registry.get(name);
  if (service) {
    service.healthy = Boolean(healthy);
  }
}

/**
 * Remove a service from the registry.
 *
 * @param {string} name - Service name.
 * @returns {boolean} True if the service existed and was removed.
 */
function deregister(name) {
  return registry.delete(name);
}

module.exports = { register, discover, list, updateHealth, deregister };
