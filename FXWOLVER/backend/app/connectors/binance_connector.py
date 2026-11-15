"""
Binance Market Data Connector
==============================
Connects to Binance PUBLIC WebSocket streams and REST API.
No API key required for public market data.

Data is labeled:  provider="BINANCE", data_status="live", is_simulated=False
"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Callable, Dict, List, Optional

import aiohttp
import websockets

logger = logging.getLogger(__name__)


class BinanceConnector:
    WS_BASE = "wss://stream.binance.com:9443"
    REST_BASE = "https://api.binance.com/api/v3"

    # Public crypto symbols (Phase 2)
    SYMBOLS: List[str] = [
        "BTCUSDT", "ETHUSDT", "SOLUSDT",
        "BNBUSDT", "XRPUSDT", "ADAUSDT",
    ]

    # Internal timeframe → Binance interval mapping
    TF_MAP: Dict[str, str] = {
        "M1": "1m",  "M5": "5m",  "M15": "15m", "M30": "30m",
        "H1": "1h",  "H4": "4h",  "D1": "1d",   "W1": "1w",
        "MN1": "1M",
    }

    def __init__(self) -> None:
        self.quotes: Dict[str, dict] = {}
        self._callbacks: List[Callable] = []
        self._running = False

    # ------------------------------------------------------------------ public API

    def add_callback(self, cb: Callable) -> None:
        self._callbacks.append(cb)

    async def get_historical_klines(
        self,
        symbol: str,
        timeframe: str = "H1",
        limit: int = 500,
    ) -> List[dict]:
        """
        Fetch historical OHLCV candles from Binance REST API.
        Returns list of { time, open, high, low, close, volume }.
        time is POSIX seconds (integer).
        """
        interval = self.TF_MAP.get(timeframe.upper(), "1h")
        url = f"{self.REST_BASE}/klines"
        params = {
            "symbol": symbol.upper(),
            "interval": interval,
            "limit": min(limit, 1000),
        }
        try:
            timeout = aiohttp.ClientTimeout(total=15)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        body = await resp.text()
                        logger.error(f"Binance klines HTTP {resp.status}: {body[:200]}")
                        return []
                    raw = await resp.json()
                    return [
                        {
                            "time": int(k[0]) // 1000,   # ms → seconds
                            "open": float(k[1]),
                            "high": float(k[2]),
                            "low": float(k[3]),
                            "close": float(k[4]),
                            "volume": float(k[5]),
                        }
                        for k in raw
                    ]
        except Exception as exc:
            logger.error(f"Binance REST error ({symbol}/{timeframe}): {exc}")
            return []

    # ------------------------------------------------------------------ websocket

    async def start(self) -> None:
        self._running = True
        await self._ws_loop()

    async def stop(self) -> None:
        self._running = False

    async def _ws_loop(self) -> None:
        """Main WebSocket loop with exponential back-off reconnection."""
        streams = "/".join(f"{s.lower()}@ticker" for s in self.SYMBOLS)
        uri = f"{self.WS_BASE}/stream?streams={streams}"
        delay = 2  # seconds

        while self._running:
            try:
                logger.info("Connecting to Binance WebSocket...")
                async with websockets.connect(
                    uri,
                    ping_interval=20,
                    ping_timeout=10,
                    max_size=2**20,
                ) as ws:
                    logger.info("✅ Binance WebSocket connected (%d symbols)", len(self.SYMBOLS))
                    delay = 2  # reset back-off on success
                    async for raw in ws:
                        if not self._running:
                            return
                        try:
                            msg = json.loads(raw)
                            if "data" in msg:
                                await self._process_ticker(msg["data"])
                        except Exception as parse_err:
                            logger.debug(f"Binance parse error: {parse_err}")
            except Exception as exc:
                if not self._running:
                    return
                logger.warning(
                    "Binance WS disconnected (%s) — reconnecting in %ds", exc, delay
                )
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)  # exponential back-off, cap at 60s

    async def _process_ticker(self, ticker: dict) -> None:
        symbol: str = ticker.get("s", "")
        if not symbol or symbol not in self.SYMBOLS:
            return

        try:
            bid = float(ticker["b"])
            ask = float(ticker["a"])
            last = float(ticker["c"])
            change_pct = float(ticker["P"])
        except (KeyError, ValueError, TypeError):
            return

        quote = {
            "symbol": symbol,
            "provider": "BINANCE",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "bid": bid,
            "ask": ask,
            "last": last,
            "change_pct": change_pct,
            "spread": round(ask - bid, 8),
            "data_status": "live",
            "is_simulated": False,
            "market_status": "open",
        }
        self.quotes[symbol] = quote

        for cb in self._callbacks:
            try:
                await cb(quote)
            except Exception as cb_err:
                logger.error(f"Binance callback error: {cb_err}")
