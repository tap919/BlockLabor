const http = require('http');
http.get('http://127.0.0.1:8010/api/v1/prizepicks/picks?sport=NBA', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.slice(0, 800)));
}).on('error', (e) => console.log('ERR:', e.message));