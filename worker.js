// FXWOLVER Cloudflare Worker API
// Serves the existing static terminal and proxies market data without exposing secrets.
// Crypto streaming remains the browser's public Binance WebSocket connection.

const YAHOO_HEADERS = {
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (compatible; FXWOLVER/1.0; +https://workers.cloudflare.com)"
};

const INTERVALS = {
  "1m": ["1m", "5d"],
  "5m": ["5m", "1mo"],
  "15m": ["15m", "1mo"],
  "1h": ["60m", "6mo"],
  "4h": ["60m", "1y"],
  "1d": ["1d", "2y"]
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...extra
    }
  });
}

async function yahooChart(symbol, interval, range) {
  const url = "https://query1.finance.yahoo.com/v8/finance/chart/" +
    encodeURIComponent(symbol) + "?interval=" + interval + "&range=" + range;
  try {
    let res = await fetch(url, {
      headers: YAHOO_HEADERS,
      cf: { cacheTtl: interval === "1m" ? 3 : 20, cacheEverything: true }
    });
    if (!res.ok) {
      const fallback = url.replace("query1.finance.yahoo.com", "query2.finance.yahoo.com");
      res = await fetch(fallback, {
        headers: YAHOO_HEADERS,
        cf: { cacheTtl: interval === "1m" ? 3 : 20, cacheEverything: true }
      });
    }
    if (!res.ok) return null;
    const payload = await res.json();
    const result = payload?.chart?.result?.[0];
    return result || null;
  } catch {
    return null;
  }
}

async function stooqQuote(symbol) {
  const code = symbol.endsWith("=X")
    ? symbol.slice(0, -2).toLowerCase()
    : /^[A-Z]+$/.test(symbol) ? symbol.toLowerCase() + ".us" : null;
  if (!code) return null;
  try {
    const res = await fetch(
      "https://stooq.com/q/l/?s=" + encodeURIComponent(code) + "&f=sd2t2cp&h&e=csv",
      { headers: { "User-Agent": YAHOO_HEADERS["User-Agent"] }, cf: { cacheTtl: 15 } }
    );
    if (!res.ok) return null;
    const rows = (await res.text()).trim().split(/\r?\n/);
    if (rows.length < 2) return null;
    const cols = rows[1].split(",");
    const price = Number(cols[3]);
    if (!Number.isFinite(price) || price <= 0) return null;
    // Stooq's "p" field is percentage change, not previous-close price.
    const changePct = Number(cols[4]);
    const previous = Number.isFinite(changePct) ? price / (1 + changePct / 100) : null;
    const stamp = Date.parse(cols[1] + "T" + cols[2] + "Z") / 1000;
    return {
      p: price,
      ...(Number.isFinite(previous) && previous > 0 ? { prev: previous } : {}),
      t: Number.isFinite(stamp) ? stamp : Math.floor(Date.now() / 1000),
      provider: "Stooq",
      freshness: "provider timestamp; latency not guaranteed"
    };
  } catch {
    return null;
  }
}

async function getQuote(symbol) {
  const chart = await yahooChart(symbol, "1m", "1d");
  const meta = chart?.meta;
  if (meta && Number.isFinite(meta.regularMarketPrice) && meta.regularMarketPrice > 0) {
    return {
      p: meta.regularMarketPrice,
      prev: meta.chartPreviousClose || meta.previousClose || null,
      t: meta.regularMarketTime || Math.floor(Date.now() / 1000),
      provider: "Yahoo Finance",
      freshness: "provider timestamp; real-time entitlement not verified"
    };
  }
  return await stooqQuote(symbol);
}

async function quotes(request) {
  const url = new URL(request.url);
  const symbols = [...new Set((url.searchParams.get("s") || "")
    .split(",").map(s => s.trim()).filter(Boolean))].slice(0, 40);
  if (!symbols.length) return json({ error: "Add symbols with ?s=EURUSD=X,AAPL" }, 400);
  const entries = await Promise.all(symbols.map(async symbol => [symbol, await getQuote(symbol)]));
  const result = {};
  for (const [symbol, value] of entries) if (value) result[symbol] = value;
  return json(result, 200, { "cache-control": "public, max-age=2, stale-while-revalidate=5" });
}

async function candles(request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("s") || "").trim();
  const requested = (url.searchParams.get("i") || "1h").toLowerCase();
  if (!symbol || symbol.length > 32) return json({ error: "A valid s symbol is required" }, 400);
  const [interval, range] = INTERVALS[requested] || INTERVALS["1h"];
  const chart = await yahooChart(symbol, interval, range);
  if (!chart?.timestamp?.length || !chart?.indicators?.quote?.[0]) {
    return json({ error: "Historical market data is currently unavailable", candles: [] }, 502);
  }
  const quote = chart.indicators.quote[0];
  let rows = [];
  chart.timestamp.forEach((rawTime, index) => {
    const time = Number(rawTime);
    const open = Number(quote.open?.[index]), high = Number(quote.high?.[index]);
    const low = Number(quote.low?.[index]), close = Number(quote.close?.[index]);
    const rawVolume = quote.volume?.[index];
    const volume = rawVolume == null ? 0 : Number(rawVolume);
    // Reject malformed OHLC rows. Never repair or synthesize a candle.
    if (![time, open, high, low, close, volume].every(Number.isFinite)) return;
    if (time <= 0 || open <= 0 || high <= 0 || low <= 0 || close <= 0 || volume < 0) return;
    if (high < Math.max(open, close, low) || low > Math.min(open, close, high)) return;
    rows.push({ time, open, high, low, close, volume });
  });
  rows.sort((a, b) => a.time - b.time);
  rows = rows.filter((c, i, all) => i === 0 || c.time !== all[i - 1].time);
  if (requested === "4h") {
    const buckets = new Map();
    for (const candle of rows) {
      const key = Math.floor(candle.time / 14400) * 14400;
      const existing = buckets.get(key);
      if (!existing) buckets.set(key, { ...candle, time: key });
      else {
        existing.high = Math.max(existing.high, candle.high);
        existing.low = Math.min(existing.low, candle.low);
        existing.close = candle.close;
        existing.volume += candle.volume;
      }
    }
    rows = [...buckets.values()];
  }
  return json(rows.slice(-500), 200, {
    "cache-control": "public, max-age=5, stale-while-revalidate=10",
    "x-market-data-provider": "Yahoo Finance",
    "x-market-data-freshness": "provider timestamp; real-time entitlement not verified"
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "FXWOLVER market-data API", timestamp: new Date().toISOString() });
    }
    if (url.pathname === "/api/quotes" && request.method === "GET") return quotes(request);
    if (url.pathname === "/api/candles" && request.method === "GET") return candles(request);
    if (url.pathname.startsWith("/api/")) return json({ error: "API route not found" }, 404);
    return env.ASSETS.fetch(request);
  }
};
