'use strict';

const cors = require('cors');
const config = require('../config');

const corsOptions = {
  origin: config.cors.origin,
  credentials: config.cors.credentials,
};

module.exports = cors(corsOptions);
