// test-token-exchange.js
import fetch from 'node-fetch';

const url = 'https://open-api.tiktok.com/oauth/access_token'; // or 'https://open.tiktokapis.com/v2/oauth/token/'
const payload = new URLSearchParams({
  grant_type: 'authorization_code',
  code: 'PASTE_CODE_HERE',
  client_key: 'awjs5urmu24dmwqc',
  client_secret: 'vvznqLggO0mCNRDuGVJjVGBTUwL5NKlJ',
  redirect_uri: 'https://leaderbox.co/auth/tiktok/callback'
});

(async () => {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload.toString()
    });
    const text = await res.text();
    console.log('STATUS', res.status, 'OK', res.ok);
    console.log('RAW RESPONSE:\n', text);
    try {
      console.log('PARSED JSON:\n', JSON.parse(text));
    } catch (e) {
      console.log('Could not parse JSON');
    }
  } catch (err) {
    console.error('REQUEST ERROR', err);
  }
})();
