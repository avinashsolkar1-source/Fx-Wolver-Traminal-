// REST API client for FXWOLVER backend
import { API_BASE_URL } from '../config';
import { AccountInfo, Position, Trade } from '../types';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // ─── Account ──────────────────────────────────────────────────────────
  getAccount(): Promise<AccountInfo> {
    return fetchJson('/api/account');
  },

  getPositions(): Promise<Position[]> {
    return fetchJson('/api/positions');
  },

  getTrades(): Promise<Trade[]> {
    return fetchJson('/api/trades');
  },

  // ─── Market Data ──────────────────────────────────────────────────────
  getHistorical(
    symbol: string,
    timeframe: string,
    limit = 500,
  ): Promise<{ symbol: string; timeframe: string; candles: any[]; count: number }> {
    return fetchJson(`/api/historical/${symbol}/${timeframe}?limit=${limit}`);
  },

  // ─── Trading ──────────────────────────────────────────────────────────
  placeMarketOrder(params: {
    symbol: string;
    side: 'buy' | 'sell';
    volume: number;
    stop_loss?: number;
    take_profit?: number;
    trailing_stop_pips?: number;
  }): Promise<{ success: boolean; position: Position }> {
    return fetchJson('/api/orders/market', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  placePendingOrder(params: {
    symbol: string;
    order_type: string;
    target_price: number;
    volume: number;
    stop_loss?: number;
    take_profit?: number;
  }): Promise<{ success: boolean; order: any }> {
    return fetchJson('/api/orders/pending', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  getPendingOrders(): Promise<any[]> {
    return fetchJson('/api/orders/pending');
  },

  cancelPendingOrder(id: string): Promise<any> {
    return fetchJson(`/api/orders/pending/${id}`, { method: 'DELETE' });
  },

  closePosition(id: string): Promise<{ success: boolean; trade: Trade }> {
    return fetchJson(`/api/positions/${id}/close`, { method: 'POST' });
  },

  // ─── Backtesting ──────────────────────────────────────────────────────
  runBacktest(params: {
    symbol: string;
    timeframe?: string;
    strategy?: string;
    initial_balance?: number;
    volume?: number;
    fast_period?: number;
    slow_period?: number;
    rsi_period?: number;
  }): Promise<any> {
    return fetchJson('/api/backtest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  // ─── Automated Bots ───────────────────────────────────────────────────
  listBots(): Promise<any[]> {
    return fetchJson('/api/bots');
  },

  createBot(params: { name: string; symbol: string; strategy: string; volume: number }): Promise<any> {
    return fetchJson('/api/bots/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  startBot(botId: string): Promise<any> {
    return fetchJson(`/api/bots/${botId}/start`, { method: 'POST' });
  },

  stopBot(botId: string): Promise<any> {
    return fetchJson(`/api/bots/${botId}/stop`, { method: 'POST' });
  },
};
