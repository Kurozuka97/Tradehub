// Technical indicators, shared by the TA Chart and the Live signal engine.
// Pure functions — safe to unit test.

export function computeMA(arr, n) {
  return arr.map((_, i) => {
    if (i < n - 1) return null;
    const s = arr.slice(i - n + 1, i + 1);
    return +(s.reduce((a, b) => a + b, 0) / n).toFixed(4);
  });
}

export function computeEMA(arr, n) {
  const k = 2 / (n + 1);
  const ema = [];
  arr.forEach((price, i) => {
    // Incremental form: prev + k*(price - prev). Algebraically identical to
    // price*k + prev*(1-k), but exact when price == prev — the two-product
    // form drifts by ~1e-14 per step, which compounds into a phantom trend.
    ema[i] = i === 0 ? price : ema[i - 1] + k * (price - ema[i - 1]);
  });
  return ema;
}

export function computeMACD(arr, fast = 12, slow = 26, signal = 9) {
  const emaFast = computeEMA(arr, fast);
  const emaSlow = computeEMA(arr, slow);
  const macd = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = computeEMA(macd, signal);
  const hist = macd.map((v, i) => v - signalLine[i]);
  return { macd, signal: signalLine, hist };
}

export function computeRSI(arr, n = 14) {
  const ch = arr.map((v, i) => (i === 0 ? 0 : v - arr[i - 1]));
  return arr.map((_, i) => {
    if (i < n) return null;
    const sl = ch.slice(i - n + 1, i + 1);
    const g = sl.filter((x) => x > 0).reduce((a, b) => a + b, 0) / n;
    const l = sl.filter((x) => x < 0).reduce((a, b) => a + Math.abs(b), 0) / n;
    // No losses: overbought — unless there were no gains either, in which case
    // price hasn't moved at all and the correct reading is neutral, not 100.
    if (l === 0) return g === 0 ? 50 : 100;
    return +(100 - 100 / (1 + g / l)).toFixed(2);
  });
}

export function computeBollinger(arr, n = 20, k = 2) {
  const upper = new Array(arr.length).fill(null);
  const lower = new Array(arr.length).fill(null);
  for (let i = n - 1; i < arr.length; i++) {
    const slice = arr.slice(i - n + 1, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / n;
    const variance = slice.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / n;
    const std = Math.sqrt(variance);
    upper[i] = +(avg + k * std).toFixed(4);
    lower[i] = +(avg - k * std).toFixed(4);
  }
  return { upper, lower };
}
