const { json, getQuery } = require('./_lib/http');
const { setCache } = require('./_lib/cache');

const { fetchJson } = require('./_lib/http');

function normalizeCoin(c) {
  return {
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    image: c.image,
    market_cap_rank: c.market_cap_rank,
    current_price: c.current_price,
    total_volume: c.total_volume,
    price_change_percentage_24h: c.price_change_percentage_24h,
    price_change_percentage_1h_in_currency: c.price_change_percentage_1h_in_currency,
    price_change_percentage_7d_in_currency: c.price_change_percentage_7d_in_currency,
    sparkline_in_7d: c.sparkline_in_7d,
    market_cap: c.market_cap,
    circulating_supply: c.circulating_supply,
    max_supply: c.max_supply
  };
}

async function fetchPage(page, apiKey) {
  const qs = new URLSearchParams({
    vs_currency: 'usd',
    order: 'market_cap_desc',
    per_page: '250',
    page: String(page),
    sparkline: 'true',
    price_change_percentage: '1h,7d'
  });
  const url = `https://api.coingecko.com/api/v3/coins/markets?${qs.toString()}`;
  const headers = { Accept: 'application/json' };
  if (apiKey) headers['x-cg-pro-api-key'] = apiKey;
  const { res, data } = await fetchJson(url, { headers }, 12000);
  if (!res.ok) throw new Error(`CoinGecko page ${page} failed (${res.status})`);
  return Array.isArray(data) ? data : [];
}

async function buildMarketSnapshot(limit = 1000) {
  const apiKey = process.env.COINGECKO_API_KEY || '';
  const pages = Math.ceil(limit / 250);
  const all = [];
  for (let p = 1; p <= pages; p++) {
    const page = await fetchPage(p, apiKey);
    all.push(...page);
  }
  const dedup = [...new Map(all.filter(Boolean).map(c => [c.id, normalizeCoin(c)])).values()];
  dedup.sort((a, b) => (a.market_cap_rank || 999999) - (b.market_cap_rank || 999999));
  return dedup.slice(0, limit);
}

module.exports = { buildMarketSnapshot, normalizeCoin };


module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const q = getQuery(req);
  const limit = Math.max(200, Math.min(1000, parseInt(q.limit || '1000', 10) || 1000));
  const ttl = Math.max(120, Math.min(900, parseInt(q.ttl || '420', 10) || 420));

  try {
    const coins = await buildMarketSnapshot(limit);
    const payload = { ok: true, updatedAt: new Date().toISOString(), limit, coins };
    await setCache('argos:market-data', payload, ttl);
    return json(res, 200, payload, { 'Cache-Control': `s-maxage=${ttl}, stale-while-revalidate=30` });
  } catch (error) {
    return json(res, 502, { ok: false, error: error.message || 'Market fetch failed' });
  }
};
