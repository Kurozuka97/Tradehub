import {
  TrendingUp,
  Activity,
  Shield,
  Calculator,
  Clock,
  Brain,
  AlertTriangle,
  DollarSign,
} from "lucide-react";

const CARDS = [
  {
    icon: TrendingUp,
    color: "text-brand-green",
    bg: "bg-brand-green/10",
    title: "Trend Analysis",
    body: "Trade with the trend, not against it. MA7 crossing above MA25 = bullish signal. MA7 crossing below MA25 = bearish. Always confirm on multiple timeframes for higher accuracy.",
  },
  {
    icon: Activity,
    color: "text-brand-purple",
    bg: "bg-brand-purple/10",
    title: "RSI Signals",
    body: "RSI > 70: Overbought — consider taking profit or shorting. RSI < 30: Oversold — watch for long entry. RSI divergence from price often precedes reversals before they happen.",
  },
  {
    icon: Shield,
    color: "text-brand-blue",
    bg: "bg-brand-blue/10",
    title: "Risk Management",
    body: "Max 1–2% capital per trade. Always set stop-loss before entering. Target a minimum R:R of 1:2 — your potential gain should be at least double your potential loss.",
  },
  {
    icon: Calculator,
    color: "text-brand-amber",
    bg: "bg-brand-amber/10",
    title: "Position Sizing",
    body: "Size = (Capital × Risk%) ÷ (Entry − Stop Loss). Example: RM10,000 capital, 1% risk, 50-point stop = RM200 ÷ 50 = 4 lots. Consistent sizing beats random bets.",
  },
  {
    icon: Clock,
    color: "text-brand-green",
    bg: "bg-brand-green/10",
    title: "Trading Sessions",
    body: "Forex peak: London-NY overlap (3PM–7PM UTC / 11PM–3AM MYT). Crypto is 24/7 but most volatile during US market hours. Avoid low-liquidity Asian late hours for forex.",
  },
  {
    icon: Brain,
    color: "text-brand-purple",
    bg: "bg-brand-purple/10",
    title: "Psychology",
    body: "No FOMO. No revenge trading after a loss. Journal every single trade — patterns in your emotions are as important as patterns in price. Discipline beats talent consistently.",
  },
  {
    icon: AlertTriangle,
    color: "text-brand-red",
    bg: "bg-brand-red/10",
    title: "Common Mistakes",
    body: "Overtrading. Moving stop-loss to avoid being stopped out. Averaging down on losing positions. Trading without a plan. Taking profits too early and letting losses run.",
  },
  {
    icon: DollarSign,
    color: "text-brand-amber",
    bg: "bg-brand-amber/10",
    title: "Crypto Specifics",
    body: "Watch BTC dominance — when BTC pumps, alts often bleed. High funding rates = crowded longs = possible long squeeze. On-chain data (whale movements, exchange flows) gives edge.",
  },
];

export default function Guide() {
  return (
    <div>
      <p className="text-xs text-slate-300 uppercase tracking-widest font-medium mb-5">
        Trading Fundamentals
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <div
            key={c.title}
            className="bg-bg-card border border-bg-border rounded-xl p-5 flex gap-4 hover:border-slate-600 transition-colors"
          >
            <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
              <c.icon size={18} className={c.color} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white mb-1.5">{c.title}</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
