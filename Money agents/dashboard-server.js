const http = require('http');
const { spawn } = require('child_process');

const PORT = 3006;

const server = http.createServer((req, res) => {
  if (req.url === '/api/data' && req.method === 'GET') {
    // Run Python scraper
    const py = spawn('python', ['quick-api.py'], { cwd: __dirname });
    
    let output = '';
    py.stdout.on('data', d => output += d);
    py.stderr.on('data', d => output += d);
    py.on('close', code => {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ raw: output, code }));
    });
    return;
  }
  
  // Serve static files
  let file = req.url === '/' ? '/public/dashboard.html' : req.url;
  const fs = require('fs');
  const path = require('path');
  const fullPath = path.join(__dirname, file);
  
  if (!fs.existsSync(fullPath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  
  res.writeHead(200);
  fs.createReadStream(fullPath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Money Agents: http://127.0.0.1:${PORT}`);
});