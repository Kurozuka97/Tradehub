const COIN_IDS = "bitcoin,ethereum,solana,binancecoin,ripple,cardano,polkadot,avalanche-2";
const URL = `https://api.coingecko.com/api/v3/simple/price?ids=${COIN_IDS}&vs_currencies=usd,myr&include_24hr_change=true&include_market_cap=true`;

export async function GET() {
  try {
    const res = await fetch(URL, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return Response.json({ error: "upstream_error" }, { status: res.status });
    }

    const data = await res.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch {
    return Response.json({ error: "fetch_failed" }, { status: 500 });
  }
}
