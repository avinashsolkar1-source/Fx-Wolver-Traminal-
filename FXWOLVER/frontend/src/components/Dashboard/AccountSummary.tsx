import React from 'react';
import { useTradingStore } from '../../stores/tradingStore';
import { useMarketStore } from '../../stores/marketStore';
import { fmtPnLSigned, pnlClass } from '../../utils/formatters';

interface Props {
  onRefresh: () => void;
}

export default function AccountSummary({ onRefresh }: Props) {
  const { account } = useTradingStore();
  const { wsConnected, wsReconnecting } = useMarketStore();

  const dotClass = wsConnected
    ? 'bg-tx-green'
    : wsReconnecting
    ? 'bg-tx-yellow animate-pulse'
    : 'bg-tx-red';

  const statusLabel = wsConnected
    ? 'LIVE'
    : wsReconnecting
    ? 'CONNECTING…'
    : 'OFFLINE';

  return (
    <div className="flex items-center justify-between bg-tx-panel border-b border-tx-border px-3 h-10 flex-shrink-0 gap-2">
      {/* Logo */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-tx-blue font-bold tracking-widest text-sm">⚡ FXWOLVER</span>
        <span className="text-tx-muted text-xs hidden sm:inline">Phase 1–2</span>
      </div>

      {/* Account metrics */}
      <div className="flex items-center gap-4 text-xs overflow-x-auto flex-1 justify-center">
        <Metric label="Balance" value={`$${account.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        <Metric label="Equity"  value={`$${account.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} />
        <Metric
          label="Float P&L"
          value={fmtPnLSigned(account.floating_pnl)}
          cls={pnlClass(account.floating_pnl)}
        />
        <Metric
          label="Daily"
          value={fmtPnLSigned(account.daily_pnl)}
          cls={pnlClass(account.daily_pnl)}
        />
        <Metric label="Margin"  value={`$${account.used_margin.toFixed(2)}`} />
        <Metric label="Free"    value={`$${account.free_margin.toFixed(2)}`} />
        <Metric label="Trades"  value={String(account.total_trades)} />
        <Metric
          label="Win%"
          value={`${account.win_rate}%`}
          cls={account.win_rate >= 50 ? 'pnl-positive' : account.win_rate > 0 ? 'pnl-negative' : 'pnl-zero'}
        />
      </div>

      {/* Status + Refresh */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onRefresh}
          title="Refresh account data"
          className="text-tx-muted hover:text-tx-text text-sm px-2 py-0.5 border border-tx-border rounded hover:border-tx-blue transition-colors"
        >
          ↻
        </button>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotClass}`} />
          <span className="text-tx-muted text-xs">{statusLabel}</span>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span className="text-tx-muted" style={{ fontSize: '9px', letterSpacing: '0.4px' }}>
        {label}
      </span>
      <span className={`font-mono ${cls ?? 'text-tx-text'}`}>{value}</span>
    </div>
  );
}
