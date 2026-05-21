"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, X } from "lucide-react";

const STORAGE_KEY = "tradehub_journal";

function calcPnL(t) {
  return +((t.exit - t.entry) * t.size * (t.type === "Long" ? 1 : -1)).toFixed(2);
}

export default function BuySell() {
  const [trades, setTrades] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    date: "",
    pair: "",
    type: "Long",
    entry: "",
    exit: "",
    size: "",
    stopLoss: "",
    takeProfit: "",
    note: "",
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setTrades(saved ? JSON.parse(saved) : []);
    } catch {
      setTrades([]);
    }
  }, []);

  const save = (updated) => {
    setTrades(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const addTrade = () => {
    // Basic required validation
    if (!form.date || !form.pair || !form.entry || !form.exit || !form.size) return;
    const newTrade = {
      ...form,
      id: Date.now(),
      entry: +form.entry,
      exit: +form.exit,
      size: +form.size,
      // Convert optional numeric fields if supplied
      ...(form.stopLoss && { stopLoss: +form.stopLoss }),
      ...(form.takeProfit && { takeProfit: +form.takeProfit }),
    };
    save([...trades, newTrade]);
    setForm({
      date: "",
      pair: "",
      type: "Long",
      entry: "",
      exit: "",
      size: "",
      stopLoss: "",
      takeProfit: "",
      note: "",
    });
    setShowForm(false);
  };

  const del = (id) => {
    if (!window.confirm("Delete this trade?")) return;
    save(trades.filter((t) => t.id !== id));
  };

  const totalPnL = trades.reduce((s, t) => s + calcPnL(t), 0);
  const wins = trades.filter((t) => calcPnL(t) > 0).length;
  const wr = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  const best = trades.length ? Math.max(...trades.map(calcPnL)) : 0;
  const worst = trades.length ? Math.min(...trades.map(calcPnL)) : 0;

  const pnlColor = (v) => (v > 0 ? "text-brand-green" : v < 0 ? "text-brand-red" : "text-slate-300");

  const exportCSV = () => {
    const header = [
      "Date",
      "Pair",
      "Type",
      "Entry",
      "Exit",
      "Size",
      "StopLoss",
      "TakeProfit",
      "PnL",
      "Note",
    ];
    const rows = trades.map((t) => [
      t.date,
      t.pair,
      t.type,
      t.entry,
      t.exit,
      t.size,
      t.stopLoss ?? "",
      t.takeProfit ?? "",
      calcPnL(t),
      t.note?.replace(/"/g, '""') ?? "",
    ]);
    const csvContent = [header, ...rows]
      .map((r) => r.map((v) => `"${v}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "tradehub_trades.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total P&L", value: `${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`, color: pnlColor(totalPnL) },
          { label: "Win Rate", value: `${wr}%`, color: wr >= 50 ? "text-brand-green" : "text-brand-red" },
          { label: "Best Trade", value: `+$${best.toFixed(2)}`, color: "text-brand-green" },
          { label: "Worst Trade", value: `$${worst.toFixed(2)}`, color: "text-brand-red" },
        ].map((m) => (
          <div key={m.label} className="bg-bg-card border border-bg-border rounded-xl p-4 text-center">
            <p className="text-xs text-slate-300 mb-1">{m.label}</p>
            <p className={`font-mono text-lg font-medium ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Export button */}
      {trades.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={exportCSV}
            className="px-3 py-1.5 rounded-lg text-xs bg-bg-card border border-bg-border text-slate-400 hover:text-white transition-colors"
          >
            Export CSV
          </button>
        </div>
      )}

      {/* Add Trade */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-slate-300 uppercase tracking-widest font-medium">
          Trade History ({trades.length})
        </p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-brand-green/10 border border-brand-green/30 text-brand-green hover:bg-brand-green/20 transition-colors font-medium"
        >
          {showForm ? <X size={13} /> : <Plus size={13} />}
          {showForm ? "Cancel" : "Add Trade"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-bg-card border border-bg-border rounded-xl p-5 mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Date", type: "date", key: "date", placeholder: "" },
              { label: "Pair", type: "text", key: "pair", placeholder: "BTC/USDT" },
              { label: "Entry ($)", type: "number", key: "entry", placeholder: "0" },
              { label: "Exit ($)", type: "number", key: "exit", placeholder: "0" },
              { label: "Size", type: "number", key: "size", placeholder: "0" },
              { label: "Stop Loss ($)", type: "number", key: "stopLoss", placeholder: "optional" },
              { label: "Take Profit ($)", type: "number", key: "takeProfit", placeholder: "optional" },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-slate-300 mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full text-sm"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs text-slate-300 mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
                className="w-full text-sm"
              >
                <option>Long</option>
                <option>Short</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-slate-300 mb-1.5">Note (optional)</label>
            <input
              type="text"
              placeholder="e.g. breakout play, followed plan..."
              value={form.note}
              onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
              className="w-full text-sm"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={addTrade}
              className="px-4 py-2 rounded-lg text-sm bg-brand-green/10 border border-brand-green/30 text-brand-green hover:bg-brand-green/20 transition-colors font-medium"
            >
              Save Trade
            </button>
          </div>

          {/* Disclaimer */}
          <p className="mt-2 text-xs text-slate-300 italic">
            ⚠️ AI analysis only – not a trade recommendation. Conduct your own research.
          </p>
        </div>
      )}

      {/* Trades List */}
      {trades.length === 0 ? (
        <div className="text-center py-12 text-slate-300 text-sm">
          No trades yet. Log your first trade above.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...trades].reverse().map((t) => {
            const p = calcPnL(t);
            return (
              <div
                key={t.id}
                className="bg-bg-card border border-bg-border rounded-xl px-4 py-3 flex items-center justify-between hover:border-slate-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      t.type === "Long"
                        ? "bg-brand-green/10 text-brand-green"
                        : "bg-brand-red/10 text-brand-red"
                    }`}
                  >
                    {t.type === "Long" ? (
                      <TrendingUp size={11} className="inline mr-1" />
                    ) : (
                      <TrendingDown size={11} className="inline mr-1" />
                    )}
                    {t.type}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{t.pair}</p>
                    <p className="text-xs text-slate-300">
                      {t.date} · ${t.entry.toLocaleString()} → ${t.exit.toLocaleString()} · ×{t.size}
                      {t.stopLoss !== undefined && t.stopLoss !== null && t.stopLoss !== "" && (
                        <span className="text-slate-300"> · SL ${t.stopLoss}</span>
                      )}
                      {t.takeProfit !== undefined && t.takeProfit !== null && t.takeProfit !== "" && (
                        <span className="text-slate-300"> · TP ${t.takeProfit}</span>
                      )}
                      {t.note && <span className="text-slate-300"> · {t.note}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-sm font-medium ${pnlColor(p)}`}>
                    {p >= 0 ? "+" : ""}${p.toFixed(2)}
                  </span>
                  <button
                    onClick={() => del(t.id)}
                    className="text-slate-300 hover:text-brand-red transition-colors p-1 rounded"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
