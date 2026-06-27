'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');

function isExcluded(path) {
  for (const pattern of config.jwt.exclude) {
    if (pattern === path) return true;
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (path === prefix || path.startsWith(prefix + '/')) return true;
    }
  }
  return false;
}

function authMiddleware(req, res, next) {
  if (isExcluded(req.path)) {
    return next();
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
