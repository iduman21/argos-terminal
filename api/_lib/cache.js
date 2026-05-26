const memory = globalThis.__ARGOS_CACHE__ || (globalThis.__ARGOS_CACHE__ = new Map());

function configured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashGet(key) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const res = await fetch(`${base}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.result == null) return null;
  try { return JSON.parse(data.result); } catch { return data.result; }
}

async function upstashSet(key, value, ttlSeconds = 60) {
  const base = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  const res = await fetch(`${base}/set/${encodeURIComponent(key)}/${encodeURIComponent(payload)}?ex=${Math.max(1, ttlSeconds)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.ok;
}

async function getCache(key) {
  const mem = memory.get(key);
  if (mem && mem.expiresAt > Date.now()) return mem.value;
  if (configured()) {
    try {
      const value = await upstashGet(key);
      if (value !== null && value !== undefined) return value;
    } catch {}
  }
  return null;
}

async function setCache(key, value, ttlSeconds = 60) {
  memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  if (configured()) {
    try { await upstashSet(key, value, ttlSeconds); } catch {}
  }
  return value;
}

module.exports = { getCache, setCache };
