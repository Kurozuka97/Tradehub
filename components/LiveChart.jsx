"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { Zap, ZapOff, TrendingUp, TrendingDown, Minus } from "lucide-react";

const PAIRS = [
  { symbol: "BTCUSDT", label: "BTC/USDT" },
  { symbol: "ETHUSDT", label: "ETH/USDT" },
  { symbol: "SOLUSDT", label: "SOL/USDT" },
  { symbol: "BNBUSDT", label: "BNB/USDT" },
  { symbol: "XRPUSDT", label: "XRP/USDT" },
  { symbol: "ADAUSDT", label: "ADA/USDT" },
  { symbol: "DOTUSDT", label: "DOT/USDT" },
  { symbol: "AVAXUSDT", label: "AVAX/USDT" },
];

const INTERVALS = [
  { key: "1m", label: "1m" },
  { key: "5m", label: "5m" },
  { key: "15m", label: "15m" },
  { key: "1h", label: "1h" },
  { key: "4h", label: "4h" },
  { key: "1d", label: "1D" },
];

export default function LiveChart() {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const candlesMapRef = useRef(new Map());
  const [selectedPair, setSelectedPair] = useState("BTCUSDT");
  const [selectedInterval, setSelectedInterval] = useState("1m");
  const [connected, setConnected] = useState(false);
  const [lastPrice, setLastPrice] = useState(null);
  const [priceChange, setPriceChange] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch initial historical candles
  const fetchHistory = useCallback(async (symbol, interval) => {
    setLoading(true);
    setError("");
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

      const volumes = data.map((d) => ({
        time: d[0] / 1000,
        value: parseFloat(d[5]),
        color: parseFloat(d[4]) >= parseFloat(d[1]) ? "#00d4aa40" : "#ff4d6a40",
      }));

      candlesMapRef.current.clear();
      candles.forEach((c) => candlesMapRef.current.set(c.time, c));

      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(candles);
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(volumes);
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
  }, []);

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
    // Close existing connection
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

      setLastPrice(candle.close);
      setPriceChange(((candle.close - candle.open) / candle.open) * 100);
    };

    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3s
      reconnectTimeoutRef.current = setTimeout(() => {
        setSelectedPair((p) => p); // trigger re-render to reconnect
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
  }, [selectedPair, selectedInterval]);

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
      </div>

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
        Data via Binance WebSocket. Real-time updates every tick. Auto-reconnect on disconnect.
      </p>
    </div>
  );
}
