'use strict';

const http = require('http');
const app = require('./app');
const config = require('./config');
const { setupWebsocketProxy } = require('./features/websocketProxy');

const PORT = config.port;

const server = http.createServer(app);

// WebSocket proxy
const wsServices = Object.values(config.services);
setupWebsocketProxy(server, wsServices);

server.listen(PORT, () => {
  console.log(`Middleman proxy server running on port ${PORT} [${config.env}]`);
});

function gracefulShutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    console.log('Server closed.');
    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
