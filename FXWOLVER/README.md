# FXWOLVER Trading Terminal

Professional dark trading terminal. Forex 60% · Crypto 30% · US Stocks 10%.

## Run it (Windows, easiest)
1. Install Node.js LTS from https://nodejs.org (one time).
2. Extract this zip.
3. Double-click `open_fxwolver.bat`. Your browser opens http://localhost:3000.

## Data honesty
- Only real prices are shown. A symbol is **LIVE** (green), **MARKET CLOSED** (last real price) or **OFFLINE** (no feed).
- Crypto becomes LIVE from the free Binance public API when your network can reach it
  (no API key; Binance.com is not available in some countries, e.g. the USA).
- Forex, gold and US stocks come from Yahoo Finance (Stooq fallback) through server.js. Click the status bar for a data check.
- Trading is paper only (virtual $10,000). No real money, no broker.

## Phases
1. Dashboard, responsive layout, Market Watch, charts  <- done (this version)
2. Real data: Crypto (Binance), Forex (OANDA practice, Dukascopy history), Stocks (Twelve Data / Alpaca)
3. Indicators, drawing tools, alerts
4. Paper trading with Stop Loss / Take Profit
5. Database, history, statistics, backtesting
6. Mobile polish, security, broker demo integration
7. Advanced features, production

`public/` is the working terminal. `frontend/` (React + Vite) and `backend/` (FastAPI) are the
planned production stack and are not used by `open_fxwolver.bat`.

## v0.4 (Phase 1.1)
- Real data: Binance (crypto) + Yahoo Finance via `server.js` (forex, gold, US stocks). Needs Node 18+ and internet. If a source is unreachable that symbol shows OFFLINE.
- Weekend / after-hours: badge shows MARKET CLOSED with the last real price and its time.
- Confirmation dialog for BUY / SELL / Exit: ask every time, ask only once, or off. Stop Loss / Take Profit, Close all, EMA 20/50, entry lines on chart, startup animation.

## v0.5
- Only real data is shown; if a feed is down the symbol shows OFFLINE and retries. Yahoo Finance with Stooq fallback.
- Phone: big BUY/SELL order bar under the chart. Chart: Candles/Line/Area, EMA, Bollinger, price alerts (with sound), history stats.

## Online (phone, anywhere)
Put this folder on GitHub, import it in vercel.com (free). `api/` + `lib.js` give the live data; `public/` is the site.
