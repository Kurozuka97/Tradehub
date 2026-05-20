"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, X } from "lucide-react";

const STORAGE_KEY = "tradehub_journal";

const INIT = [
  { id: 1, date: "2025-05-10", pair: "BTC/USDT", type: "Long", entry: 61500, exit: 65000, size: 0.1, note: "" },
  { id: 2, date: "2025-05-12", pair: "ETH/USDT", type: "Long", entry: 3200, exit: 3450, size: 0.5, note: "" },
  { id: 3, date: "2025-05-15", pair: "SOL/USDT", type: "Short", entry: 175, exit: 160, size: 2, note: "Clean breakdown" },
];

function calcPnL(t) {
  return +((t.exit - t.entry) * t.size * (t.type === "Long" ? 1 : -1)).toFixed(2);
}

export default function Journal() {
  const [trades, setTrades] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", pair: "", type: "Long", entry: "", exit: "", size: "", note: "" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      setTrades(saved ? JSON.parse(saved) : INIT);
    } catch {
      setTrades(INIT);
    }
  }, []);

  const save = (updated) => {
    setTrades(updated);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
  };

  const addTrade = () => {
    if (!form.date || !form.pair || !form.entry || !form.exit || !form.size) return;
    save([...trades, { ...form, id: Date.now(), entry: +form.entry, exit: +form.exit, size: +form.size }]);
    setForm({ date: "", pair: "", type: "Long", entry: "", exit: "", size: "", note: "" });
    setShowForm(false);
  };

  const del = (id) => save(trades.filter((t) => t.id !== id));

  const totalPnL = trades.reduce((s, t) => s + calcPnL(t), 0);
  const wins = trades.filter((t) => calcPnL(t) > 0).length;
  const wr = trades.length ? Math.round((wins / trades.length) * 100) : 0;
  const best = trades.length ? Math.max(...trades.map(calcPnL)) : 0;
  const worst = trades.length ? Math.min(...trades.map(calcPnL)) : 0;

  const pnlColor = (v) => (v > 0 ? "text-brand-green" : v < 0 ? "text-brand-red" : "text-slate-500");

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
            <p className="text-xs text-slate-500 mb-1">{m.label}</p>
            <p className={`font-mono text-lg font-medium ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Add Trade */}
      <div className="flex justify-between items-center mb-4">
        <p className="text-xs text-slate-500 uppercase tracking-widest font-medium">
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
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-xs text-slate-500 mb-1.5">{f.label}</label>
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
              <label className="block text-xs text-slate-500 mb-1.5">Type</label>
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
            <label className="block text-xs text-slate-500 mb-1.5">Note (optional)</label>
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
        </div>
      )}

      {/* Trades List */}
      {trades.length === 0 ? (
        <div className="text-center py-12 text-slate-600 text-sm">
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
                    <p className="text-xs text-slate-500">
                      {t.date} · ${t.entry.toLocaleString()} → ${t.exit.toLocaleString()} · ×{t.size}
                      {t.note && <span className="text-slate-600"> · {t.note}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-sm font-medium ${pnlColor(p)}`}>
                    {p >= 0 ? "+" : ""}${p.toFixed(2)}
                  </span>
                  <button
                    onClick={() => del(t.id)}
                    className="text-slate-600 hover:text-brand-red transition-colors p-1 rounded"
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
