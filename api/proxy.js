const { json, getQuery, fetchJson } = require('./_lib/http');

const ALLOW = [
  /(^|\.)coingecko\.com$/i,
  /(^|\.)binance\.com$/i,
  /(^|\.)bybit\.com$/i,
  /(^|\.)kraken\.com$/i,
  /(^|\.)coinbase\.com$/i,
  /(^|\.)coindesk\.com$/i,
  /(^|\.)cointelegraph\.com$/i,
  /(^|\.)cryptopanic\.com$/i,
  /(^|\.)alternative\.me$/i
];

function allowed(u) {
  return ALLOW.some(rx => rx.test(u.hostname));
}

module.exports = async function handler(req, res) {
  const q = getQuery(req);
  const url = q.url;
  if (!url) return json(res, 400, { ok: false, error: 'Missing url' });

  let parsed;
  try { parsed = new URL(url); } catch {
    return json(res, 400, { ok: false, error: 'Invalid url' });
  }

  if (!allowed(parsed)) {
    return json(res, 403, { ok: false, error: 'Host not allowed' });
  }

  try {
    const { res: upstream, text, data } = await fetchJson(url, {
      headers: {
        'Accept': req.headers.accept || '*/*',
        'User-Agent': 'ArgosTerminal/1.0'
      }
    }, 12000);

    const ct = upstream.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return json(res, upstream.status, { ok: upstream.ok, data });
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', ct || 'text/plain; charset=utf-8');
    res.end(text);
  } catch (error) {
    return json(res, 502, { ok: false, error: error.message || 'Proxy error' });
  }
};
