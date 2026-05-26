const { json, getQuery, fetchJson } = require('./_lib/http');
const { getCache, setCache } = require('./_lib/cache');

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseRssItems(xml, src, sn, max = 30) {
  const items = [];
  const blocks = String(xml || '').match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks.slice(0, max)) {
    const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] || block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
    const pub = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || new Date().toISOString()).trim();
    const descRaw = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] || block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '').trim();
    items.push({
      id: `${src}_${title.slice(0, 48).replace(/\s+/g, '_') || Math.random().toString(36).slice(2)}`,
      title: stripHtml(title),
      url: link,
      src,
      sn,
      pub: new Date(pub).toISOString(),
      desc: stripHtml(descRaw)
    });
  }
  return items;
}

async function fetchRss(url, src, sn) {
  const { res, text } = await fetchJson(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' }
  }, 12000);
  if (!res.ok) throw new Error(`${sn} failed (${res.status})`);
  return parseRssItems(text, src, sn, 25);
}

async function fetchCoinGeckoNews() {
  const { res, data } = await fetchJson('https://api.coingecko.com/api/v3/news?per_page=30', {
    headers: { Accept: 'application/json' }
  }, 12000);
  if (!res.ok) return [];
  const arr = Array.isArray(data?.data) ? data.data : [];
  return arr.slice(0, 25).map(n => ({
    id: `cg_${n.id || (n.title || '').slice(0, 40).replace(/\s+/g, '_')}`,
    title: n.title || '',
    url: n.url || '',
    src: 'cg',
    sn: 'CoinGecko',
    pub: new Date((n.updated_at || 0) * 1000).toISOString(),
    desc: stripHtml(n.description || '')
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'Method not allowed' });

  const q = getQuery(req);
  const lang = (q.lang || 'en').toLowerCase().split('-')[0];
  const limit = Math.max(10, Math.min(100, parseInt(q.limit || '80', 10) || 80));
  const cacheKey = `argos:news:${lang}:${limit}`;

  const cached = await getCache(cacheKey);
  if (cached?.items) {
    return json(res, 200, cached, { 'Cache-Control': 's-maxage=15, stale-while-revalidate=20' });
  }

  try {
    const results = await Promise.allSettled([
      fetchRss('https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml', 'cd', 'CoinDesk'),
      fetchRss('https://cointelegraph.com/rss', 'ct', 'CoinTelegraph'),
      fetchCoinGeckoNews(),
      fetchRss('https://cryptopanic.com/news/rss/', 'cp', 'CryptoPanic')
    ]);

    let items = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
    items = items.filter(Boolean).slice(0, limit);

    const payload = { ok: true, updatedAt: new Date().toISOString(), items };
    await setCache(cacheKey, payload, 20);
    return json(res, 200, payload, { 'Cache-Control': 's-maxage=15, stale-while-revalidate=20' });
  } catch (error) {
    return json(res, 502, { ok: false, error: error.message || 'News fetch failed', items: [] });
  }
};
