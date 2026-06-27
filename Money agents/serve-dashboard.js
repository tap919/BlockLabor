const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 3006;
const MVP = '127.0.0.1';
const MVP_PORT = 8010;

const route = (req, res) => {
  const url = req.url.split('?')[0];

  // API proxy
  if (url.startsWith('/api/')) {
    const target = url.replace('/api', '');
    const options = {
      hostname: MVP,
      port: MVP_PORT,
      path: target,
      method: req.method,
      headers: { 'Content-Type': 'application/json' }
    };

    const proxy = http.request(options, (r) => {
      res.writeHead(r.statusCode, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      r.pipe(res);
    });

    proxy.on('error', (e) => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    });

    if (req.method === 'POST') {
      let data = '';
      req.on('data', chunk => data += chunk);
      req.on('end', () => { proxy.write(data); proxy.end(); });
    } else {
      proxy.end();
    }
    return;
  }

  // Serve dashboard
  const file = url === '/' ? '/dashboard.html' : url;
  const fullPath = path.join(__dirname, file);

  if (!fs.existsSync(fullPath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  res.writeHead(200);
  fs.createReadStream(fullPath).pipe(res);
};

http.createServer(route).listen(PORT, () => {
  console.log(`Dashboard: http://127.0.0.1:${PORT}/`);
  console.log(`API: http://127.0.0.1:${PORT}/api/* -> localhost:${MVP_PORT}`);
});