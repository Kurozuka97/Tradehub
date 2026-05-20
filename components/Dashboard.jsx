"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";

const COINS = [
  { id: "bitcoin", sym: "BTC", name: "Bitcoin" },
  { id: "ethereum", sym: "ETH", name: "Ethereum" },
  { id: "solana", sym: "SOL", name: "Solana" },
  { id: "binancecoin", sym: "BNB", name: "BNB" },
  { id: "ripple", sym: "XRP", name: "XRP" },
  { id: "cardano", sym: "ADA", name: "Cardano" },
  { id: "polkadot", sym: "DOT", name: "Polkadot" },
  { id: "avalanche-2", sym: "AVAX", name: "Avalanche" },
];

const FOREX = ["MYR", "SGD", "EUR", "GBP", "JPY", "AUD", "CNY"];

export default function Dashboard({ refreshKey }) {
  const [prices, setPrices] = useState({});
  const [forex, setForex] = useState({});
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
      setLastUpdated(new Date());
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
      <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
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

      {lastUpdated && (
        <p className="text-xs text-slate-600 mb-4">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </p>
      )}

      {/* Crypto */}
      <h2 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">
        Cryptocurrency
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {COINS.map((c) => {
          const d = prices[c.id];
          const chg = d?.usd_24h_change;
          const isUp = chg > 0;
          const isDown = chg < 0;
          return (
            <div
              key={c.id}
              className="bg-bg-card border border-bg-border rounded-xl p-4 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{c.sym}</span>
                {chg !== undefined ? (
                  isUp ? (
                    <TrendingUp size={13} className="text-brand-green" />
                  ) : isDown ? (
                    <TrendingDown size={13} className="text-brand-red" />
                  ) : (
                    <Minus size={13} className="text-slate-500" />
                  )
                ) : null}
              </div>
              <div className="font-mono text-sm font-medium text-white mb-1">
                {d ? `$${d.usd.toLocaleString()}` : "—"}
              </div>
              <div
                className={`text-xs font-mono ${
                  isUp ? "text-brand-green" : isDown ? "text-brand-red" : "text-slate-500"
                }`}
              >
                {chg !== undefined
                  ? `${isUp ? "+" : ""}${chg.toFixed(2)}%`
                  : "—"}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                {d?.myr ? `RM ${d.myr.toLocaleString()}` : ""}
              </div>
            </div>
          );
        })}
      </div>

      {/* Forex */}
      <h2 className="text-xs font-medium text-slate-500 uppercase tracking-widest mb-3">
        Forex — 1 USD =
      </h2>
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
        {FOREX.map((f) => (
          <div
            key={f}
            className="bg-bg-card border border-bg-border rounded-xl p-4 hover:border-slate-600 transition-colors"
          >
            <div className="text-xs text-slate-500 mb-2">USD/{f}</div>
            <div className="font-mono text-sm font-medium text-white">
              {forex[f] ? forex[f].toFixed(4) : "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
