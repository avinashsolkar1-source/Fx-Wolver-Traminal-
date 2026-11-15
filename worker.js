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

// Optional licensed institutional-quality spot FX feed (Tiingo).
// Configure TIINGO_API_TOKEN as a Cloudflare Worker secret to enable it.
// Tiingo documents top-of-book bid/ask and historical intraday OHLC bars.
function tiingoFxTicker(symbol) {
  const match = String(symbol).toUpperCase().match(/^([A-Z]{3})([A-Z]{3})=X$/);
  return match ? (match[1] + match[2]).toLowerCase() : null;
}
async function tiingoFxQuote(symbol, env) {
  const ticker = tiingoFxTicker(symbol);
  if (!ticker || !env?.TIINGO_API_TOKEN) return null;
  try {
    const res = await fetch("https://api.tiingo.com/tiingo/fx/" + ticker + "/top", {
      headers: { "Authorization": "Token " + env.TIINGO_API_TOKEN, "Accept": "application/json" },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!res.ok) return null;
    const payload = await res.json();
    const q = Array.isArray(payload) ? payload[0] : payload;
    if (!q) return null;
    const bid = Number(q.bidPrice), ask = Number(q.askPrice);
    const mid = Number(q.midPrice);
    const last = Number(q.lastPrice);
    const price = Number.isFinite(mid) && mid > 0 ? mid :
      Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask >= bid ? (bid + ask) / 2 :
      Number.isFinite(last) && last > 0 ? last : null;
    if (!price) return null;
    const stamp = Date.parse(q.quoteTimestamp || q.timestamp || "");
    return {
      p: price,
      ...(Number.isFinite(bid) && bid > 0 ? { bid } : {}),
      ...(Number.isFinite(ask) && ask >= bid ? { ask } : {}),
      t: Number.isFinite(stamp) ? Math.floor(stamp / 1000) : null,
      provider: "Tiingo FX",
      freshness: "licensed FX top-of-book feed"
    };
  } catch { return null; }
}
async function tiingoFxCandles(symbol, requested, env) {
  const ticker = tiingoFxTicker(symbol);
  if (!ticker || !env?.TIINGO_API_TOKEN) return null;
  const intervals = { "1m": "1min", "5m": "5min", "15m": "15min", "30m": "30min", "1h": "1hour", "1d": "1day" };
  const resample = intervals[requested] || (requested === "4h" ? "1hour" : null);
  if (!resample) return null;
  try {
    const url = "https://api.tiingo.com/tiingo/fx/" + ticker + "/prices?resampleFreq=" +
      encodeURIComponent(resample);
    const res = await fetch(url, { headers: { "Authorization": "Token " + env.TIINGO_API_TOKEN, "Accept": "application/json" }, cf: { cacheTtl: 0, cacheEverything: false } });
    if (!res.ok) return null;
    const payload = await res.json();
    if (!Array.isArray(payload)) return null;
    let rows = payload.map(q => ({
      time: Math.floor(Date.parse(q.date) / 1000),
      open: Number(q.open), high: Number(q.high), low: Number(q.low), close: Number(q.close),
      volume: q.volume == null ? 0 : Number(q.volume)
    })).filter(c => Number.isFinite(c.time) && c.time > 0 &&
      [c.open,c.high,c.low,c.close,c.volume].every(Number.isFinite) &&
      c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0 && c.volume >= 0 &&
      c.high >= Math.max(c.open,c.close,c.low) && c.low <= Math.min(c.open,c.close,c.high))
      .sort((a,b) => a.time-b.time);
    if (requested === "4h") {
      const buckets = new Map();
      for (const candle of rows) {
        const key = Math.floor(candle.time / 14400) * 14400;
        const prior = buckets.get(key);
        if (!prior) buckets.set(key, { ...candle, time: key });
        else { prior.high=Math.max(prior.high,candle.high); prior.low=Math.min(prior.low,candle.low); prior.close=candle.close; prior.volume+=candle.volume; }
      }
      rows = [...buckets.values()];
    }
    return rows.slice(-500);
  } catch { return null; }
}

async function tiingoFxCheck(symbol, env) {
  const ticker = tiingoFxTicker(symbol);
  if (!ticker) return { ok: false, reason: "unsupported_symbol" };
  if (!env?.TIINGO_API_TOKEN) return { ok: false, reason: "missing_worker_secret" };
  try {
    const res = await fetch("https://api.tiingo.com/tiingo/fx/" + ticker + "/top", {
      headers: { "Authorization": "Token " + env.TIINGO_API_TOKEN, "Accept": "application/json" },
      cf: { cacheTtl: 0, cacheEverything: false }
    });
    if (!res.ok) {
      const reasons = { 401: "invalid_or_missing_token", 403: "account_or_endpoint_not_authorized", 429: "rate_limit_or_usage_limit" };
      return { ok: false, httpStatus: res.status, reason: reasons[res.status] || "tiingo_http_error" };
    }
    const payload = await res.json();
    const q = Array.isArray(payload) ? payload[0] : payload;
    if (!q) return { ok: false, httpStatus: 200, reason: "empty_tiingo_response" };
    const bid = Number(q.bidPrice), ask = Number(q.askPrice), mid = Number(q.midPrice);
    const price = Number.isFinite(mid) && mid > 0 ? mid :
      Number.isFinite(bid) && bid > 0 && Number.isFinite(ask) && ask >= bid ? (bid + ask) / 2 : null;
    return {
      ok: price !== null,
      httpStatus: 200,
      ticker,
      fields: Object.keys(q),
      ...(price !== null ? { midPrice: Number.isFinite(mid) ? mid : price } : {}),
      quoteTimestamp: q.quoteTimestamp || null,
      reason: price === null ? "quote_fields_missing_or_invalid" : "connected"
    };
  } catch {
    return { ok: false, reason: "network_or_response_error" };
  }
}

async function getQuote(symbol, env) {
  const institutionalFx = await tiingoFxQuote(symbol, env);
  if (institutionalFx) return institutionalFx;
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

async function quotes(request, env) {
  const url = new URL(request.url);
  const symbols = [...new Set((url.searchParams.get("s") || "")
    .split(",").map(s => s.trim()).filter(Boolean))].slice(0, 40);
  if (!symbols.length) return json({ error: "Add symbols with ?s=EURUSD=X,AAPL" }, 400);
  const entries = await Promise.all(symbols.map(async symbol => [symbol, await getQuote(symbol, env)]));
  const result = {};
  for (const [symbol, value] of entries) if (value) result[symbol] = value;
  return json(result, 200, { "cache-control": "public, max-age=2, stale-while-revalidate=5" });
}

async function candles(request, env) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("s") || "").trim();
  const requested = (url.searchParams.get("i") || "1h").toLowerCase();
  if (!symbol || symbol.length > 32) return json({ error: "A valid s symbol is required" }, 400);
  const institutionalFxCandles = await tiingoFxCandles(symbol, requested, env);
  if (institutionalFxCandles) return json(institutionalFxCandles, 200, {
    "cache-control": "public, max-age=2, stale-while-revalidate=5",
    "x-market-data-provider": "Tiingo FX",
    "x-market-data-freshness": "licensed FX historical OHLC"
  });
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
    if (url.pathname === "/api/tiingo-check" && request.method === "GET") {
      const symbol = url.searchParams.get("s") || "EURUSD=X";
      return json(await tiingoFxCheck(symbol, env));
    }
    if (url.pathname === "/api/health") {
      return json({ ok: true, service: "FXWOLVER market-data API", timestamp: new Date().toISOString() });
    }
    if (url.pathname === "/api/quotes" && request.method === "GET") return quotes(request, env);
    if (url.pathname === "/api/candles" && request.method === "GET") return candles(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "API route not found" }, 404);
    return env.ASSETS.fetch(request);
  }
};
