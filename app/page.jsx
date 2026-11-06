"use client";

import { useState, useEffect } from "react";
import Dashboard from "@/components/Dashboard";
import TAChart from "@/components/TAChart";
import BuySell from "@/components/Journal";
import LiveChart from "@/components/LiveChart";
import Guide from "@/components/Guide";
import { loadSignals, subscribeSignals, pruneStale } from "@/lib/signalStore";
import {
  LayoutDashboard,
  LineChart,
  BookOpen,
  Zap,
  RefreshCw,
  Bell,
  Lightbulb,
} from "lucide-react";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "live", label: "Live", icon: Zap },
  { key: "ta", label: "TA Chart", icon: LineChart },
  { key: "buysell", label: "Buy/Sell", icon: BookOpen },
  { key: "guide", label: "Guide", icon: Lightbulb },
];

export default function Home() {
  const [tab, setTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [signals, setSignals] = useState([]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // The signal log lives in localStorage (written by LiveChart) and is the
  // single source of truth — subscribing keeps the badge, Dashboard stats and
  // Live tab in sync, and survives a page refresh.
  useEffect(() => {
    pruneStale();
    setSignals(loadSignals());
    return subscribeSignals(setSignals);
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-slate-200">
      {/* Topbar */}
      <header className="border-b border-bg-border bg-bg-surface px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center">
            <span className="text-brand-green font-mono font-semibold text-sm">T</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-white leading-none">TradeHub</h1>
            <p className="text-xs text-slate-300 mt-0.5">Crypto · Forex · TA · Buy/Sell · Live · Signals</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Signal log badge */}
          {signals.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-amber/10 border border-brand-amber/30">
              <Bell size={12} className="text-brand-amber" />
              <span className="text-xs text-brand-amber font-medium">
                {signals.length} Signal{signals.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white bg-bg-card border border-bg-border px-3 py-1.5 rounded-lg transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          {lastUpdated && (
            <span className="text-xs text-slate-300 ml-2">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {/* Tab Nav */}
      <nav className="border-b border-bg-border bg-bg-surface px-6 flex gap-0 overflow-x-auto" aria-label="Sections">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap ${
              tab === key
                ? "border-brand-green text-brand-green font-medium"
                : "border-transparent text-slate-300 hover:text-slate-300"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="px-6 py-6 max-w-5xl mx-auto">
        {tab === "dashboard" && (
          <Dashboard refreshKey={refreshKey} onLastUpdated={setLastUpdated} signals={signals} />
        )}
        {tab === "live" && <LiveChart />}
        {tab === "ta" && <TAChart refreshKey={refreshKey} />}
        {tab === "buysell" && <BuySell />}
        {tab === "guide" && <Guide />}
      </main>
    </div>
  );
}
