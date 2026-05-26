# Argos Terminal — Vercel ready

## Kurulum
1. Projeyi Vercel'e yükle.
2. Environment Variables ekle:
   - `COINGECKO_API_KEY`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
3. Deploy et.

## Akış
- `api/fetch-data.js` cron ile market cache'i günceller.
- `api/market-data.js` ana tablo için cache okur.
- `api/haber.js`, `api/orderbook.js`, `api/grafik.js` modal açılınca çalışır.
- Kısa cache 15–20 saniye civarındadır.

## Not
Arapça için sadece RTL yönü uygulanmalı; metni ters çevirmeyin.
