const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3006;
const MVP = '127.0.0.1';
const MVP_PORT = 8010;
const BASE_DIR = __dirname;

const route = (req, res) => {
  const url = req.url.split('?')[0];

  if (url.startsWith('/api/')) {
    const targetPath = url.replace('/api', '');

    const options = {
      hostname: MVP,
      port: MVP_PORT,
      path: targetPath,
      method: req.method,
      headers: { 'Content-Type': 'application/json' }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'MVP Error: ' + e.message }));
    });

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        if (body) proxyReq.write(body);
        proxyReq.end();
      });
    } else {
      proxyReq.end();
    }
    return;
  }

  const filePath = url === '/' ? '/standalone-dashboard.html' : url;
  const fullPath = path.join(BASE_DIR, filePath);

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

  res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
  fs.createReadStream(fullPath).pipe(res);
};

http.createServer(route).listen(PORT, () => {
  console.log(`Money Agents: http://127.0.0.1:${PORT}/`);
});