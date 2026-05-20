# TradeHub

A personal trading dashboard — live crypto & forex prices, TA charts with MA + RSI, and a trade journal.

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Recharts** — price + RSI charts
- **CoinGecko API** — crypto prices & chart data (free tier, no key needed)
- **Frankfurter API** — forex rates (free, no key needed)

## Features

- **Dashboard** — Live prices for 8 crypto pairs (USD + MYR) + 7 forex pairs. Auto-refresh every 60s.
- **TA Chart** — Price chart with MA7/MA25 overlay + RSI(14). Select coin + timeframe (7/14/30/90 days).
- **Journal** — Trade log with P&L, win rate, best/worst trade. Persisted in localStorage.
- **Guide** — Trading fundamentals: trend analysis, RSI signals, risk management, position sizing, psychology.

## API Routes (Proxy)

All external API calls go through Next.js API routes — avoids CORS issues, adds server-side caching.

| Route | Source | Cache |
|---|---|---|
| `/api/crypto` | CoinGecko | 60s |
| `/api/forex` | Frankfurter | 300s |
| `/api/chart?coin=bitcoin&days=30` | CoinGecko | 300s |

## Local Dev

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Vercel auto-detects Next.js. No environment variables needed — all APIs are free and public.

## Roadmap

- [ ] MACD indicator
- [ ] Bollinger Bands
- [ ] Price alerts (via Web Push or Telegram bot)
- [ ] Stock/equity support
- [ ] Journal chart (equity curve)
