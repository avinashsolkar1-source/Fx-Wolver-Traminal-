"""
Automated Trading Bot Engine (Phase 10)
=======================================
Runs automated trading algorithms in PAPER TRADING mode.
Features:
- Strategy 1: Fast EMA / Slow EMA Crossover
- Strategy 2: RSI Mean Reversion (Buy < 30, Sell > 70)
- Configurable per-bot parameters (symbol, volume, timeframe)
- Starts and stops independently
- Real-time logging
"""
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Optional

from app.services.backtester import Backtester

logger = logging.getLogger(__name__)


class TradingBot:
    def __init__(
        self,
        bot_id: str,
        name: str,
        symbol: str,
        strategy_type: str,
        volume: float,
        paper_engine,
        market_data,
        params: Optional[dict] = None,
    ) -> None:
        self.bot_id = bot_id
        self.name = name
        self.symbol = symbol.upper()
        self.strategy_type = strategy_type
        self.volume = volume
        self.paper_engine = paper_engine
        self.market_data = market_data
        self.params = params or {}
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        self.logs: List[str] = []
        self.total_bot_trades = 0

    def log(self, msg: str) -> None:
        entry = f"[{datetime.utcnow().strftime('%H:%M:%S')}] {msg}"
        self.logs.append(entry)
        if len(self.logs) > 100:
            self.logs.pop(0)
        logger.info(f"Bot {self.name}: {msg}")

    async def start(self) -> None:
        if self.is_running:
            return
        self.is_running = True
        self.log(f"Started bot on {self.symbol} ({self.strategy_type})")
        self._task = asyncio.create_task(self._run_loop())

    async def stop(self) -> None:
        self.is_running = False
        if self._task:
            self._task.cancel()
        self.log("Bot stopped")

    async def _run_loop(self) -> None:
        while self.is_running:
            try:
                # Fetch recent candles
                candles = await self.market_data.get_historical(self.symbol, "M1", 50)
                if len(candles) >= 30:
                    closes = [c["close"] for c in candles]

                    if self.strategy_type == "ema_cross":
                        fast = Backtester._calc_ema(closes, 9)
                        slow = Backtester._calc_ema(closes, 21)
                        if fast[-2] <= slow[-2] and fast[-1] > slow[-1]:
                            self.log("Bullish EMA Cross detected -> Placing BUY")
                            res = self.paper_engine.place_market_order(
                                self.symbol, "buy", self.volume
                            )
                            if res.get("success"):
                                self.total_bot_trades += 1
                        elif fast[-2] >= slow[-2] and fast[-1] < slow[-1]:
                            self.log("Bearish EMA Cross detected -> Placing SELL")
                            res = self.paper_engine.place_market_order(
                                self.symbol, "sell", self.volume
                            )
                            if res.get("success"):
                                self.total_bot_trades += 1

                    elif self.strategy_type == "rsi":
                        rsi = Backtester._calc_rsi(closes, 14)
                        latest_rsi = rsi[-1]
                        if latest_rsi and latest_rsi < 30:
                            self.log(f"RSI oversold ({latest_rsi}) -> Placing BUY")
                            res = self.paper_engine.place_market_order(
                                self.symbol, "buy", self.volume
                            )
                            if res.get("success"):
                                self.total_bot_trades += 1
                        elif latest_rsi and latest_rsi > 70:
                            self.log(f"RSI overbought ({latest_rsi}) -> Placing SELL")
                            res = self.paper_engine.place_market_order(
                                self.symbol, "sell", self.volume
                            )
                            if res.get("success"):
                                self.total_bot_trades += 1

            except Exception as e:
                self.log(f"Bot loop error: {e}")

            # Sleep 10 seconds before next evaluation
            await asyncio.sleep(10)

    def to_dict(self) -> dict:
        return {
            "bot_id": self.bot_id,
            "name": self.name,
            "symbol": self.symbol,
            "strategy": self.strategy_type,
            "volume": self.volume,
            "is_running": self.is_running,
            "total_trades": self.total_bot_trades,
            "recent_logs": self.logs[-10:],
        }


class BotManager:
    def __init__(self, paper_engine, market_data) -> None:
        self.paper_engine = paper_engine
        self.market_data = market_data
        self.bots: Dict[str, TradingBot] = {}

    def create_bot(self, name: str, symbol: str, strategy: str, volume: float) -> dict:
        import uuid
        bid = str(uuid.uuid4())[:6].upper()
        bot = TradingBot(
            bot_id=bid,
            name=name,
            symbol=symbol,
            strategy_type=strategy,
            volume=volume,
            paper_engine=self.paper_engine,
            market_data=self.market_data,
        )
        self.bots[bid] = bot
        return bot.to_dict()

    async def start_bot(self, bid: str) -> dict:
        if bid in self.bots:
            await self.bots[bid].start()
            return {"success": True, "bot": self.bots[bid].to_dict()}
        return {"error": "Bot not found"}

    async def stop_bot(self, bid: str) -> dict:
        if bid in self.bots:
            await self.bots[bid].stop()
            return {"success": True, "bot": self.bots[bid].to_dict()}
        return {"error": "Bot not found"}

    def list_bots(self) -> List[dict]:
        return [b.to_dict() for b in self.bots.values()]
