import { COIN_IDS } from "@/lib/coins";

// CoinGecko's `simple/price` no longer honours include_sparkline on the free
// tier (it silently returns no sparkline key at all), but `coins/markets`
// still serves them — so we build the response from two markets calls (one
// per currency) and reshape it to the exact shape the Dashboard already reads.
//
// If either call fails (the free tier rate-limits hard), we fall back to
// `simple/price` so the dashboard still shows live prices — just without
// sparklines — instead of blanking out.

const HEADERS = { Accept: "application/json" };

async function fetchMarkets(vs) {
  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs}` +
    `&ids=${COIN_IDS}&sparkline=true&price_change_percentage=24h`;

  const res = await fetch(url, { next: { revalidate: 60 }, headers: HEADERS });
  if (!res.ok) throw new Error(`upstream_${res.status}`);

  const data = await res.json();
  if (!Array.isArray(data) || !data.length) throw new Error("upstream_error");
  return data;
}

async function fetchFallback() {
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS}` +
    `&vs_currencies=usd,myr&include_24hr_change=true&include_market_cap=true`;

  const res = await fetch(url, { next: { revalidate: 60 }, headers: HEADERS });
  if (!res.ok) throw new Error(`upstream_${res.status}`);

  const data = await res.json();
  if (!data || data.error) throw new Error("upstream_error");
  return data;
}

const CACHE = { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" };

export async function GET() {
  try {
    const [usd, myr] = await Promise.all([fetchMarkets("usd"), fetchMarkets("myr")]);

    const myrById = new Map(myr.map((c) => [c.id, c]));
    const out = {};

    for (const c of usd) {
      const m = myrById.get(c.id);
      out[c.id] = {
        usd: c.current_price,
        usd_market_cap: c.market_cap ?? null,
        usd_24h_change: c.price_change_percentage_24h ?? null,
        myr: m?.current_price ?? null,
        myr_market_cap: m?.market_cap ?? null,
        myr_24h_change: m?.price_change_percentage_24h ?? null,
        ...(c.sparkline_in_7d?.price
          ? { sparkline_in_7d: { price: c.sparkline_in_7d.price } }
          : {}),
      };
    }

    if (!Object.keys(out).length) throw new Error("empty_payload");
    return Response.json(out, { headers: CACHE });
  } catch {
    try {
      const data = await fetchFallback();
      return Response.json(data, { headers: CACHE });
    } catch {
      return Response.json({ error: "fetch_failed" }, { status: 500 });
    }
  }
}
