import { create } from 'zustand';
import { Quote, Candle } from '../types';
import { Timeframe } from '../config';

interface MarketState {
  quotes: Record<string, Quote>;
  candles: Record<string, Record<string, Candle[]>>;
  selectedSymbol: string;
  selectedTimeframe: Timeframe;
  wsConnected: boolean;
  wsReconnecting: boolean;

  updateQuote: (q: Quote) => void;
  bulkUpdateQuotes: (qs: Record<string, Quote>) => void;
  setCandles: (symbol: string, tf: string, candles: Candle[]) => void;
  setSelectedSymbol: (s: string) => void;
  setSelectedTimeframe: (tf: Timeframe) => void;
  setWsConnected: (v: boolean) => void;
  setWsReconnecting: (v: boolean) => void;
}

export const useMarketStore = create<MarketState>((set) => ({
  quotes: {},
  candles: {},
  selectedSymbol: 'BTCUSDT',
  selectedTimeframe: 'H1',
  wsConnected: false,
  wsReconnecting: false,

  updateQuote: (q) =>
    set((s) => ({ quotes: { ...s.quotes, [q.symbol]: q } })),

  bulkUpdateQuotes: (qs) =>
    set((s) => ({ quotes: { ...s.quotes, ...qs } })),

  setCandles: (symbol, tf, candles) =>
    set((s) => ({
      candles: {
        ...s.candles,
        [symbol]: { ...(s.candles[symbol] ?? {}), [tf]: candles },
      },
    })),

  setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol }),
  setSelectedTimeframe: (selectedTimeframe) => set({ selectedTimeframe }),
  setWsConnected: (wsConnected) => set({ wsConnected }),
  setWsReconnecting: (wsReconnecting) => set({ wsReconnecting }),
}));
