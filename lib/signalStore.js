// Persistent, measurable signal log (localStorage).
//
// Every emitted signal is stored with its entry price and then resolved as
// candles arrive: ±1% target -> win/loss, or expiry after SIGNAL_MAX_CANDLES.
// This is what turns the signal engine from "trust me" into a hit rate.

const KEY = "tradehub_signals";

/** Hard cap so the log can't grow without bound. */
export const MAX_SIGNALS = 200;
/** Resolve a signal once price travels this far from entry (percent). */
export const SIGNAL_TARGET_PCT = 1;
/** Expire an unresolved signal after this many candles of the same pair+interval. */
export const SIGNAL_MAX_CANDLES = 50;
/** Open signals older than this are expired on startup. */
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const UP = 1 + SIGNAL_TARGET_PCT / 100;
const DOWN = 1 - SIGNAL_TARGET_PCT / 100;

const hasStorage = () => typeof window !== "undefined" && !!window.localStorage;

let cache = null;
const listeners = new Set();

function read() {
  if (cache) return cache;
  if (!hasStorage()) return (cache = []);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY));
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(list) {
  cache = list;
  if (hasStorage()) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* storage full / private mode — keep in-memory copy */
    }
  }
  listeners.forEach((cb) => {
    try {
      cb(list);
    } catch {
      /* one bad listener shouldn't break the rest */
    }
  });
}

export function loadSignals() {
  return read();
}

/** Subscribe to log changes. Returns an unsubscribe function. */
export function subscribeSignals(cb) {
  listeners.add(cb);
  const onStorage = (e) => {
    if (e.key === KEY) {
      cache = null;
      cb(read());
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

/** Append a newly emitted signal (newest first, capped). */
export function addSignal(sig) {
  const list = read().filter((s) => s.id !== sig.id);
  write([sig, ...list].slice(0, MAX_SIGNALS));
}

export function clearSignals() {
  write([]);
}

function targetStatus(sig, price) {
  if (price == null || isNaN(price)) return null;
  if (sig.signal === "BUY") {
    if (price >= sig.price * UP) return "win";
    if (price <= sig.price * DOWN) return "loss";
  } else {
    if (price <= sig.price * DOWN) return "win";
    if (price >= sig.price * UP) return "loss";
  }
  return null;
}

function resolveOne(sig, candles, livePrice) {
  // Live price first — catches the move inside the candle the signal fired in.
  const live = targetStatus(sig, livePrice);
  if (live) return { status: live, exitPrice: livePrice };

  // Then walk every candle printed after the signal (conservative: the signal's
  // own bucket is skipped, since we don't know how far price moved post-signal).
  const after = candles.filter((c) => c.time * 1000 > sig.timestamp);
  for (const c of after) {
    if (sig.signal === "BUY") {
      if (c.high >= sig.price * UP) return { status: "win", exitPrice: c.high };
      if (c.low <= sig.price * DOWN) return { status: "loss", exitPrice: c.low };
    } else {
      if (c.low <= sig.price * DOWN) return { status: "win", exitPrice: c.low };
      if (c.high >= sig.price * UP) return { status: "loss", exitPrice: c.high };
    }
  }

  if (after.length >= SIGNAL_MAX_CANDLES) {
    return { status: "expired", exitPrice: null };
  }
  return null;
}

/**
 * Resolve open signals for one pair+interval against its candles.
 * Returns true when a status changed (and the log was persisted).
 */
export function resolveSignals(pair, interval, candles, livePrice) {
  const list = read();
  if (!list.some((s) => s.status === "open" && s.pair === pair && s.interval === interval)) {
    return false;
  }
  if (!candles || !candles.length) return false;

  let changed = false;
  const next = list.map((s) => {
    if (s.status !== "open" || s.pair !== pair || s.interval !== interval) return s;
    const result = resolveOne(s, candles, livePrice);
    if (!result) return s;
    changed = true;
    return { ...s, status: result.status, exitPrice: result.exitPrice };
  });

  if (changed) write(next);
  return changed;
}

/** Expire open signals older than STALE_MS (startup housekeeping). */
export function pruneStale() {
  const list = read();
  const now = Date.now();
  let changed = false;
  const next = list.map((s) => {
    if (s.status === "open" && now - s.timestamp > STALE_MS) {
      changed = true;
      return { ...s, status: "expired" };
    }
    return s;
  });
  if (changed) write(next);
  return changed;
}

export function getSignalStats(list = read()) {
  let wins = 0;
  let losses = 0;
  let open = 0;
  let expired = 0;
  let confWin = 0;
  let confLoss = 0;

  for (const s of list) {
    if (s.status === "win") {
      wins++;
      confWin += s.confidence || 0;
    } else if (s.status === "loss") {
      losses++;
      confLoss += s.confidence || 0;
    } else if (s.status === "open") {
      open++;
    } else if (s.status === "expired") {
      expired++;
    }
  }

  const resolved = wins + losses;
  return {
    total: list.length,
    wins,
    losses,
    open,
    expired,
    resolved,
    hitRate: resolved ? Math.round((wins / resolved) * 100) : null,
    avgConfWin: wins ? Math.round(confWin / wins) : null,
    avgConfLoss: losses ? Math.round(confLoss / losses) : null,
  };
}

/**
 * Turn log entries into lightweight-charts markers for the loaded range.
 * Times are snapped onto real candle times — lightweight-charts rejects
 * markers that fall outside the loaded data.
 */
export function markersForRange(list, pair, interval, candles) {
  if (!candles || candles.length < 2) return [];

  const first = candles[0].time;
  const last = candles[candles.length - 1].time;
  const byTime = new Map();

  for (const s of list) {
    if (s.pair !== pair || s.interval !== interval) continue;
    const t = Math.floor(s.timestamp / 1000);
    if (t < first || t > last) continue;

    // Snap down onto the candle that was open when the signal fired.
    let snapped = first;
    for (const c of candles) {
      if (c.time <= t) snapped = c.time;
      else break;
    }

    const existing = byTime.get(snapped);
    if (!existing || s.timestamp > existing.timestamp) byTime.set(snapped, s);
  }

  return [...byTime.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([time, s]) => ({
      time,
      position: s.signal === "BUY" ? "belowBar" : "aboveBar",
      color: s.signal === "BUY" ? "#00d4aa" : "#ff4d6a",
      shape: s.signal === "BUY" ? "arrowUp" : "arrowDown",
      text: `${s.signal} ${s.confidence}%`,
      size: 2,
    }));
}
