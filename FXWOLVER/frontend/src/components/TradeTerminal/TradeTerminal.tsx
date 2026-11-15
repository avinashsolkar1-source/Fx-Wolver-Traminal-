import React, { useEffect, useState } from 'react';
import { useTradingStore } from '../../stores/tradingStore';
import { useMarketStore } from '../../stores/marketStore';
import { api } from '../../hooks/useApi';
import { fmtPnLSigned, fmtDateTime, pnlClass } from '../../utils/formatters';
import { Position, Trade } from '../../types';

type TerminalTab = 'positions' | 'pending' | 'history' | 'backtest' | 'bots';

export default function TradeTerminal() {
  const { positions, trades, account, setPositions, setTrades, setAccount } = useTradingStore();
  const { selectedSymbol, selectedTimeframe } = useMarketStore();

  const [activeTab, setActiveTab] = useState<TerminalTab>('positions');
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);

  // Backtest State
  const [backtestStrategy, setBacktestStrategy] = useState('ema_cross');
  const [backtestResult, setBacktestResult] = useState<any | null>(null);
  const [backtesting, setBacktesting] = useState(false);

  // Bots State
  const [bots, setBots] = useState<any[]>([]);
  const [botName, setBotName] = useState('EMA Scalper');
  const [botStrategy, setBotStrategy] = useState('ema_cross');

  useEffect(() => {
    async function refresh() {
      try {
        const [acc, pos, trd, pnd, bts] = await Promise.all([
          api.getAccount(),
          api.getPositions(),
          api.getTrades(),
          api.getPendingOrders(),
          api.listBots(),
        ]);
        setAccount(acc);
        setPositions(pos);
        setTrades(trd);
        setPendingOrders(pnd);
        setBots(bts);
      } catch { /* silent */ }
    }

    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [setAccount, setPositions, setTrades]);

  async function handleClose(posId: string) {
    try {
      await api.closePosition(posId);
      const [acc, pos, trd] = await Promise.all([
        api.getAccount(),
        api.getPositions(),
        api.getTrades(),
      ]);
      setAccount(acc);
      setPositions(pos);
      setTrades(trd);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Close failed');
    }
  }

  async function handleCancelPending(orderId: string) {
    try {
      await api.cancelPendingOrder(orderId);
      const pnd = await api.getPendingOrders();
      setPendingOrders(pnd);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  async function runBacktest() {
    setBacktesting(true);
    setBacktestResult(null);
    try {
      const res = await api.runBacktest({
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        strategy: backtestStrategy,
      });
      setBacktestResult(res);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Backtest failed');
    } finally {
      setBacktesting(false);
    }
  }

  async function createBot() {
    try {
      await api.createBot({
        name: botName,
        symbol: selectedSymbol,
        strategy: botStrategy,
        volume: 0.01,
      });
      const bts = await api.listBots();
      setBots(bts);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to create bot');
    }
  }

  async function toggleBot(botId: string, isRunning: boolean) {
    try {
      if (isRunning) {
        await api.stopBot(botId);
      } else {
        await api.startBot(botId);
      }
      const bts = await api.listBots();
      setBots(bts);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed');
    }
  }

  return (
    <div className="flex flex-col flex-shrink-0 bg-tx-panel border-t border-tx-border" style={{ height: 180 }}>
      {/* Tab Navigation */}
      <div className="flex border-b border-tx-border flex-shrink-0 h-7 items-center">
        {(
          [
            { id: 'positions', label: `Positions (${positions.length})` },
            { id: 'pending',   label: `Orders (${pendingOrders.length})` },
            { id: 'history',   label: `History (${trades.length})` },
            { id: 'backtest',  label: 'Strategy Tester' },
            { id: 'bots',      label: `Bots (${bots.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TerminalTab)}
            className={`px-3 h-full text-xs font-semibold uppercase transition-colors ${
              activeTab === tab.id
                ? 'text-tx-blue border-b-2 border-tx-blue bg-tx-blue/5'
                : 'text-tx-muted hover:text-tx-text'
            }`}
          >
            {tab.label}
          </button>
        ))}

        {/* Metrics Banner */}
        <div className="ml-auto flex items-center gap-3 px-4 text-xs font-mono">
          <span className="text-tx-muted">Float:</span>
          <span className={`font-bold ${pnlClass(account.floating_pnl)}`}>
            {fmtPnLSigned(account.floating_pnl)}
          </span>
          <span className="text-tx-muted">Profit Factor:</span>
          <span className="text-tx-text">{account.profit_factor ?? '0'}</span>
          <span className="text-tx-muted">Equity:</span>
          <span className="text-tx-text">${account.equity.toFixed(2)}</span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-1">
        {activeTab === 'positions' && (
          <PositionsTable positions={positions} onClose={handleClose} />
        )}

        {activeTab === 'pending' && (
          <PendingTable orders={pendingOrders} onCancel={handleCancelPending} />
        )}

        {activeTab === 'history' && (
          <HistoryTable trades={trades} />
        )}

        {activeTab === 'backtest' && (
          <div className="flex flex-col h-full gap-2 p-2">
            <div className="flex items-center gap-3">
              <span className="text-xs text-tx-muted">
                Backtesting {selectedSymbol} ({selectedTimeframe}):
              </span>
              <select
                className="tx-input text-xs w-36"
                value={backtestStrategy}
                onChange={(e) => setBacktestStrategy(e.target.value)}
              >
                <option value="ema_cross">EMA Cross (9/21)</option>
                <option value="rsi">RSI Mean Reversion (30/70)</option>
              </select>
              <button
                onClick={runBacktest}
                disabled={backtesting}
                className="bg-tx-blue text-white px-3 py-1 rounded text-xs hover:bg-tx-accent transition-colors"
              >
                {backtesting ? 'Simulating…' : 'Run Backtest'}
              </button>
            </div>

            {backtestResult && (
              <div className="grid grid-cols-4 gap-2 text-xs bg-tx-bg p-2 rounded border border-tx-border">
                <div>
                  <span className="text-tx-muted">Net Profit: </span>
                  <span className={pnlClass(backtestResult.net_profit)}>
                    {fmtPnLSigned(backtestResult.net_profit)}
                  </span>
                </div>
                <div>
                  <span className="text-tx-muted">Win Rate: </span>
                  <span className="text-tx-text font-bold">{backtestResult.win_rate}%</span>
                </div>
                <div>
                  <span className="text-tx-muted">Profit Factor: </span>
                  <span className="text-tx-text">{backtestResult.profit_factor}</span>
                </div>
                <div>
                  <span className="text-tx-muted">Max Drawdown: </span>
                  <span className="text-tx-red">{backtestResult.max_drawdown_pct}%</span>
                </div>
                <div>
                  <span className="text-tx-muted">Total Trades: </span>
                  <span className="text-tx-text">{backtestResult.total_trades}</span>
                </div>
                <div>
                  <span className="text-tx-muted">Sharpe Ratio: </span>
                  <span className="text-tx-text">{backtestResult.sharpe_ratio}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'bots' && (
          <div className="flex flex-col h-full gap-2 p-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Bot Name"
                className="tx-input text-xs w-32"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
              />
              <select
                className="tx-input text-xs w-32"
                value={botStrategy}
                onChange={(e) => setBotStrategy(e.target.value)}
              >
                <option value="ema_cross">EMA Cross</option>
                <option value="rsi">RSI Reversion</option>
              </select>
              <button
                onClick={createBot}
                className="bg-tx-blue text-white px-2 py-1 rounded text-xs hover:bg-tx-accent"
              >
                + New Bot ({selectedSymbol})
              </button>
            </div>

            <table className="tx-table mt-1">
              <thead>
                <tr>
                  {['Name', 'Symbol', 'Strategy', 'Volume', 'Status', 'Trades', 'Action'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bots.map((b) => (
                  <tr key={b.bot_id}>
                    <td className="text-tx-text font-semibold">{b.name}</td>
                    <td className="text-tx-text">{b.symbol}</td>
                    <td className="text-tx-muted uppercase">{b.strategy}</td>
                    <td className="text-tx-text">{b.volume}</td>
                    <td>
                      <span className={b.is_running ? 'badge-live' : 'badge-sim'}>
                        {b.is_running ? 'RUNNING' : 'STOPPED'}
                      </span>
                    </td>
                    <td className="text-tx-text">{b.total_trades}</td>
                    <td>
                      <button
                        onClick={() => toggleBot(b.bot_id, b.is_running)}
                        className={`text-xs px-2 py-0.5 rounded border ${
                          b.is_running
                            ? 'text-tx-red border-tx-red/40'
                            : 'text-tx-green border-tx-green/40'
                        }`}
                      >
                        {b.is_running ? 'Stop' : 'Start'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-Tables ─────────────────────────────────────────────────────────────

function PositionsTable({ positions, onClose }: { positions: Position[]; onClose: (id: string) => void }) {
  if (positions.length === 0) {
    return <div className="text-tx-muted text-xs p-3">No open positions.</div>;
  }
  return (
    <table className="tx-table">
      <thead>
        <tr>
          {['ID', 'Symbol', 'Side', 'Vol', 'Open', 'Current', 'SL', 'TP', 'P&L', 'Source', ''].map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p.id}>
            <td className="text-tx-muted font-mono">{p.id}</td>
            <td className="text-tx-text font-semibold">{p.symbol}</td>
            <td className={`font-bold ${p.side === 'buy' ? 'pnl-positive' : 'pnl-negative'}`}>
              {p.side.toUpperCase()}
            </td>
            <td className="text-tx-text">{p.volume}</td>
            <td className="font-mono text-tx-text">{p.open_price.toFixed(5)}</td>
            <td className="font-mono text-tx-text">{p.current_price?.toFixed(5) ?? '—'}</td>
            <td className="font-mono text-tx-muted">{p.stop_loss?.toFixed(5) ?? '—'}</td>
            <td className="font-mono text-tx-muted">{p.take_profit?.toFixed(5) ?? '—'}</td>
            <td className={`font-mono font-bold ${pnlClass(p.unrealized_pnl)}`}>
              {fmtPnLSigned(p.unrealized_pnl ?? 0)}
            </td>
            <td>
              <span className={p.is_simulated ? 'badge-sim' : 'badge-live'}>
                {p.is_simulated ? 'SIM' : 'LIVE'}
              </span>
            </td>
            <td>
              <button
                onClick={() => onClose(p.id)}
                className="text-xs text-tx-red border border-tx-red/40 rounded px-2 py-0.5 hover:bg-tx-red/10"
              >
                Close
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PendingTable({ orders, onCancel }: { orders: any[]; onCancel: (id: string) => void }) {
  if (orders.length === 0) {
    return <div className="text-tx-muted text-xs p-3">No pending limit or stop orders.</div>;
  }
  return (
    <table className="tx-table">
      <thead>
        <tr>
          {['ID', 'Symbol', 'Type', 'Target Price', 'Volume', 'SL', 'TP', 'Status', ''].map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="text-tx-muted font-mono">{o.id}</td>
            <td className="text-tx-text font-semibold">{o.symbol}</td>
            <td className="text-tx-blue font-bold uppercase">{o.order_type}</td>
            <td className="font-mono text-tx-text">{o.target_price}</td>
            <td className="text-tx-text">{o.volume}</td>
            <td className="font-mono text-tx-muted">{o.stop_loss ?? '—'}</td>
            <td className="font-mono text-tx-muted">{o.take_profit ?? '—'}</td>
            <td className="text-tx-yellow uppercase">{o.status}</td>
            <td>
              <button
                onClick={() => onCancel(o.id)}
                className="text-xs text-tx-red border border-tx-red/40 rounded px-2 py-0.5 hover:bg-tx-red/10"
              >
                Cancel
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function HistoryTable({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return <div className="text-tx-muted text-xs p-3">No closed trades yet.</div>;
  }
  return (
    <table className="tx-table">
      <thead>
        <tr>
          {['ID', 'Symbol', 'Side', 'Vol', 'Open', 'Close', 'P&L', 'Reason', 'Closed At'].map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {trades.map((t) => (
          <tr key={t.id}>
            <td className="text-tx-muted font-mono">{t.id}</td>
            <td className="text-tx-text font-semibold">{t.symbol}</td>
            <td className={`font-bold ${t.side === 'buy' ? 'pnl-positive' : 'pnl-negative'}`}>
              {t.side.toUpperCase()}
            </td>
            <td className="text-tx-text">{t.volume}</td>
            <td className="font-mono text-tx-text">{t.open_price.toFixed(5)}</td>
            <td className="font-mono text-tx-text">{t.close_price.toFixed(5)}</td>
            <td className={`font-mono font-bold ${pnlClass(t.profit)}`}>
              {fmtPnLSigned(t.profit)}
            </td>
            <td className="text-tx-muted">{t.close_reason}</td>
            <td className="text-tx-muted">{fmtDateTime(t.close_time)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
