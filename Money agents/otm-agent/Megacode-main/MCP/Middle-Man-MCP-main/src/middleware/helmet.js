'use strict';

const helmet = require('helmet');

module.exports = helmet({
  dnsPrefetchControl: false,
});
