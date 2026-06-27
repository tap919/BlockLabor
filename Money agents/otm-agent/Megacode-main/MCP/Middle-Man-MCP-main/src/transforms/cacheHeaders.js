'use strict';

const config = require('../config');

function cacheHeaders(req, res, next) {
  const ttl = config.cache.cacheHeadersTtl;
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', `public, max-age=${ttl}`);
  } else {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
}

module.exports = cacheHeaders;
