'use strict';

const NodeCache = require('node-cache');
const config = require('../config');

const cache = new NodeCache({ stdTTL: config.cache.ttl });

function responseCaching(req, res, next) {
  if (req.method !== 'GET') {
    return next();
  }

  const key = req.originalUrl || req.url;
  const cached = cache.get(key);

  if (cached !== undefined) {
    res.setHeader('X-Cache', 'HIT');
    res.status(cached.statusCode);
    if (cached.contentType) {
      res.setHeader('Content-Type', cached.contentType);
    }
    return res.send(cached.body);
  }

  res.setHeader('X-Cache', 'MISS');

  const originalSend = res.send.bind(res);
  res.send = function (body) {
    if (res.statusCode === 200) {
      cache.set(key, {
        statusCode: res.statusCode,
        contentType: res.getHeader('Content-Type'),
        body,
      });
    }
    return originalSend(body);
  };

  next();
}

module.exports = responseCaching;
