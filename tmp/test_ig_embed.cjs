const axios = require('axios');

const testUrl = 'https://www.instagram.com/reel/C8qL82kvUqX/';

const candidates = [
  { name: 'fastdl', url: 'https://fastdl.app/api/convert', method: 'POST', data: { url: testUrl } },
  { name: 'bk9', url: `https://bk9.fun/download/instagram?url=${encodeURIComponent(testUrl)}`, method: 'GET' },
  { name: 'api.agatz', url: `https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(testUrl)}`, method: 'GET' },
  { name: 'widipe', url: `https://widipe.com/download/ig?url=${encodeURIComponent(testUrl)}`, method: 'GET' },
  { name: 'delirius', url: `https://delirius-api-oficial.vercel.app/api/ig?url=${encodeURIComponent(testUrl)}`, method: 'GET' },
  { name: 'vkr', url: `https://api.vkrdownloader.com/server?vkr=${encodeURIComponent(testUrl)}`, method: 'GET' },
  { name: 'tiklydown', url: `https://api.tiklydown.eu.org/api/download/v3?url=${encodeURIComponent(testUrl)}`, method: 'GET' },
];

async function run() {
  for (const c of candidates) {
    try {
      let res;
      if (c.method === 'POST') {
        res = await axios.post(c.url, c.data, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          },
          timeout: 7000
        });
      } else {
        res = await axios.get(c.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          },
          timeout: 7000
        });
      }
      console.log(`[${c.name}] status:`, res.status, 'data type:', typeof res.data, 'sample:', JSON.stringify(res.data).slice(0, 150));
    } catch (e) {
      console.log(`[${c.name}] failed:`, e.code || e.message);
    }
  }
}

run();

