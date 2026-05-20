"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { RefreshCw } from "lucide-react";

const COINS = [
  { id: "bitcoin", sym: "BTC" },
  { id: "ethereum", sym: "ETH" },
  { id: "solana", sym: "SOL" },
  { id: "binancecoin", sym: "BNB" },
  { id: "ripple", sym: "XRP" },
];
const DAYS = [7, 14, 30, 90];

function computeMA(arr, n) {
  return arr.map((v, i) => {
    if (i < n - 1) return null;
    const s = arr.slice(i - n + 1, i + 1);
    return +(s.reduce((a, b) => a + b, 0) / n).toFixed(4);
  });
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

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-bg-card border border-bg-border rounded-lg p-3 text-xs font-mono">
      <p className="text-slate-400 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.dataKey === "rsi" ? p.value?.toFixed(1) : `$${p.value?.toLocaleString()}`}
        </p>
      ))}
    </div>
  );
};

export default function TAChart({ refreshKey }) {
  const [coin, setCoin] = useState("bitcoin");
  const [days, setDays] = useState(30);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/chart?coin=${coin}&days=${days}`);
      if (!res.ok) throw new Error("rate_limit");
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const pts = data.prices;
      const step = Math.max(1, Math.floor(pts.length / 80));
      const sampled = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);
      const prices = sampled.map(([, p]) => +p.toFixed(2));
      const m7 = computeMA(prices, 7);
      const m25 = computeMA(prices, 25);
      const rsis = computeRSI(prices, 14);

      setChart(
        sampled.map(([ts], i) => ({
          d: new Date(ts).toLocaleDateString("en-GB", { month: "short", day: "numeric" }),
          price: prices[i],
          ma7: m7[i],
          ma25: m25[i],
          rsi: rsis[i],
        }))
      );
    } catch {
      setError("Rate limited or fetch failed. Wait ~30s and retry.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [refreshKey]);

  const latestRsi = chart.filter((x) => x.rsi !== null).slice(-1)[0]?.rsi;
  const rsiSignal =
    latestRsi >= 70
      ? { label: "Overbought", color: "#ff4d6a", hint: "Consider taking profit" }
      : latestRsi <= 30
      ? { label: "Oversold", color: "#00d4aa", hint: "Watch for long entry" }
      : { label: "Neutral", color: "#94a3b8", hint: "No extreme signal" };

  const gridColor = "rgba(255,255,255,0.05)";
  const tickStyle = { fontSize: 10, fill: "#64748b" };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <select
          value={coin}
          onChange={(e) => setCoin(e.target.value)}
          className="text-sm"
        >
          {COINS.map((c) => (
            <option key={c.id} value={c.id}>{c.sym}</option>
          ))}
        </select>

        <div className="flex gap-1.5">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                days === d
                  ? "bg-brand-green/10 border-brand-green/30 text-brand-green font-medium"
                  : "bg-bg-card border-bg-border text-slate-400 hover:text-slate-200"
              }`}
            >
              {d}D
            </button>
          ))}
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-bg-card border border-bg-border text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Fetch
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading && chart.length === 0 && (
        <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">Loading chart data...</span>
        </div>
      )}

      {!loading && chart.length > 0 && (
        <div>
          {/* Legend */}
          <div className="flex gap-4 mb-3 text-xs text-slate-500">
            {[
              { color: "#4d9fff", label: "Price" },
              { color: "#f5a623", label: "MA7", dash: true },
              { color: "#00d4aa", label: "MA25", dash: true },
            ].map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block w-4 h-px"
                  style={{
                    background: l.color,
                    borderTop: l.dash ? `1px dashed ${l.color}` : "none",
                    height: l.dash ? 0 : 1,
                  }}
                />
                {l.label}
              </span>
            ))}
          </div>

          {/* Price + MA */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-4 mb-4">
            <p className="text-xs text-slate-500 mb-3">Price + Moving Averages</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chart} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="d" tick={tickStyle} interval="preserveStartEnd" />
                <YAxis
                  tick={tickStyle}
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `$${(v >= 1000 ? (v / 1000).toFixed(0) + "k" : v)}`}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="price" stroke="#4d9fff" dot={false} strokeWidth={1.5} name="Price" />
                <Line type="monotone" dataKey="ma7" stroke="#f5a623" dot={false} strokeWidth={1} strokeDasharray="4 4" name="MA7" />
                <Line type="monotone" dataKey="ma25" stroke="#00d4aa" dot={false} strokeWidth={1} strokeDasharray="6 4" name="MA25" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* RSI */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-3">RSI (14)</p>
            <ResponsiveContainer width="100%" height={110}>
              <LineChart data={chart} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid stroke={gridColor} vertical={false} />
                <XAxis dataKey="d" tick={tickStyle} interval="preserveStartEnd" />
                <YAxis tick={tickStyle} domain={[0, 100]} ticks={[30, 50, 70]} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={70} stroke="#ff4d6a" strokeDasharray="3 3" />
                <ReferenceLine y={30} stroke="#00d4aa" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="rsi" stroke="#9b87f5" dot={false} strokeWidth={1.5} name="rsi" />
              </LineChart>
            </ResponsiveContainer>

            {latestRsi && (
              <div className="flex items-center gap-3 mt-3 text-xs font-mono">
                <span className="text-slate-500">RSI {latestRsi.toFixed(1)}</span>
                <span className="font-medium" style={{ color: rsiSignal.color }}>
                  {rsiSignal.label}
                </span>
                <span className="text-slate-600">— {rsiSignal.hint}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
