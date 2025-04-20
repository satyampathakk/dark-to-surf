const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');

const torAgent = new SocksProxyAgent('socks5h://127.0.0.1:9150');

(async () => {
  try {
    const res = await axios.get('https://check.torproject.org/', {
      httpAgent: torAgent,
      httpsAgent: torAgent,

    });
    console.log(res.data);
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
