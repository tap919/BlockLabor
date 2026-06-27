const http = require('http');
const options = { hostname: '127.0.0.1', port: 8010, path: '/health', method: 'GET' };
http.request(options, r => {
  console.log('STATUS:', r.statusCode);
  let b = '';
  r.on('data', c => b += c);
  r.on('end', () => console.log(b));
}).on('error', e => console.log('ERR:', e.message)).end();