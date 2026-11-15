import React, { useState } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import { fmtPrice, fmtPct, pnlClass } from '../../utils/formatters';
import { CRYPTO_SYMBOLS, FOREX_SYMBOLS, STOCK_SYMBOLS } from '../../config';

type Category = 'CRYPTO' | 'FOREX' | 'STOCKS';

export default function MarketWatch() {
  const { quotes, selectedSymbol, setSelectedSymbol } = useMarketStore();
  const [category, setCategory] = useState<Category>('CRYPTO');
  const [customSymbol, setCustomSymbol] = useState('');
  const [customList, setCustomList] = useState<string[]>([]);

  function getSymbols(): string[] {
    if (category === 'CRYPTO') return [...CRYPTO_SYMBOLS, ...customList];
    if (category === 'FOREX') return [...FOREX_SYMBOLS];
    return [...STOCK_SYMBOLS];
  }

  function handleAddCustom(e: React.FormEvent) {
    e.preventDefault();
    const sym = customSymbol.trim().toUpperCase();
    if (sym && !customList.includes(sym)) {
      setCustomList([...customList, sym]);
      setSelectedSymbol(sym);
      setCustomSymbol('');
    }
  }

  const symbols = getSymbols();

  return (
    <div className="flex flex-col h-full bg-tx-panel border-r border-tx-border flex-shrink-0" style={{ width: 210 }}>
      {/* Header */}
      <div className="panel-header justify-between">
        <div className="flex items-center gap-1">
          <span>📊</span>
          <span>Market Watch</span>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex border-b border-tx-border flex-shrink-0">
        {(['CRYPTO', 'FOREX', 'STOCKS'] as Category[]).map((label) => (
          <button
            key={label}
            onClick={() => setCategory(label)}
            className={`flex-1 py-1 text-xs font-semibold transition-colors ${
              category === label
                ? 'text-tx-blue border-b-2 border-tx-blue bg-tx-blue/5'
                : 'text-tx-muted hover:text-tx-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Column labels */}
      <div
        className="grid px-2 py-1 text-tx-muted border-b border-tx-border flex-shrink-0"
        style={{ gridTemplateColumns: '1fr auto auto', fontSize: '9px', gap: 4 }}
      >
        <span>SYMBOL</span>
        <span>BID</span>
        <span>CHG%</span>
      </div>

      {/* Symbol Rows */}
      <div className="flex-1 overflow-y-auto">
        {symbols.map((sym) => {
          const q = quotes[sym];
          const isSelected = selectedSymbol === sym;
          const isSimulated = q?.is_simulated ?? (category === 'FOREX');

          return (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={`w-full text-left border-b border-tx-border transition-colors ${
                isSelected
                  ? 'bg-tx-accent/20 border-l-2 border-l-tx-blue'
                  : 'hover:bg-white/5'
              }`}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                gap: 4,
                padding: '5px 8px',
                alignItems: 'center',
              }}
            >
              <div className="min-w-0">
                <div className="text-tx-text font-semibold truncate text-xs">{sym}</div>
                {isSimulated ? (
                  <span className="badge-sim">SIM</span>
                ) : (
                  <span className="badge-live">LIVE</span>
                )}
              </div>

              <div className="text-right font-mono text-xs text-tx-text">
                {q ? fmtPrice(q.bid, sym) : <span className="text-tx-muted">—</span>}
              </div>

              <div className={`text-right text-xs ${q ? pnlClass(q.change_pct) : 'text-tx-muted'}`}>
                {q ? fmtPct(q.change_pct) : '—'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Custom Symbol Form */}
      <form onSubmit={handleAddCustom} className="p-2 border-t border-tx-border flex gap-1">
        <input
          type="text"
          className="tx-input text-xs uppercase"
          placeholder="+ Add Symbol"
          value={customSymbol}
          onChange={(e) => setCustomSymbol(e.target.value)}
        />
        <button
          type="submit"
          className="px-2 bg-tx-blue text-white rounded text-xs hover:bg-tx-accent transition-colors"
        >
          +
        </button>
      </form>
    </div>
  );
}
