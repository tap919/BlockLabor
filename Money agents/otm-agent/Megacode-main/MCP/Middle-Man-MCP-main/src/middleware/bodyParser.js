'use strict';

const bodyParser = require('body-parser');
const config = require('../config');

const jsonParser = bodyParser.json({ limit: config.bodyParser.jsonLimit });
const urlencodedParser = bodyParser.urlencoded({ extended: config.bodyParser.urlencodedExtended });

function bodyParserMiddleware(req, res, next) {
  jsonParser(req, res, (err) => {
    if (err) return next(err);
    urlencodedParser(req, res, next);
  });
}

module.exports = bodyParserMiddleware;
