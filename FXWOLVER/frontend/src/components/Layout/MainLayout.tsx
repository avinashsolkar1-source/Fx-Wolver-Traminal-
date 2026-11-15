import React from 'react';
import AccountSummary from '../Dashboard/AccountSummary';
import MarketWatch from '../MarketWatch/MarketWatch';
import TradingChart from '../Chart/TradingChart';
import OrderPanel from '../OrderPanel/OrderPanel';
import TradeTerminal from '../TradeTerminal/TradeTerminal';
import { useTradingStore } from '../../stores/tradingStore';
import { api } from '../../hooks/useApi';

export default function MainLayout() {
  const { setAccount, setPositions, setTrades } = useTradingStore();

  async function handleRefresh() {
    try {
      const [acc, pos, trd] = await Promise.all([
        api.getAccount(),
        api.getPositions(),
        api.getTrades(),
      ]);
      setAccount(acc);
      setPositions(pos);
      setTrades(trd);
    } catch (e) {
      console.error('Refresh failed:', e);
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-tx-bg text-tx-text select-none">
      {/* ── Top toolbar ── */}
      <AccountSummary onRefresh={handleRefresh} />

      {/* ── Main trading area ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left — Market Watch */}
        <MarketWatch />

        {/* Centre — Chart (takes remaining width) */}
        <TradingChart />

        {/* Right — Order Panel */}
        <OrderPanel />
      </div>

      {/* ── Bottom — Trade Terminal ── */}
      <TradeTerminal />
    </div>
  );
}
