import { CHART_ALLOWED_COINS, CHART_ALLOWED_DAYS } from "@/lib/coins";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const days = searchParams.get("days") || "30";

  if (!CHART_ALLOWED_COINS.includes(coin)) {
    return Response.json({ error: "invalid_coin" }, { status: 400 });
  }

  if (!CHART_ALLOWED_DAYS.includes(days)) {
    return Response.json({ error: "invalid_days" }, { status: 400 });
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=usd&days=${days}`;
    const res = await fetch(url, {
      next: { revalidate: 300 },
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
