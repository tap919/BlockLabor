'use strict';

const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const config = require('../config');
const responseCaching = require('../features/responseCaching');

function createServiceProxy(target, options = {}) {
  const proxyMiddleware = createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: undefined,
    on: {
      error: (err, req, res) => {
        console.error(`Proxy error to ${target}:`, err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Bad Gateway', message: err.message });
        }
      },
    },
  });

  return function serviceProxy(req, res, next) {
    if (options.auth) {
      const authHeader = req.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
      }
      try {
        jwt.verify(authHeader.slice(7), config.jwt.secret);
      } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
      }
    }

    if (options.cache) {
      return responseCaching(req, res, () => proxyMiddleware(req, res, next));
    }

    proxyMiddleware(req, res, next);
  };
}

module.exports = { createServiceProxy };
