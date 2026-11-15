// Application-wide configuration
// All environment variable reads happen here — never scattered around the codebase.

// Backend REST API base URL
// In development with Vite proxy: empty string uses relative URLs
// In production: set VITE_API_URL in .env
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ?? '';

// WebSocket URL — connects to Vite dev proxy which forwards to FastAPI
export const WS_URL: string =
  import.meta.env.VITE_WS_URL ??
  `ws://${window.location.host}/ws/market`;

// ─── Default symbol lists ─────────────────────────────────────────────────

export const CRYPTO_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
] as const;

export const FOREX_SYMBOLS = [
  'XAUUSD', 'EURUSD', 'GBPUSD', 'USDJPY',
  'AUDUSD', 'NZDUSD', 'USDCAD', 'USDCHF',
  'EURJPY', 'GBPJPY',
] as const;

export const STOCK_SYMBOLS = [
  'AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META',
] as const;

// ─── Timeframes ───────────────────────────────────────────────────────────

export const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];
