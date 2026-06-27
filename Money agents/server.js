const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3006;
const MVP_HOST = '127.0.0.1';
const MVP_PORT = 8010;

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // Proxy /api/* to MVP
  if (url.startsWith('/api/')) {
    const targetPath = url.replace('/api', '');
    const proxyReq = http.request({ hostname: MVP_HOST, port: MVP_PORT, path: targetPath, method: req.method, headers: req.headers }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      proxyRes.pipe(res);
    });
    req.pipe(proxyReq);
    proxyReq.on('error', (e) => { res.writeHead(502); res.end(JSON.stringify({error:e.message})); });
    return;
  }

  let filePath = url === '/' ? '/standalone-dashboard.html' : url;
  const fullPath = path.join(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) { res.writeHead(404); res.end('Not Found'); return; }

  res.writeHead(200);
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, () => console.log(`Dashboard: http://127.0.0.1:${PORT}/`));