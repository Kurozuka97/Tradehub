"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, BrainCircuit } from "lucide-react";
import { COINS, FOREX } from "@/lib/coins";
import { usd, formatMyr } from "@/lib/format";
import {
  getSignalStats,
  clearSignals,
  SIGNAL_TARGET_PCT,
  SIGNAL_MAX_CANDLES,
} from "@/lib/signalStore";

const CryptoSparkline = dynamic(() => import("./CryptoSparkline"), { ssr: false });

const STATUS_META = {
  open: { label: "OPEN", className: "bg-brand-amber/10 text-brand-amber border-brand-amber/30" },
  win: { label: "WIN", className: "bg-brand-green/10 text-brand-green border-brand-green/30" },
  loss: { label: "LOSS", className: "bg-brand-red/10 text-brand-red border-brand-red/30" },
  expired: { label: "EXPIRED", className: "bg-bg-surface text-slate-300 border-bg-border" },
};

export default function Dashboard({ refreshKey, onLastUpdated, signals = [] }) {
  const [prices, setPrices] = useState({});
  const [forex, setForex] = useState({});
  const [forexHistory, setForexHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  const stats = getSignalStats(signals);

  return (
    <div>
      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* AI Signals Panel */}
      {signals.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit size={14} className="text-brand-purple" />
            <p className="text-xs text-brand-purple uppercase tracking-widest font-medium">AI Signals</p>
            <span className="text-xs text-slate-400">
              rule-based confluence · resolved at ±{SIGNAL_TARGET_PCT}% / {SIGNAL_MAX_CANDLES} candles
            </span>
            <button
              onClick={() => {
                if (window.confirm("Clear the entire signal log?")) clearSignals();
              }}
              className="ml-auto text-[11px] text-slate-400 hover:text-brand-red border border-bg-border hover:border-brand-red/40 bg-bg-card px-2 py-1 rounded-lg transition-colors"
            >
              Clear log
            </button>
          </div>

          {/* Performance strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            {[
              { label: "Signals", value: String(stats.total), color: "text-white" },
              {
                label: "Hit Rate",
                value: stats.hitRate == null ? "—" : `${stats.hitRate}%`,
                color:
                  stats.hitRate == null
                    ? "text-slate-300"
                    : stats.hitRate >= 50
                    ? "text-brand-green"
                    : "text-brand-red",
              },
              { label: "Wins", value: String(stats.wins), color: "text-brand-green" },
              { label: "Losses", value: String(stats.losses), color: "text-brand-red" },
              { label: "Open", value: String(stats.open), color: "text-brand-amber" },
              { label: "Expired", value: String(stats.expired), color: "text-slate-300" },
            ].map((m) => (
              <div key={m.label} className="bg-bg-card border border-bg-border rounded-xl p-3">
                <p className="text-[11px] text-slate-300 mb-1">{m.label}</p>
                <p className={`font-mono text-lg font-medium ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {signals.slice(0, 6).map((alert) => {
              const status = STATUS_META[alert.status] || STATUS_META.open;
              const isBuy = alert.signal === "BUY";
              return (
                <div
                  key={alert.id || `${alert.pair}-${alert.signal}-${alert.timestamp}`}
                  className={`bg-bg-card border rounded-xl p-3 ${
                    isBuy ? "border-brand-green/40" : "border-brand-red/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isBuy ? "bg-brand-green/10" : "bg-brand-red/10"
                      }`}
                    >
                      {isBuy ? (
                        <TrendingUp size={14} className="text-brand-green" />
                      ) : (
                        <TrendingDown size={14} className="text-brand-red" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{alert.pair}</p>
                      <p
                        className={`text-xs font-mono ${isBuy ? "text-brand-green" : "text-brand-red"}`}
                      >
                        {alert.signal} — {alert.confidence}% @ {usd(alert.price)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {alert.reasons?.length > 0 && (
                    <p className="text-xs text-slate-400 mt-2 truncate">
                      {alert.reasons.slice(0, 3).join(" · ")}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    {alert.time}
                    {alert.interval ? ` · ${alert.interval}` : ""}
                  </p>
                </div>
              );
            })}
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
          const spark = d?.sparkline_in_7d?.price;

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
                {usd(d?.usd)}
              </p>
              <div className="flex items-center justify-between">
                <p className={`text-xs font-mono ${isUp ? "text-brand-green" : isDown ? "text-brand-red" : "text-slate-300"}`}>
                  {isUp ? "+" : ""}
                  {chg?.toFixed(2) ?? "0.00"}%
                </p>
                <p className="text-xs text-slate-300 font-mono">
                  {formatMyr(d?.myr)}
                </p>
              </div>
              {spark && spark.length > 0 && (
                <div className="mt-2">
                  <CryptoSparkline data={spark} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Forex */}
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-xs font-medium text-slate-300 uppercase tracking-widest">
          Forex (USD Base)
        </h2>
        <span className="text-[11px] text-slate-400">change vs previous ECB close</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {FOREX.map((sym) => {
          const hist = forexHistory[sym] || [];
          const latest = hist.length ? hist[hist.length - 1] : null;
          const prev = hist.length > 1 ? hist[hist.length - 2] : null;

          // Rate and change must come from the same series — mixing /latest
          // with history compared two different dates and skewed the %.
          const rate = latest?.rate ?? forex[sym];
          const chg =
            latest && prev && prev.rate
              ? ((latest.rate - prev.rate) / prev.rate) * 100
              : 0;

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
              <p
                className={`text-xs font-mono ${isUp ? "text-brand-green" : isDown ? "text-brand-red" : "text-slate-300"}`}
                title={latest?.date ? `Close ${latest.date}` : undefined}
              >
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
