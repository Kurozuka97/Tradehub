"use client";

import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
// ThemeToggle import removed
import Dashboard from "@/components/Dashboard";
import TAChart from "@/components/TAChart";
// ThemeToggle import removed
import BuySell from "@/components/Journal";
import Guide from "@/components/Guide";
import {
  LayoutDashboard,
  LineChart,
  BookOpen,
  GraduationCap,
  RefreshCw,
} from "lucide-react";

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "ta", label: "TA Chart", icon: LineChart },
  { key: "buysell", label: "Buy/Sell", icon: BookOpen },
  { key: "guide", label: "Guide", icon: GraduationCap },
];

export default function Home() {
  const [tab, setTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  return (
    <div className="min-h-screen bg-white dark:bg-bg-base text-slate-800 dark:text-slate-200">
      {/* Topbar */}
      <header className="border-b border-bg-border bg-white dark:bg-bg-surface px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-green/10 flex items-center justify-center">
            <span className="text-brand-green font-mono font-semibold text-sm">T</span>
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-800 dark:text-white leading-none">TradeHub</h1>
            <p className="text-xs text-slate-500 dark:text-slate-300 mt-0.5">Crypto · Forex · TA · Buy/Sell</p>
          </div>
</div>
<div className="flex items-center gap-2">
  <ThemeToggle />
  <button
    onClick={handleRefresh}
    className="flex items-center gap-2 text-xs text-slate-400 hover:text-white bg-white dark:bg-bg-card border border-bg-border px-3 py-1.5 rounded-lg transition-colors"
  >
    <RefreshCw size={13} />
    Refresh
  </button>
</div>
      </header>

      {/* Tab Nav */}
      <nav className="border-b border-bg-border bg-white dark:bg-bg-surface px-6 flex gap-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm border-b-2 transition-colors ${
              tab === key
                ? "border-brand-green text-brand-green font-medium"
                : "border-transparent text-slate-500 hover:text-slate-300 dark:text-slate-300"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="px-6 py-6 max-w-5xl mx-auto">
        {tab === "dashboard" && <Dashboard refreshKey={refreshKey} />}
        {tab === "ta" && <TAChart refreshKey={refreshKey} />}
        {tab === "buysell" && <BuySell />}
        {tab === "guide" && <Guide />}
      </main>
    </div>
  );
}
