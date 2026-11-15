"""
Advanced Paper Trading Engine (Phase 7)
=======================================
Virtual trading account with $10,000 starting balance.
Features:
- Market Orders (Buy / Sell)
- Pending Limit Orders (Buy Limit, Sell Limit)
- Pending Stop Orders (Buy Stop, Sell Stop)
- Stop Loss & Take Profit execution
- Trailing Stop support
- Order cancellation and modification
- Accurate contract size & margin by asset class (Forex, Crypto, Stocks, Metals)
"""
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

CONTRACT_SPECS: Dict[str, dict] = {
    # Forex
    "XAUUSD": {"contract_size": 100, "leverage": 100, "digits": 2, "type": "commodity"},
    "EURUSD": {"contract_size": 100000, "leverage": 100, "digits": 5, "type": "forex"},
    "GBPUSD": {"contract_size": 100000, "leverage": 100, "digits": 5, "type": "forex"},
    "USDJPY": {"contract_size": 100000, "leverage": 100, "digits": 3, "type": "forex"},
    "AUDUSD": {"contract_size": 100000, "leverage": 100, "digits": 5, "type": "forex"},
    "NZDUSD": {"contract_size": 100000, "leverage": 100, "digits": 5, "type": "forex"},
    "USDCAD": {"contract_size": 100000, "leverage": 100, "digits": 5, "type": "forex"},
    "USDCHF": {"contract_size": 100000, "leverage": 100, "digits": 5, "type": "forex"},
    "EURJPY": {"contract_size": 100000, "leverage": 100, "digits": 3, "type": "forex"},
    "GBPJPY": {"contract_size": 100000, "leverage": 100, "digits": 3, "type": "forex"},
    # Crypto
    "BTCUSDT": {"contract_size": 1, "leverage": 10, "digits": 2, "type": "crypto"},
    "ETHUSDT": {"contract_size": 1, "leverage": 10, "digits": 2, "type": "crypto"},
    "SOLUSDT": {"contract_size": 1, "leverage": 10, "digits": 2, "type": "crypto"},
    "BNBUSDT": {"contract_size": 1, "leverage": 10, "digits": 2, "type": "crypto"},
    "XRPUSDT": {"contract_size": 1, "leverage": 10, "digits": 4, "type": "crypto"},
    "ADAUSDT": {"contract_size": 1, "leverage": 10, "digits": 4, "type": "crypto"},
    # Stocks
    "AAPL": {"contract_size": 1, "leverage": 4, "digits": 2, "type": "stock"},
    "MSFT": {"contract_size": 1, "leverage": 4, "digits": 2, "type": "stock"},
    "NVDA": {"contract_size": 1, "leverage": 4, "digits": 2, "type": "stock"},
    "TSLA": {"contract_size": 1, "leverage": 4, "digits": 2, "type": "stock"},
    "AMZN": {"contract_size": 1, "leverage": 4, "digits": 2, "type": "stock"},
    "GOOGL": {"contract_size": 1, "leverage": 4, "digits": 2, "type": "stock"},
    "META": {"contract_size": 1, "leverage": 4, "digits": 2, "type": "stock"},
}

_DEFAULT_SPEC = {"contract_size": 1, "leverage": 10, "digits": 2, "type": "unknown"}


def _spec(symbol: str) -> dict:
    return CONTRACT_SPECS.get(symbol.upper(), _DEFAULT_SPEC)


class PaperTradingEngine:
    INITIAL_BALANCE = 10_000.0

    def __init__(self) -> None:
        self.balance: float = self.INITIAL_BALANCE
        self.daily_start_balance: float = self.INITIAL_BALANCE
        self.positions: Dict[str, dict] = {}
        self.pending_orders: Dict[str, dict] = {}
        self.closed_trades: List[dict] = []
        self.current_quotes: Dict[str, dict] = {}

    def update_quotes(self, quotes: Dict[str, dict]) -> None:
        self.current_quotes = quotes
        self._check_pending_orders()
        self._tick_all_positions()

    def _margin_required(self, symbol: str, volume: float, price: float) -> float:
        s = _spec(symbol)
        notional = volume * s["contract_size"] * price
        return round(notional / s["leverage"], 2)

    def _calc_pnl(self, pos: dict, close_px: float) -> float:
        s = _spec(pos["symbol"])
        if pos["side"] == "buy":
            diff = close_px - pos["open_price"]
        else:
            diff = pos["open_price"] - close_px
        return round(diff * pos["volume"] * s["contract_size"], 2)

    def place_market_order(
        self,
        symbol: str,
        side: str,
        volume: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
        trailing_stop_pips: Optional[float] = None,
    ) -> dict:
        sym = symbol.upper()
        q = self.current_quotes.get(sym)
        if not q:
            return {"error": f"No live price for {sym}"}

        exec_px = float(q["ask"]) if side == "buy" else float(q["bid"])
        margin = self._margin_required(sym, volume, exec_px)
        if margin > self.free_margin:
            return {"error": f"Insufficient margin. Required: ${margin:.2f}"}

        pid = str(uuid.uuid4())[:8].upper()
        pos = {
            "id": pid,
            "symbol": sym,
            "side": side,
            "volume": volume,
            "open_price": exec_px,
            "current_price": exec_px,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "trailing_stop_pips": trailing_stop_pips,
            "highest_price": exec_px,
            "lowest_price": exec_px,
            "open_time": datetime.utcnow().isoformat() + "Z",
            "unrealized_pnl": 0.0,
            "margin": margin,
            "is_simulated": q.get("is_simulated", True),
            "data_source": q.get("provider", "UNKNOWN"),
        }
        self.positions[pid] = pos
        logger.info(f"OPEN {pid} {side.upper()} {volume} {sym} @ {exec_px}")
        return {"success": True, "position": pos}

    def place_pending_order(
        self,
        symbol: str,
        order_type: str,  # 'buy_limit', 'sell_limit', 'buy_stop', 'sell_stop'
        target_price: float,
        volume: float,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None,
    ) -> dict:
        sym = symbol.upper()
        oid = str(uuid.uuid4())[:8].upper()
        order = {
            "id": oid,
            "symbol": sym,
            "order_type": order_type.lower(),
            "target_price": target_price,
            "volume": volume,
            "stop_loss": stop_loss,
            "take_profit": take_profit,
            "status": "pending",
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        self.pending_orders[oid] = order
        logger.info(f"PENDING ORDER {oid} {order_type} {volume} {sym} @ {target_price}")
        return {"success": True, "order": order}

    def cancel_pending_order(self, order_id: str) -> dict:
        oid = order_id.upper()
        if oid in self.pending_orders:
            o = self.pending_orders.pop(oid)
            return {"success": True, "canceled": o}
        return {"error": f"Pending order {oid} not found"}

    def _check_pending_orders(self) -> None:
        to_trigger = []
        for oid, o in self.pending_orders.items():
            sym = o["symbol"]
            q = self.current_quotes.get(sym)
            if not q:
                continue
            bid = float(q["bid"])
            ask = float(q["ask"])
            t = o["target_price"]
            otype = o["order_type"]

            triggered = False
            if otype == "buy_limit" and ask <= t:
                triggered = True
            elif otype == "sell_limit" and bid >= t:
                triggered = True
            elif otype == "buy_stop" and ask >= t:
                triggered = True
            elif otype == "sell_stop" and bid <= t:
                triggered = True

            if triggered:
                to_trigger.append((oid, o))

        for oid, o in to_trigger:
            self.pending_orders.pop(oid, None)
            side = "buy" if "buy" in o["order_type"] else "sell"
            self.place_market_order(
                symbol=o["symbol"],
                side=side,
                volume=o["volume"],
                stop_loss=o.get("stop_loss"),
                take_profit=o.get("take_profit"),
            )

    def _tick_all_positions(self) -> None:
        to_close = []
        for pid, pos in self.positions.items():
            sym = pos["symbol"]
            q = self.current_quotes.get(sym)
            if not q:
                continue

            close_px = float(q["bid"]) if pos["side"] == "buy" else float(q["ask"])
            pos["current_price"] = close_px
            pos["unrealized_pnl"] = self._calc_pnl(pos, close_px)

            # Trailing stop update
            ts_pips = pos.get("trailing_stop_pips")
            if ts_pips and ts_pips > 0:
                s = _spec(sym)
                pip_val = 10 ** (-s["digits"] + 1)
                dist = ts_pips * pip_val
                if pos["side"] == "buy":
                    if close_px > pos["highest_price"]:
                        pos["highest_price"] = close_px
                        new_sl = round(close_px - dist, s["digits"])
                        if pos["stop_loss"] is None or new_sl > pos["stop_loss"]:
                            pos["stop_loss"] = new_sl
                else:
                    if close_px < pos["lowest_price"]:
                        pos["lowest_price"] = close_px
                        new_sl = round(close_px + dist, s["digits"])
                        if pos["stop_loss"] is None or new_sl < pos["stop_loss"]:
                            pos["stop_loss"] = new_sl

            sl = pos.get("stop_loss")
            tp = pos.get("take_profit")
            if pos["side"] == "buy":
                if sl and close_px <= sl:
                    to_close.append((pid, close_px, "Stop Loss"))
                elif tp and close_px >= tp:
                    to_close.append((pid, close_px, "Take Profit"))
            else:
                if sl and close_px >= sl:
                    to_close.append((pid, close_px, "Stop Loss"))
                elif tp and close_px <= tp:
                    to_close.append((pid, close_px, "Take Profit"))

        for pid, cp, reason in to_close:
            self._do_close(pid, cp, reason)

    def close_position(self, position_id: str) -> dict:
        pid = position_id.upper()
        pos = self.positions.get(pid)
        if not pos:
            return {"error": f"Position {pid} not found"}
        q = self.current_quotes.get(pos["symbol"])
        if not q:
            return {"error": "No price available"}
        close_px = float(q["bid"]) if pos["side"] == "buy" else float(q["ask"])
        trade = self._do_close(pid, close_px, "Manual Close")
        return {"success": True, "trade": trade}

    def _do_close(self, pid: str, close_px: float, reason: str) -> dict:
        pos = self.positions.pop(pid, None)
        if not pos:
            return {}
        pnl = self._calc_pnl(pos, close_px)
        self.balance = round(self.balance + pnl, 2)
        trade = {
            "id": pid,
            "symbol": pos["symbol"],
            "side": pos["side"],
            "volume": pos["volume"],
            "open_price": pos["open_price"],
            "close_price": close_px,
            "profit": pnl,
            "open_time": pos["open_time"],
            "close_time": datetime.utcnow().isoformat() + "Z",
            "close_reason": reason,
        }
        self.closed_trades.append(trade)
        return trade

    @property
    def floating_pnl(self) -> float:
        return round(sum(p.get("unrealized_pnl", 0.0) for p in self.positions.values()), 2)

    @property
    def equity(self) -> float:
        return round(self.balance + self.floating_pnl, 2)

    @property
    def used_margin(self) -> float:
        return round(sum(p.get("margin", 0.0) for p in self.positions.values()), 2)

    @property
    def free_margin(self) -> float:
        return round(self.equity - self.used_margin, 2)

    def account_info(self) -> dict:
        trades = self.closed_trades
        wins = [t for t in trades if t["profit"] > 0]
        losses = [t for t in trades if t["profit"] < 0]
        win_rate = (len(wins) / len(trades) * 100) if trades else 0.0
        gross_profit = sum(t["profit"] for t in wins)
        gross_loss = abs(sum(t["profit"] for t in losses))
        profit_factor = round(gross_profit / gross_loss, 2) if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0)

        return {
            "balance": self.balance,
            "equity": self.equity,
            "used_margin": self.used_margin,
            "free_margin": self.free_margin,
            "floating_pnl": self.floating_pnl,
            "daily_pnl": round(self.equity - self.daily_start_balance, 2),
            "win_rate": round(win_rate, 1),
            "total_trades": len(trades),
            "open_positions": len(self.positions),
            "pending_orders": len(self.pending_orders),
            "profit_factor": profit_factor,
        }

    def get_positions(self) -> List[dict]:
        return list(self.positions.values())

    def get_pending_orders(self) -> List[dict]:
        return list(self.pending_orders.values())

    def get_trades(self) -> List[dict]:
        return list(reversed(self.closed_trades))
