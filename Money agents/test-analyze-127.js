const http = require('http');
const data = JSON.stringify({ sport: 'nba', bankroll: 500, max_risk_pct: 2.0 });
const options = {
  hostname: '127.0.0.1',
  port: 8010,
  path: '/analyze',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': data.length }
};
const req = http.request(options, r => {
  console.log('STATUS:', r.statusCode);
  let b = '';
  r.on('data', c => b += c);
  r.on('end', () => console.log(b));
});
req.on('error', e => console.log('ERR:', e.message));
req.write(data);
req.end();