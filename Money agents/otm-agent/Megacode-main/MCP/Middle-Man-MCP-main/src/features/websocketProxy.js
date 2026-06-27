'use strict';

const WebSocket = require('ws');
const http = require('http');
const url = require('url');

function setupWebsocketProxy(server, services) {
  const wss = new WebSocket.Server({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const pathname = url.parse(request.url).pathname;

    let target = null;
    for (const service of services) {
      const pattern = service.path.replace(/\/\*$/, '');
      if (pathname.startsWith(pattern)) {
        target = service.target;
        break;
      }
    }

    if (!target) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      const targetUrl = target.startsWith('http') ? target.replace(/^http/, 'ws') : `ws://${target}`;
      const upstreamWs = new WebSocket(`${targetUrl}${request.url}`);

      upstreamWs.on('open', () => {
        ws.on('message', (msg) => upstreamWs.send(msg));
        upstreamWs.on('message', (msg) => ws.send(msg));
      });

      upstreamWs.on('error', () => {
        ws.close(1011, 'Upstream error');
      });

      ws.on('close', () => {
        if (upstreamWs.readyState === WebSocket.OPEN) {
          upstreamWs.close();
        }
      });

      upstreamWs.on('close', () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });
    });
  });

  return wss;
}

module.exports = { setupWebsocketProxy };
