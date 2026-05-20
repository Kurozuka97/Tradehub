export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const days = searchParams.get("days") || "30";

  const allowed = ["bitcoin","ethereum","solana","binancecoin","ripple","cardano","polkadot","avalanche-2"];
  if (!allowed.includes(coin)) {
    return Response.json({ error: "invalid_coin" }, { status: 400 });
  }

  const validDays = ["7","14","30","90"];
  if (!validDays.includes(days)) {
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
