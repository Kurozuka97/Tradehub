"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import {
  Zap, TrendingUp, TrendingDown, Minus,
  BrainCircuit, Bell, BellOff, Settings, WifiOff, RotateCcw
} from "lucide-react";
import { LIVE_PAIRS } from "@/lib/coins";
import { formatPrice } from "@/lib/format";
import { analyzeSignal } from "@/lib/signals";
import {
  addSignal,
  loadSignals,
  resolveSignals,
  markersForRange,
} from "@/lib/signalStore";

const PAIRS = LIVE_PAIRS;

const INTERVALS = [
  { key: "1m", label: "1m" },
  { key: "5m", label: "5m" },
  { key: "15m", label: "15m" },
  { key: "1h", label: "1h" },
  { key: "4h", label: "4h" },
  { key: "1d", label: "1D" },
];

const MAX_RECONNECT_DELAY = 30000; // 30s cap
const HEARTBEAT_INTERVAL = 20000;   // ping every 20s
const PONG_TIMEOUT = 10000;         // wait 10s for response
const SIGNAL_COOLDOWN_TICKS = 10;   // evaluate AI every 10 ticks
const SIGNAL_DEDUPE_MS = 30 * 60 * 1000; // one signal per pair+interval+direction / 30min
const CANDLE_LIMIT = 200;

// ─── Main Component ─────────────────────────────────────────────
export default function LiveChart() {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const candlesRef = useRef([]);
  const volumesRef = useRef([]);
  const markersRef = useRef([]);
  const signalCooldownRef = useRef(0);
  const signalDedupeRef = useRef({});
  const reconnectAttemptsRef = useRef(0);
  const isIntentionalCloseRef = useRef(false);
  const pairSwitchDebounceRef = useRef(null);

  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [selectedInterval, setSelectedInterval] = useState("1m");
  const [connected, setConnected] = useState(false);
  const [lastPrice, setLastPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reconnectStatus, setReconnectStatus] = useState("");
  const [aiSignal, setAiSignal] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [minConfidence, setMinConfidence] = useState(60);
  // Bumping this forces the socket effect to tear down and reconnect — used by
  // the Reconnect button. (A no-op setState can't restart an effect.)
  const [wsNonce, setWsNonce] = useState(0);

  // ─── Notifications ──────────────────────────────────────────
  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setError("Browser notifications not supported");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationsEnabled(perm === "granted");
      if (perm !== "granted") {
        setError("Notification permission denied");
      }
    } catch {
      setError("Failed to request notification permission");
    }
  };

  const sendNotification = useCallback((title, body) => {
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body, icon: "🔔" });
      } catch {
        // Silent fail
      }
    }
  }, [notificationsEnabled]);

  // Keep live values reachable from the socket handlers without putting them
  // in the socket effect's deps — otherwise every slider tick would drop the
  // WebSocket and every parent re-render would too.
  const minConfidenceRef = useRef(minConfidence);
  const sendNotificationRef = useRef(sendNotification);
  useEffect(() => {
    minConfidenceRef.current = minConfidence;
    sendNotificationRef.current = sendNotification;
  }, [minConfidence, sendNotification]);

  // ─── Fetch History ────────────────────────────────────────
  const fetchHistory = useCallback(async (symbol, interval) => {
    setLoading(true);
    setError("");
    setReconnectStatus("");
    setAiSignal(null);
    signalCooldownRef.current = 0;
    signalDedupeRef.current = {};

    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${CANDLE_LIMIT}`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) throw new Error("fetch_failed");
      const data = await res.json();

      const candles = data.map((d) => ({
        time: d[0] / 1000,
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
      }));

      const volumes = data.map((d) => parseFloat(d[5]));
      const volData = data.map((d) => ({
        time: d[0] / 1000,
        value: parseFloat(d[5]),
        color: parseFloat(d[4]) >= parseFloat(d[1]) ? "#00d4aa40" : "#ff4d6a40",
      }));

      candlesRef.current = candles;
      volumesRef.current = volumes;

      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(candles);
        // Re-seed markers from the persisted signal log so history keeps its
        // arrows across refreshes (times are snapped into the loaded range).
        markersRef.current = markersForRange(loadSignals(), symbol, interval, candles);
        candleSeriesRef.current.setMarkers(markersRef.current);
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volData);
      }

      // Catch up any open signals this window can settle.
      resolveSignals(symbol, interval, candles, candles[candles.length - 1]?.close);

      const signal = analyzeSignal(candles, volumes);
      if (signal && signal.confidence >= minConfidenceRef.current) {
        setAiSignal(signal);
      }

      const lastCandle = candles[candles.length - 1];
      if (lastCandle) {
        setLastPrice(lastCandle.close);
        setPriceChange(((lastCandle.close - lastCandle.open) / lastCandle.open) * 100);
      }
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Chart data timeout. Retrying...");
      } else {
        setError("Failed to load chart data. Retrying...");
      }
    }
    setLoading(false);
  }, []);

  // ─── Initialize Chart ─────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#1a1e28" },
        textColor: "#94a3b8",
      },
      grid: {
        vertLines: { color: "#252836" },
        horzLines: { color: "#252836" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#4d9fff", width: 1, style: 2 },
        horzLine: { color: "#4d9fff", width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: "#252836",
      },
      timeScale: {
        borderColor: "#252836",
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: 420,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#00d4aa",
      downColor: "#ff4d6a",
      borderUpColor: "#00d4aa",
      borderDownColor: "#ff4d6a",
      wickUpColor: "#00d4aa",
      wickDownColor: "#ff4d6a",
    });

    const volumeSeries = chart.addHistogramSeries({
      color: "#00d4aa40",
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  // ─── Fetch on pair/interval change ────────────────────────
  useEffect(() => {
    fetchHistory(selectedPair, selectedInterval);
  }, [selectedPair, selectedInterval, fetchHistory]);

  // ─── WebSocket with Heartbeat & Exponential Backoff ───────
  // Deps are deliberately limited to what must rebuild the socket. Live
  // values (minConfidence, notification callback) are read via refs.
  useEffect(() => {
    let ws = null;
    let pingTimer = null;
    let pongTimer = null;

    const cleanup = () => {
      clearInterval(pingTimer);
      clearTimeout(pongTimer);
      clearTimeout(reconnectTimeoutRef.current);
      if (ws) {
        isIntentionalCloseRef.current = true;
        try { ws.close(); } catch { /* ignore */ }
      }
    };

    const connect = () => {
      cleanup();
      isIntentionalCloseRef.current = false;

      const stream = `${selectedPair.toLowerCase()}@kline_${selectedInterval}`;
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);

      ws.onopen = () => {
        setConnected(true);
        setError("");
        setReconnectStatus("");
        reconnectAttemptsRef.current = 0;

        // Heartbeat: send ping every 20s
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            // Binance uses LIST_SUBSCRIPTIONS as a keep-alive
            ws.send(JSON.stringify({ method: "LIST_SUBSCRIPTIONS", id: Date.now() }));

            // If no response in 10s, force reconnect
            pongTimer = setTimeout(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
              }
            }, PONG_TIMEOUT);
          }
        }, HEARTBEAT_INTERVAL);
      };

      ws.onmessage = (event) => {
        // Clear pong timeout on any message
        clearTimeout(pongTimer);
        pongTimer = null;

        let data;
        try {
          data = JSON.parse(event.data);
        } catch {
          return;
        }

        // Skip heartbeat responses
        if (data.id !== undefined && !data.k) return;
        if (!data.k) return;

        const k = data.k;
        const candle = {
          time: k.t / 1000,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
        };
        const volume = {
          time: k.t / 1000,
          value: parseFloat(k.v),
          color: parseFloat(k.c) >= parseFloat(k.o) ? "#00d4aa40" : "#ff4d6a40",
        };

        if (candleSeriesRef.current) {
          candleSeriesRef.current.update(candle);
        }
        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.update(volume);
        }

        // Update stored candles
        const existingIdx = candlesRef.current.findIndex((c) => c.time === candle.time);
        if (existingIdx >= 0) {
          candlesRef.current[existingIdx] = candle;
          volumesRef.current[existingIdx] = parseFloat(k.v);
        } else {
          candlesRef.current.push(candle);
          volumesRef.current.push(parseFloat(k.v));
          if (candlesRef.current.length > CANDLE_LIMIT) {
            candlesRef.current.shift();
            volumesRef.current.shift();
          }
        }

        setLastPrice(candle.close);
        setPriceChange(((candle.close - candle.open) / candle.open) * 100);

        // Settle any open signals this tick can resolve (±1% / candle expiry).
        resolveSignals(selectedPair, selectedInterval, candlesRef.current, candle.close);

        // AI Signal check
        signalCooldownRef.current += 1;
        if (signalCooldownRef.current >= SIGNAL_COOLDOWN_TICKS && candlesRef.current.length >= 30) {
          signalCooldownRef.current = 0;
          const signal = analyzeSignal(candlesRef.current, volumesRef.current);
          if (signal && signal.confidence >= minConfidenceRef.current) {
            const key = `${selectedPair}-${selectedInterval}-${signal.signal}`;
            const lastAt = signalDedupeRef.current[key] || 0;

            if (Date.now() - lastAt >= SIGNAL_DEDUPE_MS) {
              signalDedupeRef.current[key] = Date.now();
              setAiSignal(signal);

              addSignal({
                id: `${selectedPair}-${selectedInterval}-${Date.now()}-${Math.random()
                  .toString(36)
                  .slice(2, 7)}`,
                pair: selectedPair,
                interval: selectedInterval,
                signal: signal.signal,
                confidence: signal.confidence,
                price: signal.price,
                time: new Date().toLocaleTimeString(),
                timestamp: Date.now(),
                reasons: signal.reasons,
                status: "open",
              });

              // Rebuild markers from the log — single source of truth.
              markersRef.current = markersForRange(
                loadSignals(),
                selectedPair,
                selectedInterval,
                candlesRef.current
              );
              if (candleSeriesRef.current) {
                candleSeriesRef.current.setMarkers(markersRef.current);
              }

              sendNotificationRef.current(
                `${signal.signal} Signal: ${selectedPair}`,
                `${signal.confidence}% confidence at $${formatPrice(signal.price)} — ${signal.reasons.join(", ")}`
              );
            }
          }
        }
      };

      ws.onclose = (e) => {
        setConnected(false);
        clearInterval(pingTimer);
        clearTimeout(pongTimer);

        if (!isIntentionalCloseRef.current) {
          const delay = Math.min(
            1000 * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_DELAY
          );
          reconnectAttemptsRef.current += 1;

          setReconnectStatus(`Reconnecting in ${(delay / 1000).toFixed(0)}s (#${reconnectAttemptsRef.current})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // Let onclose handle reconnect — don't duplicate
        setConnected(false);
      };
    };

    connect();

    // Page visibility — reconnect when tab becomes active
    const handleVisibility = () => {
      if (!document.hidden && ws && ws.readyState !== WebSocket.OPEN) {
        reconnectAttemptsRef.current = 0;
        connect();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    // Network status — reconnect when back online
    const handleOnline = () => {
      reconnectAttemptsRef.current = 0;
      connect();
    };
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("online", handleOnline);
      cleanup();
    };
  }, [selectedPair, selectedInterval, wsNonce]);

  // ─── Debounced pair switch ────────────────────────────────
  const handlePairChange = (symbol) => {
    if (pairSwitchDebounceRef.current) {
      clearTimeout(pairSwitchDebounceRef.current);
    }
    pairSwitchDebounceRef.current = setTimeout(() => {
      setSelectedPair(symbol);
    }, 300);
  };

  const handleIntervalChange = (interval) => {
    if (pairSwitchDebounceRef.current) {
      clearTimeout(pairSwitchDebounceRef.current);
    }
    pairSwitchDebounceRef.current = setTimeout(() => {
      setSelectedInterval(interval);
    }, 300);
  };

  // ─── Manual reconnect ───────────────────────────────────
  // Bumping wsNonce re-runs the socket effect, whose cleanup closes the old
  // socket. (The previous `setSelectedPair(p => p)` was a no-op, so the button
  // closed the socket and never reopened it.)
  const manualReconnect = () => {
    reconnectAttemptsRef.current = 0;
    setWsNonce((n) => n + 1);
  };

  const priceIcon =
    priceChange > 0 ? (
      <TrendingUp size={14} className="text-brand-green" />
    ) : priceChange < 0 ? (
      <TrendingDown size={14} className="text-brand-red" />
    ) : (
      <Minus size={14} className="text-slate-300" />
    );

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={selectedPair}
          onChange={(e) => handlePairChange(e.target.value)}
          className="text-sm"
          aria-label="Select pair"
        >
          {PAIRS.map((p) => (
            <option key={p.symbol} value={p.symbol}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {INTERVALS.map((int) => (
            <button
              key={int.key}
              onClick={() => handleIntervalChange(int.key)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                selectedInterval === int.key
                  ? "bg-brand-green/10 border-brand-green/30 text-brand-green font-medium"
                  : "bg-bg-card border-bg-border text-slate-400 hover:text-slate-200"
              }`}
            >
              {int.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {connected ? (
            <>
              <Zap size={12} className="text-brand-green" />
              <span className="text-xs text-brand-green font-medium">Live</span>
            </>
          ) : (
            <>
              <WifiOff size={12} className="text-brand-red" />
              <span className="text-xs text-brand-red font-medium">Offline</span>
            </>
          )}
        </div>

        {/* Manual reconnect */}
        {!connected && (
          <button
            onClick={manualReconnect}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-brand-blue/10 border border-brand-blue/30 text-brand-blue hover:bg-brand-blue/20 transition-colors"
            title="Force reconnect"
          >
            <RotateCcw size={11} />
            Reconnect
          </button>
        )}

        <button
          onClick={notificationsEnabled ? () => setNotificationsEnabled(false) : enableNotifications}
          className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs border transition-colors ${
            notificationsEnabled
              ? "bg-brand-green/10 border-brand-green/30 text-brand-green"
              : "bg-bg-card border-bg-border text-slate-400 hover:text-slate-200"
          }`}
          title={notificationsEnabled ? "Notifications ON" : "Enable notifications"}
          aria-label={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
        >
          {notificationsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
        </button>

        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-bg-card border border-bg-border text-slate-400 hover:text-white transition-colors"
          aria-label="Signal settings"
          aria-expanded={showSettings}
        >
          <Settings size={12} />
        </button>
      </div>

      {/* Reconnect status */}
      {reconnectStatus && !connected && (
        <div className="mb-3 px-3 py-2 bg-brand-amber/5 border border-brand-amber/20 rounded-lg text-brand-amber text-xs flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-brand-amber/30 border-t-brand-amber rounded-full animate-spin" />
          {reconnectStatus}
        </div>
      )}

      {/* AI Settings Panel */}
      {showSettings && (
        <div className="bg-bg-card border border-bg-border rounded-xl p-4 mb-4">
          <p className="text-xs text-slate-300 uppercase tracking-widest font-medium mb-3">AI Signal Settings</p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div>
              <label htmlFor="min-confidence" className="block text-xs text-slate-300 mb-1">
                Min Confidence: {minConfidence}%
              </label>
              <input
                id="min-confidence"
                type="range"
                min="40"
                max="95"
                step="5"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-48"
              />
            </div>
            <div className="text-xs text-slate-300">
              <p>Scored from RSI, support/resistance, MACD, EMA cross, structure & volume.</p>
              <p className="mt-1">
                Confidence = total points (max 95). One signal per pair+direction every 30min.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Signal Banner */}
      {aiSignal && (
        <div className={`mb-4 px-4 py-3 rounded-xl border flex items-center gap-3 ${
          aiSignal.signal === "BUY"
            ? "bg-brand-green/5 border-brand-green/30"
            : "bg-brand-red/5 border-brand-red/30"
        }`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            aiSignal.signal === "BUY" ? "bg-brand-green/10" : "bg-brand-red/10"
          }`}>
            <BrainCircuit size={18} className={aiSignal.signal === "BUY" ? "text-brand-green" : "text-brand-red"} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">
              AI {aiSignal.signal} Signal — {selectedPair}
            </p>
            <p className={`text-xs font-mono ${aiSignal.signal === "BUY" ? "text-brand-green" : "text-brand-red"}`}>
              {aiSignal.confidence}% confidence at ${formatPrice(aiSignal.price)}
            </p>
            <p className="text-xs text-slate-300 mt-0.5">
              {aiSignal.reasons?.join(" · ")}
            </p>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-bold ${
            aiSignal.signal === "BUY"
              ? "bg-brand-green/20 text-brand-green"
              : "bg-brand-red/20 text-brand-red"
          }`}>
            {aiSignal.signal}
          </div>
        </div>
      )}

      {/* Price ticker */}
      {lastPrice !== null && (
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl font-mono font-semibold text-white">
            ${formatPrice(lastPrice)}
          </span>
          <span
            className={`flex items-center gap-1 text-sm font-mono font-medium ${
              priceChange >= 0 ? "text-brand-green" : "text-brand-red"
            }`}
          >
            {priceIcon}
            {priceChange >= 0 ? "+" : ""}
            {priceChange.toFixed(2)}%
          </span>
        </div>
      )}

      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-[420px] text-slate-300 gap-2 bg-bg-card border border-bg-border rounded-xl">
          <div className="w-5 h-5 border-2 border-brand-green/30 border-t-brand-green rounded-full animate-spin" />
          <span className="text-sm">Loading chart...</span>
        </div>
      )}

      <div
        ref={chartContainerRef}
        className="bg-bg-card border border-bg-border rounded-xl overflow-hidden"
        style={{ height: 420 }}
      />

      <p className="mt-3 text-xs text-slate-300">
        Data via Binance WebSocket. Signals are a rule-based confluence of RSI, EMA, MACD,
        structure, volume & support/resistance — logged with a ±1% target so the hit rate is
        measurable. Not financial advice.
      </p>
    </div>
  );
}
