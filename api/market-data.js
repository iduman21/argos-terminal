const { json, getQuery } = require('./_lib/http');
const { getCache } = require('./_lib/cache');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const q = getQuery(req);
  const limit = Math.max(50, Math.min(1000, parseInt(q.limit || '1000', 10) || 1000));
  const cached = await getCache('argos:market-data');

  if (!cached || !Array.isArray(cached.coins)) {
    return json(res, 503, { ok: false, error: 'Market cache not ready', coins: [], updatedAt: null }, {
      'Cache-Control': 'no-store'
    });
  }

  return json(res, 200, { ok: true, updatedAt: cached.updatedAt, limit, coins: cached.coins.slice(0, limit) }, {
    'Cache-Control': 's-maxage=15, stale-while-revalidate=30'
  });
};
