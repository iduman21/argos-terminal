const { json, getQuery, fetchJson } = require('./_lib/http');
const { getCache, setCache } = require('./_lib/cache');

function normalizeLevels(levels) {
  return (Array.isArray(levels) ? levels : [])
    .map(x => [Number(x[0]), Number(x[1])])
    .filter(([p, q]) => Number.isFinite(p) && Number.isFinite(q) && p > 0 && q > 0)
    .slice(0, 20);
}

function calcTotals(book) {
  const bids = normalizeLevels(book?.bids);
  const asks = normalizeLevels(book?.asks);
  const bidTotal = bids.reduce((s, [p, q]) => s + p * q, 0);
  const askTotal = asks.reduce((s, [p, q]) => s + p * q, 0);
  const bidQtyTotal = bids.reduce((s, [p, q]) => s + q, 0);
  const askQtyTotal = asks.reduce((s, [p, q]) => s + q, 0);
  return { bids, asks, bidTotal, askTotal, bidQtyTotal, askQtyTotal, total: bidTotal + askTotal };
}

async function fetchBinance(sym, market) {
  const pair = `${sym.toUpperCase()}USDT`;
  const url = market === 'futures'
    ? `https://fapi.binance.com/fapi/v1/depth?symbol=${pair}&limit=20`
    : `https://api.binance.com/api/v3/depth?symbol=${pair}&limit=20`;
  const { res, data } = await fetchJson(url, { headers: { Accept: 'application/json' } }, 10000);
  if (!res.ok) return null;
  return data;
}

async function fetchBybit(sym, market) {
  const pair = `${sym.toUpperCase()}USDT`;
  const url = `https://api.bybit.com/v5/market/orderbook?category=${market === 'futures' ? 'linear' : 'spot'}&symbol=${pair}`;
  const { res, data } = await fetchJson(url, { headers: { Accept: 'application/json' } }, 10000);
  if (!res.ok) return null;
  const book = data?.result || {};
  return { bids: book.b || [], asks: book.a || [] };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const q = getQuery(req);
  const symbol = (q.symbol || 'BTC').toUpperCase();
  const market = q.market === 'futures' ? 'futures' : 'spot';
  const key = `argos:ob:${market}:${symbol}`;

  const cached = await getCache(key);
  if (cached?.book) return json(res, 200, cached, { 'Cache-Control': 's-maxage=15, stale-while-revalidate=15' });

  try {
    const [binance, bybit] = await Promise.allSettled([
      fetchBinance(symbol, market),
      fetchBybit(symbol, market)
    ]);

    const books = [];
    if (binance.status === 'fulfilled' && binance.value) books.push({ source: 'binance', book: binance.value });
    if (bybit.status === 'fulfilled' && bybit.value) books.push({ source: 'bybit', book: bybit.value });

    if (!books.length) return json(res, 502, { ok: false, error: 'Orderbook unavailable' });

    const chosen = books[0];
    const totals = calcTotals(chosen.book);
    const payload = {
      ok: true,
      symbol,
      market,
      source: chosen.source,
      book: {
        bids: totals.bids,
        asks: totals.asks,
        _agg: {
          bidTotal: totals.bidTotal,
          askTotal: totals.askTotal,
          bidQtyTotal: totals.bidQtyTotal,
          askQtyTotal: totals.askQtyTotal,
          sourceCount: books.length
        }
      }
    };
    await setCache(key, payload, 20);
    return json(res, 200, payload, { 'Cache-Control': 's-maxage=15, stale-while-revalidate=15' });
  } catch (error) {
    return json(res, 502, { ok: false, error: error.message || 'Orderbook fetch failed' });
  }
};
