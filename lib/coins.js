// Single source of truth for every market list in the app.
// Consumed by Dashboard, TAChart, LiveChart and the /api/* allowlists so the
// lists can never drift apart again.

export const COINS = [
  { id: "bitcoin", sym: "BTC", name: "Bitcoin", binance: "BTCUSDT" },
  { id: "ethereum", sym: "ETH", name: "Ethereum", binance: "ETHUSDT" },
  { id: "solana", sym: "SOL", name: "Solana", binance: "SOLUSDT" },
  { id: "binancecoin", sym: "BNB", name: "BNB", binance: "BNBUSDT" },
  { id: "ripple", sym: "XRP", name: "XRP", binance: "XRPUSDT" },
  { id: "cardano", sym: "ADA", name: "Cardano", binance: "ADAUSDT" },
  { id: "polkadot", sym: "DOT", name: "Polkadot", binance: "DOTUSDT" },
  { id: "avalanche-2", sym: "AVAX", name: "Avalanche", binance: "AVAXUSDT" },
  { id: "chainlink", sym: "LINK", name: "Chainlink", binance: "LINKUSDT" },
  // CoinGecko retired the old `polygon` id — POL is the live token id.
  { id: "polygon-ecosystem-token", sym: "POL", name: "Polygon", binance: "POLUSDT" },
  { id: "litecoin", sym: "LTC", name: "Litecoin", binance: "LTCUSDT" },
  { id: "uniswap", sym: "UNI", name: "Uniswap", binance: "UNIUSDT" },
  { id: "stellar", sym: "XLM", name: "Stellar", binance: "XLMUSDT" },
  { id: "filecoin", sym: "FIL", name: "Filecoin", binance: "FILUSDT" },
  { id: "tron", sym: "TRX", name: "TRON", binance: "TRXUSDT" },
  { id: "monero", sym: "XMR", name: "Monero", binance: "XMRUSDT" },
];

export const COIN_IDS = COINS.map((c) => c.id).join(",");

// Allowlists used by the /api routes — always derived, never hand-written.
export const CHART_ALLOWED_COINS = COINS.map((c) => c.id);
export const CHART_ALLOWED_DAYS = ["1", "7", "14", "30", "90"];

export const TA_DAYS = [1, 7, 14, 30, 90];

// Binance symbols for the Live tab.
export const LIVE_PAIRS = COINS.map((c) => ({
  symbol: c.binance,
  label: `${c.sym}/USDT`,
}));

export const FOREX = [
  "MYR", "SGD", "EUR", "GBP", "JPY", "AUD", "CNY", "THB",
  "IDR", "KRW", "CAD", "CHF", "NZD", "HKD", "INR", "PHP",
];
