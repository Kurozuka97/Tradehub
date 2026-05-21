export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin");
  if (!coin) {
    return Response.json({ error: "missing_coin" }, { status: 400 });
  }
  const URL = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=7`;
  try {
    const res = await fetch(URL, {
      next: { revalidate: 300 }, // cache for 5 min
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return Response.json({ error: "upstream_error" }, { status: res.status });
    }
    const data = await res.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch {
    return Response.json({ error: "fetch_failed" }, { status: 500 });
  }
}
