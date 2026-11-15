import { create } from 'zustand';
import { Position, Trade, AccountInfo } from '../types';

const DEFAULT_ACCOUNT: AccountInfo = {
  balance: 10000,
  equity: 10000,
  used_margin: 0,
  free_margin: 10000,
  floating_pnl: 0,
  daily_pnl: 0,
  win_rate: 0,
  total_trades: 0,
  open_positions: 0,
};

type BottomTab = 'positions' | 'history';

interface TradingState {
  positions: Position[];
  trades: Trade[];
  account: AccountInfo;
  bottomTab: BottomTab;

  setPositions: (p: Position[]) => void;
  setTrades: (t: Trade[]) => void;
  setAccount: (a: AccountInfo) => void;
  setBottomTab: (t: BottomTab) => void;
}

export const useTradingStore = create<TradingState>((set) => ({
  positions: [],
  trades: [],
  account: DEFAULT_ACCOUNT,
  bottomTab: 'positions',

  setPositions: (positions) => set({ positions }),
  setTrades:    (trades)    => set({ trades }),
  setAccount:   (account)   => set({ account }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
}));
