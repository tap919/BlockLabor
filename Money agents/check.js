const http = require('http');
http.get('http://127.0.0.1:8010/api/v1/health', function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() { console.log(data); });
}).on('error', function(e) { console.log('ERR:' + e.message); });