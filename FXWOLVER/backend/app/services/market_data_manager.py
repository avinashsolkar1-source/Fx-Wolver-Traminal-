"""
Market Data Manager
====================
Orchestrates all market data connectors:
1. Binance (Live Crypto)
2. OANDA v20 (Practice / Live Forex)
3. Simulated Forex (Transparent fallback when OANDA is offline)
4. Stocks Connector (US Equities: AAPL, MSFT, NVDA, TSLA, etc.)

Normalizes all quotes and broadcasts in real-time to WebSockets.
"""
import asyncio
import logging
from typing import Any, Dict, List

from app.connectors.binance_connector import BinanceConnector
from app.connectors.oanda_connector import OandaConnector
from app.connectors.simulated_connector import SimulatedConnector
from app.connectors.stocks_connector import StocksConnector, STOCK_SYMBOLS

logger = logging.getLogger(__name__)

CRYPTO_SYMBOLS = frozenset(BinanceConnector.SYMBOLS)
STOCKS_SET = frozenset(STOCK_SYMBOLS)


class MarketDataManager:
    def __init__(self) -> None:
        self.binance = BinanceConnector()
        self.oanda = OandaConnector()
        self.simulated = SimulatedConnector()
        self.stocks = StocksConnector()

        self.quotes: Dict[str, dict] = {}
        self._clients: List[Any] = []

        self.binance.add_callback(self._on_quote)
        self.oanda.add_callback(self._on_quote)
        self.simulated.add_callback(self._on_sim_quote)
        self.stocks.add_callback(self._on_quote)

    def add_client(self, client: Any) -> None:
        if client not in self._clients:
            self._clients.append(client)

    def remove_client(self, client: Any) -> None:
        self._clients = [c for c in self._clients if c is not client]

    async def _on_quote(self, quote: dict) -> None:
        sym = quote["symbol"]
        self.quotes[sym] = quote
        await self._broadcast({"type": "quote", "data": quote})

    async def _on_sim_quote(self, quote: dict) -> None:
        sym = quote["symbol"]
        # If OANDA is actively connected for this symbol, do NOT overwrite with simulated!
        if sym in self.oanda.quotes and self.oanda.is_connected:
            return
        self.quotes[sym] = quote
        await self._broadcast({"type": "quote", "data": quote})

    async def _broadcast(self, msg: dict) -> None:
        dead: List[Any] = []
        for client in self._clients:
            try:
                await client.broadcast(msg)
            except Exception:
                dead.append(client)
        for c in dead:
            self.remove_client(c)

    async def get_all_quotes(self) -> Dict[str, dict]:
        return dict(self.quotes)

    async def get_historical(
        self,
        symbol: str,
        timeframe: str = "H1",
        limit: int = 500,
    ) -> List[dict]:
        sym = symbol.upper()
        if sym in CRYPTO_SYMBOLS:
            return await self.binance.get_historical_klines(sym, timeframe, limit)
        elif sym in STOCKS_SET:
            return await self.stocks.get_historical_bars(sym, timeframe, limit)
        elif self.oanda.is_configured():
            candles = await self.oanda.get_historical_candles(sym, timeframe, limit)
            if candles:
                return candles
        return await self.simulated.get_simulated_candles(sym, timeframe, limit)

    async def start(self) -> None:
        logger.info("MarketDataManager: starting all connectors...")
        await asyncio.gather(
            self.binance.start(),
            self.oanda.start(),
            self.simulated.start(),
            self.stocks.start(),
            return_exceptions=True,
        )

    async def stop(self) -> None:
        await asyncio.gather(
            self.binance.stop(),
            self.oanda.stop(),
            self.simulated.stop(),
            self.stocks.stop(),
            return_exceptions=True,
        )
        logger.info("MarketDataManager stopped.")
