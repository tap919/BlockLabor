const http = require('http');
const data = JSON.stringify({ sport: 'NBA', bankroll: 500, max_risk_pct: 2.0 });
const req = http.request({
  hostname: '127.0.0.1',
  port: 8010,
  path: '/api/v1/odds/generate',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
}, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log(body.slice(0, 500)));
});
req.on('error', (e) => console.log('ERR:', e.message));
req.write(data);
req.end();