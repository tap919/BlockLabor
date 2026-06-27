'use strict';

const SENSITIVE_FIELDS = ['password', 'token'];

function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = Array.isArray(obj) ? [] : {};
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      result[key] = sanitize(obj[key]);
    } else {
      result[key] = obj[key];
    }
  }
  return result;
}

// Sanitizes req.body in-place so that sensitive fields are never forwarded
// to downstream services or written to logs by subsequent middleware.
function logSanitizer(req, res, next) {
  if (req.body) {
    req.body = sanitize(req.body);
  }
  next();
}

module.exports = logSanitizer;
