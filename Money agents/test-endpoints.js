const http = require('http');
const endpoints = [
  '/api/v1/health',
  '/api/v1/prizepicks/picks',
  '/api/v1/prizepicks/raw',
  '/health',
  '/api/health',
  '/api/v1/bets',
  '/api/v1/accounts'
];

let checked = 0;
endpoints.forEach(ep => {
  http.get('http://127.0.0.1:8010' + ep, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(`${res.statusCode} ${ep}: ${data.slice(0, 100)}`);
      checked++;
      if(checked === endpoints.length) process.exit(0);
    });
  }).on('error', () => {
    console.log(`ERR ${ep}`);
    checked++;
    if(checked === endpoints.length) process.exit(0);
  });
});