'use strict';

function headerStripper(req, res, next) {
  const internalPattern = /^x-internal-/i;
  for (const header of Object.keys(req.headers)) {
    if (internalPattern.test(header)) {
      delete req.headers[header];
    }
  }
  next();
}

module.exports = headerStripper;
