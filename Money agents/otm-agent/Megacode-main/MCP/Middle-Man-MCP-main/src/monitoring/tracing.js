'use strict';

const { v4: uuidv4 } = require('uuid');

function tracingMiddleware(req, res, next) {
  const traceId = req.headers['x-trace-id'] || uuidv4();
  const spanId = uuidv4().replace(/-/g, '').slice(0, 16);
  const startTime = Date.now();

  req.traceContext = { traceId, spanId, startTime };
  res.setHeader('x-trace-id', traceId);
  res.setHeader('x-span-id', spanId);

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(
      JSON.stringify({
        type: 'trace',
        traceId,
        spanId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: duration,
      })
    );
  });

  next();
}

module.exports = tracingMiddleware;
