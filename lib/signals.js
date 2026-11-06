// Rule-based confluence engine.
//
// Every factor adds points to an independent bullish/bearish bucket. A signal
// fires when one side clears `threshold` AND leads by `dominance`, and the
// reported confidence is simply that score (capped at 95). Because each
// contributing factor carries its own point value, a "90%" can be read back as
// exactly *why* it was emitted — no magic numbers.
//
// `scoreCandles` is exported separately from `analyzeSignal` so the breakdown
// can be inspected (and tested) without committing to a directional call.

import { computeRSI, computeEMA, computeMACD } from "./indicators";

export const SIGNAL_RULES = {
  /** Minimum score before a side is considered a signal. */
  threshold: 45,
  /** How far one side must lead the other to count as directional. */
  dominance: 10,
  weights: {
    rsiExtreme: 30, // RSI <= 25 / >= 75
    rsiStrong: 24, // RSI < 35 / > 65
    rsiMild: 14, // RSI < 45 / > 55
    levelTouch: 20, // within 1% of support/resistance
    levelNear: 12, // within 3%
    macdSlope: 15, // histogram rising vs falling
    emaAlign: 12, // EMA9 vs EMA21
    emaCross: 10, // fresh golden/death cross
    structure: 13, // higher-highs/higher-lows (or the mirror)
    volume: 13, // volume spike confirming the leading side
  },
};

const MAX_CONFIDENCE = 95;
const MIN_CANDLES = 30;

/**
 * Comparisons run at 1e-6 relative to price. Without this, the floating-point
 * noise in an EMA/MACD difference on a motionless market reads as "rising
 * momentum" and manufactures a signal out of nothing.
 */
const epsFor = (price) => Math.max(Math.abs(price || 0) * 1e-6, 1e-9);

export function scoreCandles(candles, volumes) {
  if (!candles || candles.length < MIN_CANDLES) return null;
  if (!volumes || volumes.length < MIN_CANDLES) return null;

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const rsiSeries = computeRSI(closes, 14);
  const lastRSI = rsiSeries[rsiSeries.length - 1];
  if (lastRSI == null) return null;

  const lastClose = closes[closes.length - 1];
  const eps = epsFor(lastClose);

  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);
  const li = ema9.length - 1;
  const emaDelta = ema9[li] - ema21[li];
  const prevEmaDelta = ema9[li - 1] - ema21[li - 1];
  const emaBull = emaDelta > eps;
  const emaBear = emaDelta < -eps;
  // A cross requires the *previous* state to have been the opposite one, and
  // both states are eps-gated — so a flat pair can never fake a crossover.
  const prevEmaBull = prevEmaDelta > eps;
  const prevEmaBear = prevEmaDelta < -eps;
  const goldenCross = emaBull && prevEmaBear;
  const deathCross = emaBear && prevEmaBull;

  const volWindow = volumes.slice(-20);
  const avgVol = volWindow.reduce((a, b) => a + b, 0) / volWindow.length;
  const lastVol = volumes[volumes.length - 1];
  const volSpike = avgVol > 0 && lastVol > avgVol * 1.5;

  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);

  const macd = computeMACD(closes);
  const hist = macd.hist;
  const histDelta = hist[hist.length - 1] - hist[hist.length - 2];
  // Award momentum points only on movement that clears numerical noise.
  // "Not rising" is not evidence of falling — a dead market must score nothing.
  const macdRising = histDelta > eps;
  const macdFalling = histDelta < -eps;

  // Structure: do the latest 20 candles print higher highs *and* higher lows
  // than the 20 before them? (or lower/lower for the bearish mirror)
  const priorLows = lows.slice(-40, -20);
  const priorHighs = highs.slice(-40, -20);
  const hasPrior = priorLows.length > 0;
  const minRecent = Math.min(...recentLows);
  const maxRecent = Math.max(...recentHighs);
  const minPrior = hasPrior ? Math.min(...priorLows) : 0;
  const maxPrior = hasPrior ? Math.max(...priorHighs) : 0;
  const structureBull = hasPrior && minRecent - minPrior > eps && maxRecent - maxPrior > eps;
  const structureBear = hasPrior && minPrior - minRecent > eps && maxPrior - maxRecent > eps;

  const W = SIGNAL_RULES.weights;
  let bull = 0;
  let bear = 0;
  const bullReasons = [];
  const bearReasons = [];
  const add = (side, points, label) => {
    if (side === "bull") {
      bull += points;
      bullReasons.push({ label, points });
    } else {
      bear += points;
      bearReasons.push({ label, points });
    }
  };

  // RSI zones
  if (lastRSI <= 25) add("bull", W.rsiExtreme, `RSI ${lastRSI} oversold`);
  else if (lastRSI < 35) add("bull", W.rsiStrong, `RSI ${lastRSI} near oversold`);
  else if (lastRSI < 45) add("bull", W.rsiMild, `RSI ${lastRSI} soft`);

  if (lastRSI >= 75) add("bear", W.rsiExtreme, `RSI ${lastRSI} overbought`);
  else if (lastRSI > 65) add("bear", W.rsiStrong, `RSI ${lastRSI} near overbought`);
  else if (lastRSI > 55) add("bear", W.rsiMild, `RSI ${lastRSI} firm`);

  // Support / resistance proximity
  if (lastClose <= support * 1.01) add("bull", W.levelTouch, "At support");
  else if (lastClose <= support * 1.03) add("bull", W.levelNear, "Near support");

  if (lastClose >= resistance * 0.99) add("bear", W.levelTouch, "At resistance");
  else if (lastClose >= resistance * 0.97) add("bear", W.levelNear, "Near resistance");

  // Momentum — symmetric: only real movement earns points.
  if (macdRising) add("bull", W.macdSlope, "MACD histogram rising");
  else if (macdFalling) add("bear", W.macdSlope, "MACD histogram falling");

  // Trend alignment
  if (emaBull) {
    add("bull", W.emaAlign, "EMA9 above EMA21");
    if (goldenCross) add("bull", W.emaCross, "EMA golden cross");
  } else if (emaBear) {
    add("bear", W.emaAlign, "EMA9 below EMA21");
    if (deathCross) add("bear", W.emaCross, "EMA death cross");
  }

  // Structure
  if (structureBull) add("bull", W.structure, "Higher highs & lows");
  if (structureBear) add("bear", W.structure, "Lower highs & lows");

  // A volume spike only reinforces whichever side is already ahead.
  if (volSpike) {
    if (bull > bear) add("bull", W.volume, "Volume spike");
    else if (bear > bull) add("bear", W.volume, "Volume spike");
  }

  return { bull, bear, bullReasons, bearReasons, rsi: lastRSI, price: lastClose };
}

export function analyzeSignal(candles, volumes) {
  const s = scoreCandles(candles, volumes);
  if (!s) return null;

  const { threshold, dominance } = SIGNAL_RULES;
  const { bull, bear, bullReasons, bearReasons } = s;

  let signal = null;
  let score = 0;
  let reasons = [];

  if (bull >= threshold && bull > bear + dominance) {
    signal = "BUY";
    score = bull;
    reasons = bullReasons;
  } else if (bear >= threshold && bear > bull + dominance) {
    signal = "SELL";
    score = bear;
    reasons = bearReasons;
  }

  if (!signal) return null;

  const confidence = Math.min(MAX_CONFIDENCE, score);
  const ordered = [...reasons].sort((a, b) => b.points - a.points);

  return {
    signal,
    confidence,
    score,
    reasons: ordered.map((r) => `${r.label} (+${r.points})`),
    rsi: s.rsi,
    price: s.price,
  };
}
