"""
Strategy Backtesting Engine (Phase 9)
=====================================
Performs historical bar-by-bar backtesting with realistic assumptions:
- Commission and spread deducted on every trade.
- No look-ahead bias (signals generated at bar close, filled at next bar open).
- Calculates comprehensive performance metrics:
  - Net Profit, Gross Profit, Gross Loss
  - Win Rate, Profit Factor, Max Drawdown %
  - Sharpe Ratio, Total Trades, Average Trade P&L
"""
import math
from typing import Dict, List, Optional


class Backtester:
    @staticmethod
    def run_strategy(
        candles: List[dict],
        strategy_name: str = "ema_cross",
        initial_balance: float = 10000.0,
        volume: float = 1.0,
        spread: float = 0.0002,
        commission_per_lot: float = 5.0,
        params: Optional[dict] = None,
    ) -> dict:
        if not candles or len(candles) < 30:
            return {"error": "Insufficient historical candle data for backtesting"}

        params = params or {}
        closes = [c["close"] for c in candles]
        balance = initial_balance
        equity = initial_balance
        equity_curve = [initial_balance]
        trades = []
        position = None  # {'side': 'buy'/'sell', 'entry_price': float, 'entry_bar': int}

        # ─── Calculate Indicators ───
        if strategy_name == "ema_cross":
            fast_p = int(params.get("fast_period", 9))
            slow_p = int(params.get("slow_period", 21))
            fast_ema = Backtester._calc_ema(closes, fast_p)
            slow_ema = Backtester._calc_ema(closes, slow_p)
        elif strategy_name == "rsi":
            rsi_period = int(params.get("rsi_period", 14))
            rsi_values = Backtester._calc_rsi(closes, rsi_period)

        # ─── Simulation Loop (Bar by Bar) ───
        for i in range(30, len(candles) - 1):
            curr_bar = candles[i]
            next_bar = candles[i + 1]
            signal = None

            if strategy_name == "ema_cross":
                # Signal at current bar close:
                if fast_ema[i - 1] <= slow_ema[i - 1] and fast_ema[i] > slow_ema[i]:
                    signal = "buy"
                elif fast_ema[i - 1] >= slow_ema[i - 1] and fast_ema[i] < slow_ema[i]:
                    signal = "sell"

            elif strategy_name == "rsi":
                rsi_val = rsi_values[i]
                if rsi_val is not None:
                    if rsi_val < 30:
                        signal = "buy"
                    elif rsi_val > 70:
                        signal = "sell"

            # Execute exit or reverse at next bar Open
            exec_price = next_bar["open"]
            if position:
                # Check if signal is opposite
                if (position["side"] == "buy" and signal == "sell") or (
                    position["side"] == "sell" and signal == "buy"
                ):
                    pnl = Backtester._calc_trade_pnl(
                        position["side"], position["entry_price"], exec_price, volume, spread, commission_per_lot
                    )
                    balance += pnl
                    equity = balance
                    trades.append({
                        "entry_bar": position["entry_bar"],
                        "exit_bar": i + 1,
                        "side": position["side"],
                        "entry_price": position["entry_price"],
                        "exit_price": exec_price,
                        "profit": round(pnl, 2),
                    })
                    position = None

            # Open new position
            if signal and not position:
                position = {
                    "side": signal,
                    "entry_price": exec_price,
                    "entry_bar": i + 1,
                }

            equity_curve.append(round(equity, 2))

        # Close any lingering open position at last bar
        if position:
            last_p = candles[-1]["close"]
            pnl = Backtester._calc_trade_pnl(
                position["side"], position["entry_price"], last_p, volume, spread, commission_per_lot
            )
            balance += pnl
            trades.append({
                "entry_bar": position["entry_bar"],
                "exit_bar": len(candles) - 1,
                "side": position["side"],
                "entry_price": position["entry_price"],
                "exit_price": last_p,
                "profit": round(pnl, 2),
            })
            equity_curve[-1] = round(balance, 2)

        # ─── Metrics Compilation ───
        net_profit = round(balance - initial_balance, 2)
        winning_trades = [t for t in trades if t["profit"] > 0]
        losing_trades = [t for t in trades if t["profit"] < 0]
        total_trades = len(trades)
        win_rate = round((len(winning_trades) / total_trades * 100), 2) if total_trades else 0.0

        gross_profit = round(sum(t["profit"] for t in winning_trades), 2)
        gross_loss = round(abs(sum(t["profit"] for t in losing_trades)), 2)
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0)

        # Max Drawdown
        peak = initial_balance
        max_dd = 0.0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = (peak - eq) / peak * 100
            if dd > max_dd:
                max_dd = dd

        # Sharpe Ratio (Daily or Per-trade approximation)
        returns = [t["profit"] for t in trades]
        if returns and len(returns) > 1:
            avg_ret = sum(returns) / len(returns)
            variance = sum((r - avg_ret) ** 2 for r in returns) / (len(returns) - 1)
            std_dev = math.sqrt(variance)
            sharpe = round(avg_ret / std_dev, 2) if std_dev > 0 else 0.0
        else:
            sharpe = 0.0

        return {
            "strategy": strategy_name,
            "initial_balance": initial_balance,
            "final_balance": round(balance, 2),
            "net_profit": net_profit,
            "gross_profit": gross_profit,
            "gross_loss": gross_loss,
            "total_trades": total_trades,
            "win_rate": win_rate,
            "profit_factor": profit_factor,
            "max_drawdown_pct": round(max_dd, 2),
            "sharpe_ratio": sharpe,
            "trades": trades[-50:],  # return last 50 trades
            "equity_curve": equity_curve[:: max(1, len(equity_curve) // 100)],
        }

    @staticmethod
    def _calc_trade_pnl(side, entry_p, exit_p, volume, spread, commission):
        diff = (exit_p - entry_p) if side == "buy" else (entry_p - exit_p)
        gross_pnl = diff * volume * 100000  # standard lot
        # subtract spread & commission
        cost = (spread * volume * 100000) + (commission * volume)
        return gross_pnl - cost

    @staticmethod
    def _calc_ema(data: List[float], period: int) -> List[float]:
        alpha = 2.0 / (period + 1)
        ema = [data[0]]
        for p in data[1:]:
            ema.append(p * alpha + ema[-1] * (1 - alpha))
        return ema

    @staticmethod
    def _calc_rsi(data: List[float], period: int = 14) -> List[Optional[float]]:
        rsi = [None] * len(data)
        if len(data) <= period:
            return rsi
        gains = []
        losses = []
        for i in range(1, len(data)):
            diff = data[i] - data[i - 1]
            gains.append(max(diff, 0))
            losses.append(max(-diff, 0))

        avg_gain = sum(gains[:period]) / period
        avg_loss = sum(losses[:period]) / period
        if avg_loss == 0:
            rsi[period] = 100.0
        else:
            rs = avg_gain / avg_loss
            rsi[period] = round(100 - (100 / (1 + rs)), 2)

        for i in range(period + 1, len(data)):
            g = gains[i - 1]
            l = losses[i - 1]
            avg_gain = (avg_gain * (period - 1) + g) / period
            avg_loss = (avg_loss * (period - 1) + l) / period
            if avg_loss == 0:
                rsi[i] = 100.0
            else:
                rs = avg_gain / avg_loss
                rsi[i] = round(100 - (100 / (1 + rs)), 2)
        return rsi
