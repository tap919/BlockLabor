'use strict';

const config = require('../config');

const STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.failureThreshold = options.failureThreshold || config.circuitBreaker.failureThreshold;
    this.successThreshold = options.successThreshold || config.circuitBreaker.successThreshold;
    this.timeout = options.timeout || config.circuitBreaker.timeout;
  }

  async call(fn) {
    if (this.state === STATES.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.timeout) {
        this.state = STATES.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error(`Circuit breaker OPEN for service: ${this.name}`);
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  _onSuccess() {
    this.failureCount = 0;
    if (this.state === STATES.HALF_OPEN) {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.state = STATES.CLOSED;
        this.successCount = 0;
      }
    }
  }

  _onFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();
    if (this.state === STATES.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = STATES.OPEN;
    }
  }

  getState() {
    return this.state;
  }

  reset() {
    this.state = STATES.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}

const breakers = new Map();

function getCircuitBreaker(name, options = {}) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  return breakers.get(name);
}

module.exports = { CircuitBreaker, getCircuitBreaker, STATES };
