const { json, getQuery, fetchJson } = require('./_lib/http');
const { getCache, setCache } = require('./_lib/cache');

function toOHLC(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(x => ({
      time: x[0],
      open: Number(x[1]),
      high: Number(x[2]),
      low: Number(x[3]),
      close: Number(x[4]),
      volume: Number(x[5])
    }))
    .filter(x => [x.open, x.high, x.low, x.close].every(Number.isFinite));
}

async function fetchBinanceKlines(symbol, interval = '1m', limit = 120, market = 'spot') {
  const pair = `${symbol.toUpperCase()}USDT`;
  const url = market === 'futures'
    ? `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${encodeURIComponent(interval)}&limit=${limit}`
    : `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${encodeURIComponent(interval)}&limit=${limit}`;
  const { res, data } = await fetchJson(url, { headers: { Accept: 'application/json' } }, 10000);
  if (!res.ok) return [];
  return toOHLC(data);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const q = getQuery(req);
  const symbol = (q.symbol || 'BTC').toUpperCase();
  const market = q.market === 'futures' ? 'futures' : 'spot';
  const interval = q.interval || '1m';
  const limit = Math.max(30, Math.min(300, parseInt(q.limit || '120', 10) || 120));
  const key = `argos:chart:${market}:${symbol}:${interval}:${limit}`;

  const cached = await getCache(key);
  if (cached?.ohlc) return json(res, 200, cached, { 'Cache-Control': 's-maxage=15, stale-while-revalidate=15' });

  try {
    const ohlc = await fetchBinanceKlines(symbol, interval, limit, market);
    if (!ohlc.length) return json(res, 502, { ok: false, error: 'Chart unavailable' });

    const payload = { ok: true, symbol, market, interval, ohlc, source: 'binance' };
    await setCache(key, payload, 20);
    return json(res, 200, payload, { 'Cache-Control': 's-maxage=15, stale-while-revalidate=15' });
  } catch (error) {
    return json(res, 502, { ok: false, error: error.message || 'Chart fetch failed' });
  }
};
