// Number/string formatting utilities

const DIGITS: Record<string, number> = {
  XAUUSD: 2,
  BTCUSDT: 2, ETHUSDT: 2, SOLUSDT: 2, BNBUSDT: 2,
  XRPUSDT: 4, ADAUSDT: 4,
  EURUSD: 5, GBPUSD: 5, AUDUSD: 5, NZDUSD: 5, USDCAD: 5, USDCHF: 5,
  USDJPY: 3, EURJPY: 3, GBPJPY: 3,
  AAPL: 2, MSFT: 2, NVDA: 2, TSLA: 2, AMZN: 2, GOOGL: 2, META: 2,
};

export function getDigits(symbol: string): number {
  return DIGITS[symbol] ?? 5;
}

export function fmtPrice(price: number | undefined | null, symbol: string): string {
  if (price === undefined || price === null || isNaN(price)) return '—';
  return price.toFixed(getDigits(symbol));
}

export function fmtPnL(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}$${Math.abs(pnl).toFixed(2)}${pnl >= 0 ? '' : ''}`.replace('+$-', '-$');
}

export function fmtPnLSigned(pnl: number): string {
  if (pnl >= 0) return `+$${pnl.toFixed(2)}`;
  return `-$${Math.abs(pnl).toFixed(2)}`;
}

export function fmtPct(pct: number): string {
  if (pct >= 0) return `+${pct.toFixed(2)}%`;
  return `${pct.toFixed(2)}%`;
}

export function pnlClass(pnl: number): string {
  if (pnl > 0) return 'pnl-positive';
  if (pnl < 0) return 'pnl-negative';
  return 'pnl-zero';
}

export function fmtDateTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString();
  } catch {
    return isoStr;
  }
}

export function fmtTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString();
  } catch {
    return isoStr;
  }
}

export function symbolType(symbol: string): 'crypto' | 'forex' | 'stock' {
  const crypto = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT'];
  if (crypto.includes(symbol)) return 'crypto';
  const stock = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'GOOGL', 'META'];
  if (stock.includes(symbol)) return 'stock';
  return 'forex';
}
