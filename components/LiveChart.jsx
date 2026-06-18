"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import {
  Zap, ZapOff, TrendingUp, TrendingDown, Minus,
  BrainCircuit, Bell, BellOff, Settings
} from "lucide-react";

const PAIRS = [
  { symbol: "BTCUSDT", label: "BTC/USDT" },
  { symbol: "ETHUSDT", label: "ETH/USDT" },
  { symbol: "SOLUSDT", label: "SOL/USDT" },
  { symbol: "BNBUSDT", label: "BNB/USDT" },
  { symbol: "XRPUSDT", label: "XRP/USDT" },
  { symbol: "ADAUSDT", label: "ADA/USDT" },
  { symbol: "DOTUSDT", label: "DOT/USDT" },
  { symbol: "AVAXUSDT", label: "AVAX/USDT" },
  { symbol: "LINKUSDT", label: "LINK/USDT" },
  { symbol: "MATICUSDT", label: "MATIC/USDT" },
  { symbol: "LTCUSDT", label: "LTC/USDT" },
  { symbol: "UNIUSDT", label: "UNI/USDT" },
  { symbol: "XLMUSDT", label: "XLM/USDT" },
  { symbol: "FILUSDT", label: "FIL/USDT" },
  { symbol: "TRXUSDT", label: "TRX/USDT" },
  { symbol: "XMRUSDT", label: "XMR/USDT" },
];

const INTERVALS = [
  { key: "1m", label: "1m" },
  { key: "5m", label: "5m" },
  { key: "15m", label: "15m" },
  { key: "1h", label: "1h" },
  { key: "4h", label: "4h" },
  { key: "1d", label: "1D" },
];

// AI Signal Engine — runs entirely client-side using technical indicators
function analyzeSignal(candles, volumes) {
  if (candles.length < 30) return null;

  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);

  // RSI
  const rsi = computeRSI(closes, 14);
  const lastRSI = rsi[rsi.length - 1];

  // EMA cross
  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);
  const emaCross = ema9[ema9.length - 1] > ema21[ema21.length - 1];
  const prevEmaCross = ema9[ema9.length - 2] > ema21[ema21.length - 2];
  const goldenCross = emaCross && !prevEmaCross;
  const deathCross = !emaCross && prevEmaCross;

  // Volume spike
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const lastVol = volumes[volumes.length - 1];
  const volSpike = lastVol > avgVol * 1.5;

  // Support/Resistance bounce
  const recentLows = lows.slice(-20);
  const recentHighs = highs.slice(-20);
  const support = Math.min(...recentLows);
  const resistance = Math.max(...recentHighs);
  const lastClose = closes[closes.length - 1];
  const nearSupport = lastClose < support * 1.02;
  const nearResistance = lastClose > resistance * 0.98;

  // MACD
  const macdData = computeMACD(closes);
  const macdHist = macdData.hist;
  const macdRising = macdHist[macdHist.length - 1] > macdHist[macdHist.length - 2];

  let signal = null;
  let confidence = 0;
  let reasons = [];

  // BUY conditions
  if (lastRSI < 35 && nearSupport && macdRising) {
    signal = "BUY";
    confidence = 75;
    reasons = ["RSI oversold", "Near support", "MACD rising"];
    if (goldenCross) { confidence = 90; reasons.push("EMA golden cross"); }
    if (volSpike) { confidence = Math.min(confidence + 5, 95); reasons.push("Volume spike"); }
  }
  // SELL conditions
  else if (lastRSI > 65 && nearResistance && !macdRising) {
    signal = "SELL";
    confidence = 75;
    reasons = ["RSI overbought", "Near resistance", "MACD falling"];
    if (deathCross) { confidence = 90; reasons.push("EMA death cross"); }
    if (volSpike) { confidence = Math.min(confidence + 5, 95); reasons.push("Volume spike"); }
  }
  // Weak BUY
  else if (lastRSI < 40 && emaCross && macdRising) {
    signal = "BUY";
    confidence = 55;
    reasons = ["RSI low", "EMA bullish", "MACD rising"];
  }
  // Weak SELL
  else if (lastRSI > 60 && !emaCross && !macdRising) {
    signal = "SELL";
    confidence = 55;
    reasons = ["RSI high", "EMA bearish", "MACD falling"];
  }

  if (!signal) return null;

  return {
    signal,
    confidence,
    reasons,
    rsi: lastRSI,
    price: lastClose,
  };
}

function computeRSI(arr, n = 14) {
  const ch = arr.map((v, i) => (i === 0 ? 0 : v - arr[i - 1]));
  return arr.map((_, i) => {
    if (i < n) return null;
    const sl = ch.slice(i - n + 1, i + 1);
    const g = sl.filter((x) => x > 0).reduce((a, b) => a + b, 0) / n;
    const l = sl.filter((x) => x < 0).reduce((a, b) => a + Math.abs(b), 0) / n;
    if (l === 0) return 100;
    return +(100 - 100 / (1 + g / l)).toFixed(2);
  });
}

function computeEMA(arr, n) {
  const k = 2 / (n + 1);
  const ema = [];
  arr.forEach((price, i) => {
    if (i === 0) ema[i] = price;
    else ema[i] = price * k + ema[i - 1] * (1 - k);
  });
  return ema;
}

function computeMACD(arr, fast = 12, slow = 26, signal = 9) {
  const emaFast = computeEMA(arr, fast);
  const emaSlow = computeEMA(arr, slow);
  const macd = emaFast.map((v, i) => v - emaSlow[i]);
  const signalLine = computeEMA(macd, signal);
  const hist = macd.map((v, i) => v - signalLine[i]);
  return { macd, signal: signalLine, hist };
}

export default function LiveChart({ onAiAlert }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const markerSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const candlesRef = useRef([]);
  const volumesRef = useRef([]);
  const lastSignalRef = useRef(null);
  const signalCooldownRef = useRef(0);

  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [selectedInterval, setSelectedInterval] = useState("1m");
  const [connected, setConnected] = useState(false);
  const [lastPrice, setLastPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aiSignal, setAiSignal] = useState(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [minConfidence, setMinConfidence] = useState(60);

  // Request notification permission
  const enableNotifications = async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      setNotificationsEnabled(perm === "granted");
    }
  };

  const sendNotification = (title, body) => {
    if (notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body, icon: "🔔" });
    }
  };

  // Fetch initial historical candles
  const fetchHistory = useCallback(async (symbol, interval) => {
    setLoading(true);
    setError("");
    setAiSignal(null);
    lastSignalRef.current = null;
    try {
      const res = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=200`
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
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volData);
      }

      // Run AI analysis on historical data
      const signal = analyzeSignal(candles, volumes);
      if (signal && signal.confidence >= minConfidence) {
        setAiSignal(signal);
      }

      const lastCandle = candles[candles.length - 1];
      if (lastCandle) {
        setLastPrice(lastCandle.close);
        setPriceChange(((lastCandle.close - lastCandle.open) / lastCandle.open) * 100);
      }
    } catch (err) {
      setError("Failed to load chart data. Retrying...");
    }
    setLoading(false);
  }, [minConfidence]);

  // Initialize chart
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

  // Fetch history when pair/interval changes
  useEffect(() => {
    fetchHistory(selectedPair, selectedInterval);
  }, [selectedPair, selectedInterval, fetchHistory]);

  // WebSocket connection
  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const stream = `${selectedPair.toLowerCase()}@kline_${selectedInterval}`;
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${stream}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError("");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
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
        if (candlesRef.current.length > 200) {
          candlesRef.current.shift();
          volumesRef.current.shift();
        }
      }

      setLastPrice(candle.close);
      setPriceChange(((candle.close - candle.open) / candle.open) * 100);

      // AI Signal check — only every 10 ticks to avoid spam
      signalCooldownRef.current += 1;
      if (signalCooldownRef.current >= 10 && candlesRef.current.length >= 30) {
        signalCooldownRef.current = 0;
        const signal = analyzeSignal(candlesRef.current, volumesRef.current);
        if (signal && signal.confidence >= minConfidence) {
          const signalKey = `${selectedPair}-${signal.signal}`;
          if (lastSignalRef.current !== signalKey) {
            lastSignalRef.current = signalKey;
            setAiSignal(signal);

            const alertData = {
              pair: selectedPair,
              signal: signal.signal,
              confidence: signal.confidence,
              price: signal.price,
              time: new Date().toLocaleTimeString(),
              reasons: signal.reasons,
            };

            if (onAiAlert) {
              onAiAlert(alertData);
            }

            sendNotification(
              `🚨 ${signal.signal} Signal: ${selectedPair}`,
              `${signal.confidence}% confidence at $${signal.price.toLocaleString()} — ${signal.reasons.join(", ")}`
            );

            // Add marker on chart
            if (candleSeriesRef.current) {
              candleSeriesRef.current.setMarkers([
                {
                  time: candle.time,
                  position: signal.signal === "BUY" ? "belowBar" : "aboveBar",
                  color: signal.signal === "BUY" ? "#00d4aa" : "#ff4d6a",
                  shape: signal.signal === "BUY" ? "arrowUp" : "arrowDown",
                  text: `${signal.signal} ${signal.confidence}%`,
                  size: 2,
                },
              ]);
            }
          }
        }
      }
    };

    ws.onclose = () => {
      setConnected(false);
      reconnectTimeoutRef.current = setTimeout(() => {
        setSelectedPair((p) => p);
      }, 3000);
    };

    ws.onerror = () => {
      setConnected(false);
      setError("WebSocket error. Reconnecting...");
    };

    return () => {
      ws.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [selectedPair, selectedInterval, minConfidence, onAiAlert, notificationsEnabled]);

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
        {/* Pair selector */}
        <select
          value={selectedPair}
          onChange={(e) => setSelectedPair(e.target.value)}
          className="text-sm"
        >
          {PAIRS.map((p) => (
            <option key={p.symbol} value={p.symbol}>
              {p.label}
            </option>
          ))}
        </select>

        {/* Interval selector */}
        <div className="flex gap-1">
          {INTERVALS.map((int) => (
            <button
              key={int.key}
              onClick={() => setSelectedInterval(int.key)}
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

        {/* Connection status */}
        <div className="flex items-center gap-1.5 ml-auto">
          {connected ? (
            <>
              <Zap size={12} className="text-brand-green" />
              <span className="text-xs text-brand-green font-medium">Live</span>
            </>
          ) : (
            <>
              <ZapOff size={12} className="text-brand-red" />
              <span className="text-xs text-brand-red font-medium">Offline</span>
            </>
          )}
        </div>

        {/* Notification toggle */}
        <button
          onClick={notificationsEnabled ? () => setNotificationsEnabled(false) : enableNotifications}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
            notificationsEnabled
              ? "bg-brand-green/10 border-brand-green/30 text-brand-green"
              : "bg-bg-card border-bg-border text-slate-400 hover:text-slate-200"
          }`}
          title={notificationsEnabled ? "Notifications ON" : "Enable notifications"}
        >
          {notificationsEnabled ? <Bell size={12} /> : <BellOff size={12} />}
          {notificationsEnabled ? "ON" : "OFF"}
        </button>

        {/* Settings */}
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-bg-card border border-bg-border text-slate-400 hover:text-white transition-colors"
        >
          <Settings size={12} />
          AI
        </button>
      </div>

      {/* AI Settings Panel */}
      {showSettings && (
        <div className="bg-bg-card border border-bg-border rounded-xl p-4 mb-4">
          <p className="text-xs text-slate-300 uppercase tracking-widest font-medium mb-3">AI Signal Settings</p>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Min Confidence: {minConfidence}%</label>
              <input
                type="range"
                min="50"
                max="95"
                step="5"
                value={minConfidence}
                onChange={(e) => setMinConfidence(Number(e.target.value))}
                className="w-48"
              />
            </div>
            <div className="text-xs text-slate-300">
              <p>Signals use: RSI, EMA cross, MACD, Volume, Support/Resistance</p>
              <p className="mt-1">Higher confidence = fewer but stronger signals</p>
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
              {aiSignal.confidence}% confidence at ${aiSignal.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            ${lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

      {/* Chart container */}
      <div
        ref={chartContainerRef}
        className="bg-bg-card border border-bg-border rounded-xl overflow-hidden"
        style={{ height: 420 }}
      />

      <p className="mt-3 text-xs text-slate-300">
        Data via Binance WebSocket. AI signals use RSI, EMA, MACD, Volume & Support/Resistance analysis. Not financial advice.
      </p>
    </div>
  );
}
