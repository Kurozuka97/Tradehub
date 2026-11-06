// Rule-based confluence engine.
//
// Every factor adds points to an independent bullish/bearish bucket. A signal
// fires when one side clears `threshold` AND leads by `dominance`, and the
// reported confidence is simply that score (capped at 95). Because each
// contributing factor carries its own point value, a "90%" can be read back as
// exactly *why* it was emitted — no magic numbers.

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

export function analyzeSignal(candles, volumes) {
  if (!candles || candles.length < 30) return null;
  if (!volumes || volumes.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  const rsiSeries = computeRSI(closes, 14);
  const lastRSI = rsiSeries[rsiSeries.length - 1];
  if (lastRSI == null) return null;

  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);
  const emaBull = ema9[ema9.length - 1] > ema21[ema21.length - 1];
  const prevEmaBull = ema9[ema9.length - 2] > ema21[ema21.length - 2];
  const goldenCross = emaBull && !prevEmaBull;
  const deathCross = !emaBull && prevEmaBull;

  const volWindow = volumes.slice(-20);
  const avgVol = volWindow.reduce((a, b) => a + b, 0) / volWindow.length;
  const lastVol = volumes[volumes.length - 1];
  const volSpike = avgVol > 0 && lastVol > avgVol * 1.5;

  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);
  const lastClose = closes[closes.length - 1];

  const macd = computeMACD(closes);
  const hist = macd.hist;
  const macdRising = hist[hist.length - 1] > hist[hist.length - 2];

  // Structure: do the latest 20 candles print higher highs *and* higher lows
  // than the 20 before them? (or lower/lower for the bearish mirror)
  const priorLows = lows.slice(-40, -20);
  const priorHighs = highs.slice(-40, -20);
  const hasPrior = priorLows.length > 0;
  const structureBull =
    hasPrior &&
    Math.min(...recentLows) > Math.min(...priorLows) &&
    Math.max(...recentHighs) > Math.max(...priorHighs);
  const structureBear =
    hasPrior &&
    Math.min(...recentLows) < Math.min(...priorLows) &&
    Math.max(...recentHighs) < Math.max(...priorHighs);

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

  // Momentum
  if (macdRising) add("bull", W.macdSlope, "MACD histogram rising");
  else add("bear", W.macdSlope, "MACD histogram falling");

  // Trend alignment
  if (emaBull) {
    add("bull", W.emaAlign, "EMA9 above EMA21");
    if (goldenCross) add("bull", W.emaCross, "EMA golden cross");
  } else {
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

  const { threshold, dominance } = SIGNAL_RULES;
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
    rsi: lastRSI,
    price: lastClose,
  };
}
