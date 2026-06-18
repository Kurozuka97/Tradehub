"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Bell, BrainCircuit } from "lucide-react";

const CryptoSparkline = dynamic(() => import("./CryptoSparkline"), { ssr: false });

const COINS = [
  { id: "bitcoin", sym: "BTC", name: "Bitcoin" },
  { id: "ethereum", sym: "ETH", name: "Ethereum" },
  { id: "solana", sym: "SOL", name: "Solana" },
  { id: "binancecoin", sym: "BNB", name: "BNB" },
  { id: "ripple", sym: "XRP", name: "XRP" },
  { id: "cardano", sym: "ADA", name: "Cardano" },
  { id: "polkadot", sym: "DOT", name: "Polkadot" },
  { id: "avalanche-2", sym: "AVAX", name: "Avalanche" },
  { id: "chainlink", sym: "LINK", name: "Chainlink" },
  { id: "polygon", sym: "MATIC", name: "Polygon" },
  { id: "litecoin", sym: "LTC", name: "Litecoin" },
  { id: "uniswap", sym: "UNI", name: "Uniswap" },
  { id: "stellar", sym: "XLM", name: "Stellar" },
  { id: "filecoin", sym: "FIL", name: "Filecoin" },
  { id: "tron", sym: "TRX", name: "TRON" },
  { id: "monero", sym: "XMR", name: "Monero" },
];

const FOREX = ["MYR", "SGD", "EUR", "GBP", "JPY", "AUD", "CNY", "THB", "IDR", "KRW", "CAD", "CHF", "NZD", "HKD", "INR", "PHP"];

export default function Dashboard({ refreshKey, onLastUpdated, aiAlerts }) {
  const [prices, setPrices] = useState({});
  const [forex, setForex] = useState({});
  const [forexHistory, setForexHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [cr, fr] = await Promise.all([
        fetch("/api/crypto"),
        fetch("/api/forex"),
      ]);
      const cd = await cr.json();
      const fd = await fr.json();
      if (cd.error || fd.error) throw new Error("upstream");
      setPrices(cd);
      setForex(fd.rates || {});

      const forexRes = await fetch("/api/forex/history");
      const forexHist = await forexRes.json();
      setForexHistory(forexHist.history || {});
      const now = new Date();
      setLastUpdated(now);
      if (onLastUpdated) onLastUpdated(now);
    } catch {
      setError("Failed to fetch live data. Retrying in 60s...");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  useEffect(() => {
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);

  if (loading && Object.keys(prices).length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-300 gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Fetching live prices...</span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* AI Signals Panel */}
      {aiAlerts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={14} className="text-brand-purple" />
            <p className="text-xs text-brand-purple uppercase tracking-widest font-medium">AI Signals</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aiAlerts.slice(0, 6).map((alert, idx) => (
              <div
                key={`${alert.pair}-${alert.signal}-${idx}`}
                className={`bg-bg-card border rounded-xl p-3 flex items-center gap-3 ${
                  alert.signal === "BUY" ? "border-brand-green/40" : "border-brand-red/40"
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  alert.signal === "BUY" ? "bg-brand-green/10" : "bg-brand-red/10"
                }`}>
                  {alert.signal === "BUY" ? (
                    <TrendingUp size={14} className="text-brand-green" />
                  ) : (
                    <TrendingDown size={14} className="text-brand-red" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{alert.pair}</p>
                  <p className={`text-xs font-mono ${alert.signal === "BUY" ? "text-brand-green" : "text-brand-red"}`}>
                    {alert.signal} — {alert.confidence}% confidence
                  </p>
                </div>
                <span className="text-xs text-slate-300">{alert.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crypto */}
      <h2 className="text-xs font-medium text-slate-300 uppercase tracking-widest mb-3">
        Cryptocurrency
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {COINS.map((c) => {
          const d = prices[c.id];
          const chg = d?.usd_24h_change;
          const isUp = chg > 0;
          const isDown = chg < 0;
          const spark = d?.usd_24h_change ? d.sparkline_in_7d?.price : null;

          return (
            <div
              key={c.id}
              className="bg-bg-card border border-bg-border rounded-xl p-4 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white bg-bg-surface px-2 py-0.5 rounded">{c.sym}</span>
                  <span className="text-xs text-slate-300 truncate">{c.name}</span>
                </div>
                {isUp ? (
                  <TrendingUp size={14} className="text-brand-green" />
                ) : isDown ? (
                  <TrendingDown size={14} className="text-brand-red" />
                ) : (
                  <Minus size={14} className="text-slate-300" />
                )}
              </div>
              <p className="text-lg font-mono font-semibold text-white mb-1">
                ${d?.usd ? d.usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: d.usd >= 1000 ? 0 : 2 }) : "—"}
              </p>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-mono ${isUp ? "text-brand-green" : isDown ? "text-brand-red" : "text-slate-300"}`}>
                  {isUp ? "+" : ""}
                  {chg?.toFixed(2) ?? "0.00"}%
                </p>
                <p className="text-xs text-slate-300 font-mono">
                  RM{d?.myr ? d.myr.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
                </p>
              </div>
              {spark && (
                <div className="mt-2">
                  <CryptoSparkline data={spark} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Forex */}
      <h2 className="text-xs font-medium text-slate-300 uppercase tracking-widest mb-3">
        Forex (USD Base)
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {FOREX.map((sym) => {
          const rate = forex[sym];
          const hist = forexHistory[sym] || [];
          const prev = hist.length > 1 ? hist[hist.length - 2]?.rate : null;
          const chg = prev && rate ? ((rate - prev) / prev) * 100 : 0;
          const isUp = chg > 0;
          const isDown = chg < 0;

          return (
            <div
              key={sym}
              className="bg-bg-card border border-bg-border rounded-xl p-3 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-white">USD/{sym}</span>
                {isUp ? (
                  <TrendingUp size={12} className="text-brand-green" />
                ) : isDown ? (
                  <TrendingDown size={12} className="text-brand-red" />
                ) : (
                  <Minus size={12} className="text-slate-300" />
                )}
              </div>
              <p className="text-sm font-mono font-semibold text-white">
                {rate ? rate.toFixed(4) : "—"}
              </p>
              <p className={`text-xs font-mono ${isUp ? "text-brand-green" : isDown ? "text-brand-red" : "text-slate-300"}`}>
                {isUp ? "+" : ""}
                {chg.toFixed(2)}%
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
