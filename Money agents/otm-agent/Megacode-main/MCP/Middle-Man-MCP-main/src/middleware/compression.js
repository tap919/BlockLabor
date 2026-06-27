'use strict';

const compression = require('compression');
const config = require('../config');

module.exports = compression({ threshold: config.compression.threshold });
