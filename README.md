# TradeHub

A personal trading dashboard — live crypto & forex prices, TA charts, a persistent rule-based AI signal engine, and a trade journal.

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Recharts** — TA price/MA/Bollinger/RSI/MACD charts + sparklines
- **lightweight-charts** — live candlestick chart (Binance WebSocket)
- **CoinGecko API** — crypto prices & chart data (free tier, no key needed)
- **Frankfurter API** — forex rates & history (free, no key needed)
- **Binance API** — klines REST + live kline WebSocket

## Features

- **Dashboard** — live prices for 16 crypto pairs (USD + MYR) with 7d sparklines, plus 16 forex pairs with change vs the previous ECB close. Auto-refresh every 60s.
- **Live** — Binance WebSocket candlestick chart (1m–1D), heartbeat + exponential-backoff reconnect, browser notifications, and an AI signal banner.
- **TA Chart** — price with MA7/MA25, Bollinger Bands, EMA9, RSI(14) with overbought/oversold badge, and MACD(12, 26, 9). Select coin + timeframe (1/7/14/30/90 days).
- **Buy/Sell (Journal)** — trade log with P&L, win rate, best/worst trade, CSV export. Persisted in localStorage.
- **Guide** — trading fundamentals: trend analysis, RSI, risk management, position sizing, sessions, psychology.

## AI Signal Engine

Signals are a **rule-based confluence score**, not magic numbers — every factor adds points to an independent bullish/bearish bucket (`lib/signals.js`):

| Factor | Points |
|---|---|
| RSI extreme (≤25 / ≥75) | 30 |
| RSI strong (<35 / >65) | 24 |
| At support / resistance (1%) | 20 |
| MACD histogram slope | 15 |
| RSI mild (<45 / >55) | 14 |
| Market structure (HH/HL vs LH/LL) | 13 |
| Volume spike | 13 |
| EMA9/EMA21 alignment | 12 |
| Near support / resistance (3%) | 12 |
| Fresh golden/death cross | 10 |

A signal fires when a side scores ≥ 45 **and** leads by > 10; confidence is that score (capped at 95).

Every signal is persisted to `localStorage` (`lib/signalStore.js`) with its entry price, then resolved automatically at a **±1% target** or expired after 50 candles — so the Dashboard's **hit rate** is measured, not claimed. Markers are re-drawn from the log on every chart load, and a 30-minute cooldown stops duplicate alerts per pair+direction.

## Shared modules (`lib/`)

| Module | Purpose |
|---|---|
| `lib/coins.js` | Single source of truth for coin/forex/live-pair lists + API allowlists |
| `lib/indicators.js` | MA, EMA, MACD, RSI, Bollinger — pure functions |
| `lib/signals.js` | Confluence engine (scoring rules above) |
| `lib/signalStore.js` | Persistent signal log, resolution, stats, chart markers |
| `lib/format.js` | Sign-aware price/money formatting (`usd`, `fmtMoney`, `formatMyr`) |

## API Routes (Proxy)

All external API calls go through Next.js API routes — avoids CORS issues, adds server-side caching, and validates input against the `lib/coins.js` allowlists.

| Route | Source | Cache |
|---|---|---|
| `/api/crypto` | CoinGecko | 60s |
| `/api/forex` | Frankfurter | 300s |
| `/api/forex/history` | Frankfurter time-series | 300s |
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

- [x] MACD indicator
- [x] Bollinger Bands
- [x] Live WebSocket chart with reconnect/heartbeat
- [x] Persistent AI signals with measured hit rate
- [ ] Price alerts (via Web Push or Telegram bot)
- [ ] Stock/equity support
- [ ] Journal chart (equity curve)
