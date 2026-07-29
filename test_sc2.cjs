const http = require('http');

const postData = JSON.stringify({
  ticker: 'AAPL',
  instruction: '',
  origin: 'http://localhost:3000',
  model: 'gemini-3.5-flash',
  language: 'English',
  analysisType: 'combined',
  useSelfConsistency: true
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/analyze',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', (chunk) => {
    const str = chunk.toString();
    console.log("DATA:", str.substring(0, 100).replace(/\n/g, '\\n'));
  });
  res.on('end', () => {
    console.log('No more data in response.');
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();
