'use strict';

const { v4: uuidv4 } = require('uuid');

function requestId(req, res, next) {
  const id = req.headers['x-request-id'] || uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('x-request-id', id);
  req.requestId = id;
  next();
}

module.exports = requestId;
