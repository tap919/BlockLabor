const http = require('http');
const postData = JSON.stringify({ sport: 'NBA', min_edge: 0 });
const req = http.request({
  hostname: '127.0.0.1',
  port: 8010,
  path: '/api/v1/odds/generate',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
}, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.slice(0, 800)));
});
req.on('error', (e) => console.log('ERR:', e.message));
req.write(postData);
req.end();