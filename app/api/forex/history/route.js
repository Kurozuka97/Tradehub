import { FOREX } from "@/lib/coins";

// Frankfurter serves ECB reference rates — free, no key, and it has a native
// time-series endpoint. (The old exchangerate.host source now requires an
// access_key and silently returns {success:false}, which made every forex
// change % render as 0.00.)
const BASE_URL = "https://api.frankfurter.app";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");

  // Validate before the values touch a URL — keeps the upstream query clean.
  const symbols = symbolsParam
    ? symbolsParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => FOREX.includes(s))
    : FOREX;

  if (!symbols.length) {
    return Response.json({ error: "invalid_symbols" }, { status: 400 });
  }

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const format = (d) => d.toISOString().split("T")[0];

  const url = `${BASE_URL}/${format(start)}..${format(end)}?from=USD&to=${symbols.join(",")}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return Response.json({ error: "upstream_error" }, { status: res.status });
    }

    const data = await res.json();
    if (!data || data.error) {
      return Response.json({ error: "upstream_error" }, { status: 502 });
    }

    const history = {};
    symbols.forEach((sym) => (history[sym] = []));
    for (const [date, rates] of Object.entries(data.rates || {})) {
      symbols.forEach((sym) => {
        if (rates[sym] !== undefined) {
          history[sym].push({ date, rate: rates[sym] });
        }
      });
    }
    symbols.forEach((sym) => {
      history[sym].sort((a, b) => a.date.localeCompare(b.date));
    });

    return Response.json(
      { history },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } }
    );
  } catch {
    return Response.json({ error: "fetch_failed" }, { status: 500 });
  }
}
