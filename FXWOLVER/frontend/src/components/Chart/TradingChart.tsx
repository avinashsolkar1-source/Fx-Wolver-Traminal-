import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  LineData,
  UTCTimestamp,
} from 'lightweight-charts';
import { useMarketStore } from '../../stores/marketStore';
import { api } from '../../hooks/useApi';
import { TIMEFRAMES, Timeframe } from '../../config';
import { getDigits } from '../../utils/formatters';
import {
  calculateEma,
  calculateBollingerBands,
  calculateRsi,
} from '../../utils/indicators';

export default function TradingChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Indicator series refs
  const emaFastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const emaSlowSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbMiddleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const {
    selectedSymbol,
    selectedTimeframe,
    setSelectedTimeframe,
    setCandles,
    quotes,
  } = useMarketStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Indicator Toggles
  const [showEma, setShowEma] = useState(true);
  const [showBB, setShowBB] = useState(false);
  const [currentRsi, setCurrentRsi] = useState<number | null>(null);

  const isSimulated = quotes[selectedSymbol]?.is_simulated ?? true;
  const currentQuote = quotes[selectedSymbol];

  // ─── Chart initialisation ───────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#0d1117' },
        textColor: '#8b949e',
        fontSize: 11,
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
      },
      grid: {
        vertLines: { color: '#161b22' },
        horzLines: { color: '#161b22' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#388bfd55', labelBackgroundColor: '#1f6feb' },
        horzLine: { color: '#388bfd55', labelBackgroundColor: '#1f6feb' },
      },
      rightPriceScale: { borderColor: '#21262d' },
      timeScale: {
        borderColor: '#21262d',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { mouseWheel: true, pinch: true },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Indicator Line Series
    const emaFast = chart.addLineSeries({
      color: '#f0c040',
      lineWidth: 1,
      title: 'EMA 9',
    });
    const emaSlow = chart.addLineSeries({
      color: '#388bfd',
      lineWidth: 1,
      title: 'EMA 21',
    });

    const bbUpper = chart.addLineSeries({
      color: 'rgba(139, 148, 158, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
    });
    const bbMiddle = chart.addLineSeries({
      color: 'rgba(139, 148, 158, 0.3)',
      lineWidth: 1,
    });
    const bbLower = chart.addLineSeries({
      color: 'rgba(139, 148, 158, 0.5)',
      lineWidth: 1,
      lineStyle: 2,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candlestickSeries;
    emaFastSeriesRef.current = emaFast;
    emaSlowSeriesRef.current = emaSlow;
    bbUpperSeriesRef.current = bbUpper;
    bbMiddleSeriesRef.current = bbMiddle;
    bbLowerSeriesRef.current = bbLower;

    const observer = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      chartRef.current.resize(width, height);
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, []);

  // ─── Load historical data & update indicators ─────────────────────────────
  const loadCandles = useCallback(async () => {
    if (!candleSeriesRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const { candles } = await api.getHistorical(selectedSymbol, selectedTimeframe, 500);
      if (candles && candles.length > 0) {
        setCandles(selectedSymbol, selectedTimeframe, candles);

        // Candlesticks
        candleSeriesRef.current.setData(
          candles.map((c: any) => ({
            time: c.time as UTCTimestamp,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          })) as CandlestickData[]
        );

        // EMA 9 & 21
        if (showEma && emaFastSeriesRef.current && emaSlowSeriesRef.current) {
          const fast = calculateEma(candles, 9);
          const slow = calculateEma(candles, 21);
          emaFastSeriesRef.current.setData(
            fast.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) as LineData[]
          );
          emaSlowSeriesRef.current.setData(
            slow.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })) as LineData[]
          );
        } else {
          emaFastSeriesRef.current?.setData([]);
          emaSlowSeriesRef.current?.setData([]);
        }

        // Bollinger Bands
        if (
          showBB &&
          bbUpperSeriesRef.current &&
          bbMiddleSeriesRef.current &&
          bbLowerSeriesRef.current
        ) {
          const bb = calculateBollingerBands(candles, 20, 2);
          bbUpperSeriesRef.current.setData(
            bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.upper })) as LineData[]
          );
          bbMiddleSeriesRef.current.setData(
            bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.middle })) as LineData[]
          );
          bbLowerSeriesRef.current.setData(
            bb.map((p) => ({ time: p.time as UTCTimestamp, value: p.lower })) as LineData[]
          );
        } else {
          bbUpperSeriesRef.current?.setData([]);
          bbMiddleSeriesRef.current?.setData([]);
          bbLowerSeriesRef.current?.setData([]);
        }

        // RSI 14
        const rsiVals = calculateRsi(candles, 14);
        if (rsiVals.length > 0) {
          setCurrentRsi(round(rsiVals[rsiVals.length - 1].value, 1));
        }

        chartRef.current?.timeScale().fitContent();
      } else {
        setError('No candle data received from server.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to load chart data';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, selectedTimeframe, showEma, showBB, setCandles]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  const digits = getDigits(selectedSymbol);

  function round(val: number, d: number) {
    return Number(val.toFixed(d));
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-tx-bg">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1 bg-tx-panel border-b border-tx-border flex-shrink-0">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-tx-text font-bold text-sm">{selectedSymbol}</span>
          {isSimulated ? (
            <span className="badge-sim">⚠ SIM</span>
          ) : (
            <span className="badge-live">● LIVE</span>
          )}
        </div>

        {currentQuote && (
          <div className="flex items-center gap-3 text-xs font-mono ml-2">
            <span className="text-tx-muted">B:</span>
            <span className="text-tx-red">{currentQuote.bid.toFixed(digits)}</span>
            <span className="text-tx-muted">A:</span>
            <span className="text-tx-green">{currentQuote.ask.toFixed(digits)}</span>
            <span className={currentQuote.change_pct >= 0 ? 'pnl-positive' : 'pnl-negative'}>
              {currentQuote.change_pct >= 0 ? '+' : ''}{currentQuote.change_pct.toFixed(2)}%
            </span>
          </div>
        )}

        {/* RSI Meter */}
        {currentRsi !== null && (
          <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-tx-bg border border-tx-border">
            <span className="text-tx-muted" style={{ fontSize: '10px' }}>RSI(14):</span>
            <span
              className={`font-mono font-bold ${
                currentRsi > 70
                  ? 'text-tx-red'
                  : currentRsi < 30
                  ? 'text-tx-green'
                  : 'text-tx-text'
              }`}
            >
              {currentRsi}
            </span>
          </div>
        )}

        {/* Indicator Toggles */}
        <div className="flex items-center gap-1 border-l border-tx-border pl-2">
          <button
            onClick={() => setShowEma(!showEma)}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              showEma
                ? 'bg-tx-blue/20 text-tx-blue border-tx-blue'
                : 'text-tx-muted border-tx-border hover:text-tx-text'
            }`}
          >
            EMA (9/21)
          </button>
          <button
            onClick={() => setShowBB(!showBB)}
            className={`px-2 py-0.5 text-xs rounded border transition-colors ${
              showBB
                ? 'bg-tx-blue/20 text-tx-blue border-tx-blue'
                : 'text-tx-muted border-tx-border hover:text-tx-text'
            }`}
          >
            BB (20,2)
          </button>
        </div>

        <div className="flex-1" />

        {/* Timeframes */}
        <div className="flex gap-0.5">
          {TIMEFRAMES.map((tf: Timeframe) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                selectedTimeframe === tf
                  ? 'bg-tx-blue text-white'
                  : 'text-tx-muted hover:text-tx-text hover:bg-white/5'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <button
          onClick={loadCandles}
          title="Reload chart"
          className="text-tx-muted hover:text-tx-text text-sm px-2 py-0.5 border border-tx-border rounded hover:border-tx-blue transition-colors ml-1"
        >
          ↻
        </button>
      </div>

      {/* ── Chart Canvas ── */}
      <div className="relative flex-1 min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-tx-bg/70 z-20">
            <span className="text-tx-muted text-sm">Loading chart data…</span>
          </div>
        )}

        {error && !loading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-red-900/90 text-red-200 text-xs px-4 py-2 rounded border border-red-700">
            ⚠ {error}
          </div>
        )}

        {isSimulated && (
          <div className="absolute top-2 right-2 z-10 badge-sim pointer-events-none">
            ⚠ SIMULATED DATA — NOT REAL PRICES
          </div>
        )}

        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}
