const express = require('express');
const axios = require('axios');
const path = require('path');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');
const bodyParser = require('body-parser');
const { url } = require('inspector');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Global SOCKS5 Tor Proxy Agent for all requests
const torAgent = new SocksProxyAgent('socks5h://127.0.0.1:9150');

// Simulate Tor Browser headers
const torBrowserHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:60.0) Gecko/20100101 Firefox/60.0', // Tor Browser UA
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

// Proxy route
app.all('/proxy', async (req, res) => {
  let rawUrl = req.query.url;
  const referer = req.headers.referer;
  const query=req.url
  const q = referer.split("=")[1];    // gives access to query params
  const urlpath=query.split('?')[1]
  const targetUrl = q+"?"+urlpath; 
  console.log(rawUrl)
  console.log(q)
  console.log(referer)
  console.log(decodeURIComponent(targetUrl))
  if (!rawUrl){
    rawUrl=decodeURIComponent(targetUrl);
  }

  // Ensure the URL starts with http:// or https://
  if (!rawUrl || (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://'))) {
    return res.status(400).send('❌ Invalid or missing URL. Make sure the URL starts with "http://" or "https://"');
  }

  const baseUrl = new URL(rawUrl);

  try {
    const axiosConfig = {
      method: req.method,
      url: rawUrl,
      data: req.method === 'POST' ? req.body : undefined,
      responseType: 'arraybuffer', // Important for images, fonts, etc.
      timeout: 20000,
      httpAgent: torAgent,
      httpsAgent: torAgent,
      headers: torBrowserHeaders, // Use Tor Browser headers
    };

    const response = await axios(axiosConfig);
    const contentType = response.headers['content-type'] || '';

    if (contentType.includes('text/html')) {
      const $ = cheerio.load(response.data.toString('utf8'));

      const tagsToFix = [
        { tag: 'a', attr: 'href' },
        { tag: 'link', attr: 'href' },
        { tag: 'script', attr: 'src' },
        { tag: 'img', attr: 'src' },
        { tag: 'iframe', attr: 'src' },
        { tag: 'form', attr: 'action' },
        { tag: 'source', attr: 'src' },
        { tag: 'video', attr: 'src' },
        { tag: 'audio', attr: 'src' },
      ];

      tagsToFix.forEach(({ tag, attr }) => {
        $(tag).each((_, el) => {
          const raw = $(el).attr(attr);
          if (!raw || raw.startsWith('data:') || raw.startsWith('mailto:') || raw.startsWith('javascript:')) return;

          try {
            const absolute = new URL(raw, baseUrl).href;
            $(el).attr(attr, `/proxy?url=${encodeURIComponent(absolute)}`);
          } catch (e) {}
        });
      });

      res.set('Content-Type', 'text/html');
      res.send($.html());
    } else {
      // Other (binary, image, script, css)
      res.set('Content-Type', contentType);
      res.send(response.data);
    }
  } catch (err) {
    console.error('[Proxy Error]', err.message);
    res.status(500).send('⚠️ Proxy Error: ' + err.message);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
});
