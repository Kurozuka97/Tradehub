import { FOREX } from "@/lib/coins";

const URL = `https://api.frankfurter.app/latest?from=USD&to=${FOREX.join(",")}`;

export async function GET() {
  try {
    const res = await fetch(URL, {
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
