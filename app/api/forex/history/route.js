export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get('symbols');
  const symbols = symbolsParam ? symbolsParam.split(',') : ['MYR','SGD','EUR','GBP','JPY','AUD','CNY','THB','IDR','KRW','CAD','CHF','NZD','HKD','INR','PHP'];

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const format = (d) => d.toISOString().split('T')[0];
  const startDate = format(start);
  const endDate = format(end);

  const url = `https://api.exchangerate.host/timeseries?start_date=${startDate}&end_date=${endDate}&base=USD&symbols=${symbols.join(',')}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return Response.json({ error: 'upstream_error' }, { status: res.status });
    }
    const data = await res.json();
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
    return Response.json({ history }, {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    });
  } catch {
    return Response.json({ error: 'fetch_failed' }, { status: 500 });
  }
}
