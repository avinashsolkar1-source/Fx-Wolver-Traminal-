import React, { useState } from 'react';
import { useMarketStore } from '../../stores/marketStore';
import { useTradingStore } from '../../stores/tradingStore';
import { api } from '../../hooks/useApi';
import { fmtPrice } from '../../utils/formatters';

type OrderType = 'market' | 'limit' | 'stop';

export default function OrderPanel() {
  const { selectedSymbol, quotes } = useMarketStore();
  const { setPositions, setTrades, setAccount } = useTradingStore();

  const [orderType, setOrderType] = useState<OrderType>('market');
  const [targetPrice, setTargetPrice] = useState('');
  const [volume, setVolume] = useState('0.01');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [trailingStop, setTrailingStop] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const quote = quotes[selectedSymbol];
  const isSimulated = quote?.is_simulated ?? true;
  const hasQuote = !!quote;

  async function refreshAll() {
    try {
      const [acc, pos, trades] = await Promise.all([
        api.getAccount(),
        api.getPositions(),
        api.getTrades(),
      ]);
      setAccount(acc);
      setPositions(pos);
      setTrades(trades);
    } catch { /* silent */ }
  }

  async function handleOrder(side: 'buy' | 'sell') {
    const vol = parseFloat(volume);
    if (!vol || vol <= 0) {
      showStatus(false, 'Invalid volume');
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      if (orderType === 'market') {
        await api.placeMarketOrder({
          symbol: selectedSymbol,
          side,
          volume: vol,
          stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
          take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
          trailing_stop_pips: trailingStop ? parseFloat(trailingStop) : undefined,
        });
        showStatus(true, `${side.toUpperCase()} Market Order placed!`);
      } else {
        const target = parseFloat(targetPrice);
        if (!target || target <= 0) {
          showStatus(false, 'Please set a valid target price');
          setLoading(false);
          return;
        }
        const pendingType = `${side}_${orderType}`;
        await api.placePendingOrder({
          symbol: selectedSymbol,
          order_type: pendingType,
          target_price: target,
          volume: vol,
          stop_loss: stopLoss ? parseFloat(stopLoss) : undefined,
          take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
        });
        showStatus(true, `${pendingType.toUpperCase()} placed!`);
      }
      await refreshAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Order failed';
      showStatus(false, msg);
    } finally {
      setLoading(false);
    }
  }

  function showStatus(ok: boolean, msg: string) {
    setStatus({ ok, msg });
    setTimeout(() => setStatus(null), 4000);
  }

  return (
    <div
      className="flex flex-col bg-tx-panel border-l border-tx-border flex-shrink-0"
      style={{ width: 175 }}
    >
      <div className="panel-header">
        <span>📋</span>
        <span>New Order</span>
      </div>

      <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
        {/* Symbol header */}
        <div className="text-center">
          <div className="text-tx-text font-bold">{selectedSymbol}</div>
          <div className="mt-0.5">
            {isSimulated ? (
              <span className="badge-sim">⚠ SIMULATED</span>
            ) : (
              <span className="badge-live">● LIVE</span>
            )}
          </div>
        </div>

        {/* Order Type Tabs */}
        <div className="flex border border-tx-border rounded overflow-hidden">
          {(['market', 'limit', 'stop'] as OrderType[]).map((t) => (
            <button
              key={t}
              onClick={() => setOrderType(t)}
              className={`flex-1 py-1 text-xs capitalize ${
                orderType === t ? 'bg-tx-blue text-white' : 'text-tx-muted hover:text-tx-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Live BID / ASK */}
        {quote && (
          <div className="grid grid-cols-2 gap-1">
            <div className="bg-tx-bg rounded p-1 text-center">
              <div className="text-tx-muted" style={{ fontSize: '9px' }}>BID</div>
              <div className="text-tx-red font-mono text-xs">{fmtPrice(quote.bid, selectedSymbol)}</div>
            </div>
            <div className="bg-tx-bg rounded p-1 text-center">
              <div className="text-tx-muted" style={{ fontSize: '9px' }}>ASK</div>
              <div className="text-tx-green font-mono text-xs">{fmtPrice(quote.ask, selectedSymbol)}</div>
            </div>
          </div>
        )}

        {/* Target Price for Limit / Stop */}
        {orderType !== 'market' && (
          <div>
            <label className="text-tx-muted block mb-1" style={{ fontSize: '9px' }}>
              TARGET PRICE ({orderType.toUpperCase()})
            </label>
            <input
              type="number"
              className="tx-input"
              placeholder="e.g. 1.08500"
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              step="any"
            />
          </div>
        )}

        {/* Volume */}
        <div>
          <label className="text-tx-muted block mb-1" style={{ fontSize: '9px' }}>VOLUME (LOTS)</label>
          <input
            type="number"
            className="tx-input"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
            step="0.01"
            min="0.001"
          />
        </div>

        {/* Stop Loss & Take Profit */}
        <div>
          <label className="text-tx-muted block mb-1" style={{ fontSize: '9px' }}>STOP LOSS</label>
          <input
            type="number"
            className="tx-input"
            placeholder="Optional"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            step="any"
          />
        </div>

        <div>
          <label className="text-tx-muted block mb-1" style={{ fontSize: '9px' }}>TAKE PROFIT</label>
          <input
            type="number"
            className="tx-input"
            placeholder="Optional"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            step="any"
          />
        </div>

        {orderType === 'market' && (
          <div>
            <label className="text-tx-muted block mb-1" style={{ fontSize: '9px' }}>TRAILING STOP (PIPS)</label>
            <input
              type="number"
              className="tx-input"
              placeholder="e.g. 20"
              value={trailingStop}
              onChange={(e) => setTrailingStop(e.target.value)}
              step="1"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1 mt-1">
          <button
            onClick={() => handleOrder('buy')}
            disabled={loading || !hasQuote}
            className="flex-1 btn-buy rounded px-2 py-2 text-xs font-bold"
          >
            {loading ? '…' : `BUY ${orderType === 'market' ? '' : orderType.toUpperCase()}`}
          </button>
          <button
            onClick={() => handleOrder('sell')}
            disabled={loading || !hasQuote}
            className="flex-1 btn-sell rounded px-2 py-2 text-xs font-bold"
          >
            {loading ? '…' : `SELL ${orderType === 'market' ? '' : orderType.toUpperCase()}`}
          </button>
        </div>

        {status && (
          <div
            className={`text-xs text-center px-2 py-1 rounded ${
              status.ok
                ? 'bg-tx-green/10 text-tx-green border border-tx-green/30'
                : 'bg-tx-red/10 text-tx-red border border-tx-red/30'
            }`}
          >
            {status.msg}
          </div>
        )}

        <div className="mt-auto border-t border-tx-border pt-1 text-tx-muted text-center" style={{ fontSize: '9px' }}>
          📄 Virtual Margin Trading<br />
          No real financial risk
        </div>
      </div>
    </div>
  );
}
