'use strict';

const timeout = require('connect-timeout');
const config = require('../config');

function timeoutMiddleware(req, res, next) {
  timeout(config.timeout.duration)(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}

module.exports = timeoutMiddleware;
