const http = require('http');
const fs = require('fs');

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
  let full = "";
  res.on('data', (chunk) => {
    full += chunk.toString();
  });
  res.on('end', () => {
    fs.writeFileSync('test_out.jsonl', full);
    console.log('Saved to test_out.jsonl');
  });
});

req.write(postData);
req.end();
