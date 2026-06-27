'use strict';

async function withRetry(fn, options = {}) {
  const { retries = 3, delay = 1000, backoff = 2 } = options;
  let lastError;
  let currentDelay = delay;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
        currentDelay *= backoff;
      }
    }
  }

  throw lastError;
}

module.exports = { withRetry };
