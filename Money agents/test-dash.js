const http = require('http');

http.get('http://127.0.0.1:3005/api/data', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.slice(0, 600)));
}).on('error', (e) => console.log('ERR:', e.message));