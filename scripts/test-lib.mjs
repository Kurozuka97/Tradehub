#!/usr/bin/env node
// Tests for lib/ — indicators, signal scoring and the persistent signal store.
//
// lib/*.js are ESM but the package is CommonJS (Next + Tailwind config are
// CJS), so Node can't import them directly. We copy them to a temp dir with
// relative imports rewritten to .mjs, then import that. No build impact.
//
// Run: npm test

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "lib");
const DST = fs.mkdtempSync(path.join(os.tmpdir(), "tradehub-lib-"));

for (const f of fs.readdirSync(SRC)) {
  if (!f.endsWith(".js")) continue;
  const body = fs
    .readFileSync(path.join(SRC, f), "utf8")
    .replace(/from "\.\/([a-zA-Z]+)"/g, 'from "./$1.mjs"');
  fs.writeFileSync(path.join(DST, f.replace(/\.js$/, ".mjs")), body);
}

// ── localStorage stub for signalStore ──────────────────────────
const mem = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  },
  addEventListener() {},
  removeEventListener() {},
};

let failures = 0;
const assert = (cond, msg) => {
  if (!cond) {
    failures++;
    console.error(`  FAIL: ${msg}`);
  } else {
    console.log(`  ok: ${msg}`);
  }
};
const section = (name) => console.log(`\n${name}`);

const { computeRSI, computeEMA, computeMACD, computeMA, computeBollinger } = await import(
  `file://${DST}/indicators.mjs`
);
const { scoreCandles, analyzeSignal, SIGNAL_RULES } = await import(`file://${DST}/signals.mjs`);
const store = await import(`file://${DST}/signalStore.mjs`);

// ── indicators ─────────────────────────────────────────────────
section("indicators");

const up = Array.from({ length: 60 }, (_, i) => 100 + i);
const down = Array.from({ length: 60 }, (_, i) => 200 - i);
const motionless = Array.from({ length: 60 }, () => 100);

const rsiUp = computeRSI(up);
assert(rsiUp.filter((v) => v != null).every((v) => v >= 0 && v <= 100), "RSI stays within 0..100");
assert(rsiUp[59] === 100, "RSI of a pure uptrend is 100");
assert(computeRSI(down)[59] === 0, "RSI of a pure downtrend is 0");
assert(rsiUp[13] === null && rsiUp[14] != null, "RSI(14) first value lands at index 14");
assert(computeRSI(motionless)[59] === 50, "RSI of a motionless series is neutral 50 (not 100)");

assert(
  computeMA([1, 2, 3, 4, 5], 3)[1] === null && computeMA([1, 2, 3, 4, 5], 3)[2] === 2,
  "MA3 first value at index 2 equals 2"
);
assert(computeEMA(up, 9).length === 60, "EMA length preserved");
assert(
  computeEMA(motionless, 9).every((v) => v === 100),
  "EMA is exact on a constant series (no floating-point drift)"
);
const macd = computeMACD(up);
assert(macd.macd.length === 60 && macd.hist.length === 60, "MACD lengths preserved");
const bb = computeBollinger(up, 20, 2);
assert(bb.upper[59] > up[59] && bb.lower[59] < up[59], "Bollinger bands bracket price");

// ── fixtures ───────────────────────────────────────────────────
// Close series -> candles whose high/low straddle the close.
const toCandles = (closes) =>
  closes.map((c, i) => ({
    time: 1700000000 + i * 60,
    open: i === 0 ? c : closes[i - 1],
    high: c * 1.004,
    low: c * 0.996,
    close: c,
  }));

// Baseline volume, with a climactic print on the final candle.
const vols = (closes, spike = true) =>
  closes.map((_, i) => (spike && i === closes.length - 1 ? 300 : 100));

// Long decline that accelerates into a low, then bases on volume.
const buyCloses = [];
for (let i = 0; i < 46; i++) buyCloses.push(160 - (26 * i) / 45); // 160 -> 134
for (let i = 1; i <= 10; i++) buyCloses.push(134 - i); // 133 -> 124
buyCloses.push(124.05, 124.1, 124.15, 124.2);

// Mirror image: rally into a ceiling, then a fade on volume.
const sellCloses = [];
for (let i = 0; i < 46; i++) sellCloses.push(40 + (26 * i) / 45); // 40 -> 66
for (let i = 1; i <= 10; i++) sellCloses.push(66 + i); // 67 -> 76
sellCloses.push(75.95, 75.9, 75.85, 75.8);

// No directional information at all.
const deadCloses = Array.from({ length: 60 }, () => 100);

// ── signal engine ──────────────────────────────────────────────
section("signal engine");

const buySig = analyzeSignal(toCandles(buyCloses), vols(buyCloses));
assert(buySig?.signal === "BUY", `low-with-volume yields BUY (got ${buySig?.signal ?? "null"})`);
if (buySig) {
  assert(buySig.confidence >= SIGNAL_RULES.threshold, `BUY confidence ${buySig.confidence} >= threshold ${SIGNAL_RULES.threshold}`);
  assert(buySig.confidence <= 95, `BUY confidence ${buySig.confidence} <= 95`);
  assert(buySig.reasons.every((r) => /\(\+\d+\)$/.test(r)), `reasons carry point values: ${buySig.reasons.join(" | ")}`);
  assert(buySig.price > 0 && buySig.rsi > 0, "signal carries entry price and RSI");
}

const sellSig = analyzeSignal(toCandles(sellCloses), vols(sellCloses));
assert(sellSig?.signal === "SELL", `high-with-volume yields SELL (got ${sellSig?.signal ?? "null"})`);

const buyScore = scoreCandles(toCandles(buyCloses), vols(buyCloses));
const sellScore = scoreCandles(toCandles(sellCloses), vols(sellCloses));
assert(buyScore.bull > buyScore.bear, "BUY score has bull leading");
assert(sellScore.bear > sellScore.bull, "SELL score has bear leading");
assert(
  buyScore.bullReasons.some((r) => r.label === "Volume spike"),
  "volume spike factored into the score"
);

const deadScore = scoreCandles(toCandles(deadCloses), vols(deadCloses, false));
assert(analyzeSignal(toCandles(deadCloses), vols(deadCloses, false)) === null, "motionless market yields no signal");
assert(deadScore.rsi === 50, "flat series scores RSI 50");
assert(
  deadScore.bull <= SIGNAL_RULES.threshold && deadScore.bear <= SIGNAL_RULES.threshold,
  `flat series scores no momentum (bull ${deadScore.bull} / bear ${deadScore.bear})`
);

assert(analyzeSignal(toCandles(buyCloses).slice(0, 10), vols(buyCloses).slice(0, 10)) === null, "too few candles yields no signal");
assert(analyzeSignal(null, null) === null, "null input yields no signal");
assert(analyzeSignal(toCandles(buyCloses), []) === null, "missing volume yields no signal");
assert(SIGNAL_RULES.threshold <= 95 && SIGNAL_RULES.dominance > 0, "signal rule constants are sane");

// ── signal store ───────────────────────────────────────────────
section("signal store");

const baseTime = Date.now();
const mk = (over = {}) => ({
  id: `sig-${Math.random().toString(36).slice(2)}`,
  pair: "BTCUSDT",
  interval: "1m",
  signal: "BUY",
  confidence: 72,
  price: 100,
  time: "12:00:00",
  timestamp: baseTime,
  reasons: ["RSI 28 (+24)"],
  status: "open",
  ...over,
});

store.clearSignals();
store.addSignal(mk());
store.addSignal(mk({ signal: "SELL", id: "second" }));
assert(store.loadSignals().length === 2, "signals persisted");

let notified = 0;
const unsub = store.subscribeSignals(() => notified++);

const candlesWin = [
  { time: baseTime / 1000 + 60, high: 101.5, low: 100.8, close: 101.4, open: 100.9 },
];
assert(
  store.resolveSignals("BTCUSDT", "1m", candlesWin, 101.4) === true,
  "resolveSignals reports a change"
);
assert(
  store.loadSignals().some((s) => s.signal === "BUY" && s.status === "win"),
  "BUY resolved to win at +1%"
);
assert(notified >= 1, "subscribers notified on change");
assert(
  store.loadSignals().some((s) => s.status === "loss"),
  "SELL resolved to loss when price rose through +1%"
);
assert(
  store.resolveSignals("BTCUSDT", "1m", candlesWin, 101.4) === false,
  "settled signals don't re-fire"
);

// Expiry: 55 candles without ever touching target.
store.clearSignals();
store.addSignal(mk({ timestamp: baseTime - 60000 }));
const flat55 = Array.from({ length: 55 }, (_, i) => ({
  time: baseTime / 1000 + i * 60,
  high: 100.4,
  low: 99.6,
  close: 100.1,
  open: 100,
}));
store.resolveSignals("BTCUSDT", "1m", flat55, 100.1);
assert(store.loadSignals()[0].status === "expired", "signal expires after 50 candles");

const stats = store.getSignalStats(store.loadSignals());
assert(
  stats.total === 1 && stats.expired === 1 && stats.hitRate === null,
  "expired-only log reports no hit rate"
);

// Hit-rate maths on a known set.
store.clearSignals();
store.addSignal(mk({ status: "win", confidence: 80 }));
store.addSignal(mk({ status: "win", confidence: 70 }));
store.addSignal(mk({ status: "loss", confidence: 60 }));
store.addSignal(mk({ status: "open" }));
const s2 = store.getSignalStats(store.loadSignals());
assert(s2.wins === 2 && s2.losses === 1 && s2.open === 1, `win/loss/open tallied (${s2.wins}/${s2.losses}/${s2.open})`);
assert(s2.hitRate === 67, `hit rate = ${s2.hitRate}% (expected 67)`);
assert(s2.avgConfWin === 75 && s2.avgConfLoss === 60, `avg confidence win/loss = ${s2.avgConfWin}/${s2.avgConfLoss}`);

// Markers must snap onto real candle times and drop out-of-range entries.
store.clearSignals();
const chartCandles = Array.from({ length: 50 }, (_, i) => ({
  time: 1700000000 + i * 60,
  open: 100,
  high: 101,
  low: 99,
  close: 100.5,
}));
store.addSignal(mk({ timestamp: (1700000000 + 20 * 60 + 30) * 1000 }));
store.addSignal(mk({ id: "out-of-range", timestamp: 1600000000000 }));
const markers = store.markersForRange(store.loadSignals(), "BTCUSDT", "1m", chartCandles);
assert(markers.length === 1, `out-of-range marker dropped (got ${markers.length})`);
assert(chartCandles.some((c) => c.time === markers[0].time), "marker time snapped onto a real candle");
assert(markers[0].text === "BUY 72%", "marker text carries signal + confidence");
assert(markers[0].position === "belowBar" && markers[0].shape === "arrowUp", "BUY marker drawn below the bar");

// Stale open signals get expired on startup.
store.clearSignals();
store.addSignal(mk({ timestamp: baseTime - 8 * 24 * 60 * 60 * 1000 }));
store.pruneStale();
assert(store.loadSignals()[0].status === "expired", "stale open signal expired on prune");

unsub();
store.clearSignals();
fs.rmSync(DST, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll assertions passed." : `\n${failures} FAILURE(S).`);
process.exit(failures === 0 ? 0 : 1);
