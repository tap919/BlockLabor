const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = process.env.PORT || 3006;
const MVP_PORT = 8010;
const BASE_DIR = __dirname;

function startMVP() {
  const mvpPath = path.join(BASE_DIR, 'Sports-Steve-main', 'new_sports_steve', 'backend');
  if (!fs.existsSync(path.join(mvpPath, 'main.py'))) {
    console.log('MVP not found at:', mvpPath);
    return;
  }
  
  spawn('python', ['-m', 'uvicorn', 'main:app', '--port', MVP_PORT, '--host', '127.0.0.1'], {
    cwd: mvpPath,
    detached: true,
    stdio: 'ignore'
  }).unref();
  
  console.log(`Started MVP on port ${MVP_PORT}`);
}

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];

  // API proxy to MVP
  if (url.startsWith('/api/') || url === '/health' || url === '/analyze' || url === '/picks') {
    const targetPath = url.startsWith('/api/') ? url.replace('/api', '') : url;
    
    const options = {
      hostname: '127.0.0.1',
      port: MVP_PORT,
      path: targetPath,
      method: req.method,
      headers: { 'Content-Type': 'application/json' }
    };

    const proxy = http.request(options, (r) => {
      res.writeHead(r.statusCode, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      r.pipe(res);
    });

    proxy.on('error', () => {
      res.writeHead(502);
      res.end(JSON.stringify({ error: 'MVP not running. Run quick-start-mvp.bat' }));
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

  // Serve static files
  const file = url === '/' ? '/public/index.html' : url;
  const fullPath = path.join(BASE_DIR, file);

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isDirectory()) {
    res.writeHead(404);
    res.end('Not Found: ' + url);
    return;
  }

  const ext = path.extname(file);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, () => {
  console.log('==================================');
  console.log('  Money Agents Dashboard');
  console.log('  http://127.0.0.1:' + PORT);
  console.log('==================================');
  startMVP();
});