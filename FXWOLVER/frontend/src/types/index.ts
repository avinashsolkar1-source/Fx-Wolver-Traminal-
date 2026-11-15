// Shared TypeScript type definitions for FXWOLVER

export interface Quote {
  symbol: string;
  provider: string;        // "BINANCE" | "SIMULATED" | "OANDA" etc.
  timestamp: string;       // ISO 8601 UTC
  bid: number;
  ask: number;
  last: number;
  change_pct: number;
  spread: number;
  data_status: 'live' | 'simulated' | 'demo';
  is_simulated: boolean;
  warning?: string;        // Present only on simulated quotes
  market_status?: string;
}

export interface Candle {
  time: number;    // POSIX seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  is_simulated?: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  volume: number;
  open_price: number;
  current_price: number;
  stop_loss?: number | null;
  take_profit?: number | null;
  open_time: string;
  unrealized_pnl: number;
  margin: number;
  is_simulated: boolean;
  data_source: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: string;
  volume: number;
  open_price: number;
  close_price: number;
  profit: number;
  open_time: string;
  close_time: string;
  close_reason: string;
}

export interface AccountInfo {
  balance: number;
  equity: number;
  used_margin: number;
  free_margin: number;
  floating_pnl: number;
  daily_pnl: number;
  win_rate: number;
  total_trades: number;
  open_positions: number;
}
