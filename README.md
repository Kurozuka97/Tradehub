# TradeHub

A personal trading dashboard — live crypto & forex prices, TA charts, a measurable buy/sell signal engine, and a trade journal.

## Stack

- **Next.js 14** (App Router)
- **Tailwind CSS**
- **Recharts** — price, RSI, MACD and sparkline charts
- **lightweight-charts** — live candlestick chart + volume + signal markers
- **CoinGecko API** — crypto prices & chart data (free tier, no key needed)
- **Frankfurter API** — forex rates and 30-day history (free, no key needed)
- **Binance** — live candles via WebSocket

## Features

- **Dashboard** — live prices for 16 crypto pairs (USD + MYR) and 16 forex pairs. Auto-refresh every 60s, forex change vs the previous ECB close.
- **Live** — Binance candlestick chart with volume, 6 intervals, reconnect/heartbeat handling, desktop notifications.
- **TA Chart** — price + MA7/MA25 + Bollinger + EMA9, a dedicated RSI(14) panel with overbought/oversold read-out, and a MACD panel. Coin selector covers all 16 pairs, timeframes 1–90 days.
- **Buy/Sell** — trade log with P&L, win rate, best/worst trade, CSV export. Persisted in localStorage.
- **Guide** — trading fundamentals: trend analysis, RSI signals, risk management, position sizing, psychology.
- **Signals** — rule-based confluence engine with a persistent, scored log and a real hit rate (see below).

## Signal engine

`lib/signals.js` scores each factor into an independent bull/bear bucket — RSI zone, support/resistance proximity, MACD histogram slope, EMA9/21 alignment and cross, market structure, and volume. A signal fires only when one side reaches `threshold` **and** leads by `dominance`; confidence *is* that score (capped at 95), and every reason is reported with its point value, so a 78% reads back as `RSI oversold (+30) | At support (+20) | MACD rising (+15) | Volume spike (+13)`.

Comparisons are epsilon-gated relative to price, so a motionless market scores zero momentum instead of manufacturing a signal from floating-point noise.

Every signal is written to `localStorage["tradehub_signals"]` and then **resolved** as candles arrive:

| Outcome | Rule |
|---|---|
| `win` / `loss` | price reaches ±1% from entry (checked on candle highs/lows and live price) |
| `expired` | 50 candles pass without a target hit, or the entry is older than 7 days |

The Dashboard reports total signals, **hit rate**, wins, losses, open and expired — so the engine's output is measurable rather than asserted. Chart markers are rebuilt from this log on every load.

## Architecture

Shared modules under `lib/`, so the lists and maths can't drift between components:

| Module | Contents |
|---|---|
| `lib/coins.js` | coin/forex/pair lists, derived API allowlists |
| `lib/format.js` | `formatPrice`, `usd`, `formatMyr`, sign-aware `fmtMoney` |
| `lib/indicators.js` | MA, EMA, MACD, RSI, Bollinger |
| `lib/signals.js` | `scoreCandles` / `analyzeSignal` |
| `lib/signalStore.js` | persistence, resolution, stats, chart markers |

## API Routes (Proxy)

All external API calls go through Next.js API routes — avoids CORS issues and adds server-side caching. Inputs are validated against allowlists before they reach an upstream URL.

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

## Tests

```bash
npm test
```

Covers the indicator maths, the signal engine's scoring/decision rules (including the no-signal and dead-market cases), and the signal store's resolve/expiry/hit-rate/marker behaviour.

## localStorage

| Key | Purpose |
|---|---|
| `tradehub_journal` | trade log |
| `tradehub_signals` | signal log + resolution status (capped at 200) |

## Deploy to Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Vercel auto-detects Next.js. No environment variables needed — all APIs are free and public.

## Known limitations

- **CoinGecko free tier** is rate limited (~10–30 req/min) and no longer returns `sparkline_in_7d` from `simple/price`, so the dashboard no longer renders 7-day sparklines. Rapid tab-switching can still trigger a 429 — there is no shared client cache yet (SWR/React Query would fix this).
- **`npm audit`** reports advisories against `next` that only clear on Next 16. We're pinned to `14.2.35`, the newest of the 14.2 line. This app doesn't use `next/image`, middleware or i18n, which is where most of those apply.
- Signals for a pair only resolve while that pair is being viewed (resolution works off the loaded candle window).
- Binance klines are fetched from the browser while everything else is proxied; Binance is geo-blocked in some regions.

## Roadmap

- [ ] SWR caching shared across tabs
- [ ] Price alerts (Web Push or Telegram bot)
- [ ] Stock/equity support
- [ ] Journal equity curve + JSON import (CSV export exists)
- [ ] Per-pair signal performance breakdown
- [ ] TypeScript migration
