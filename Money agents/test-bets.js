const http = require('http');
// Simple POST to trigger picks fetch
const postData = JSON.stringify({});
const req = http.request({
  hostname: '127.0.0.1',
  port: 8010,
  path: '/api/v1/bets',
  method: 'GET',
  headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.slice(0, 500)));
});
req.on('error', (e) => console.log('ERR:', e.message));
req.end();