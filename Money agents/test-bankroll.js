const http = require('http');
http.get('http://127.0.0.1:8010/api/v1/bankroll', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
}).on('error', (e) => console.log('ERR:', e.message));