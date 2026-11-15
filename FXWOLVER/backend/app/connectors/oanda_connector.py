"""
OANDA v20 Market Data Connector (Phase 4)
=========================================
Connects to OANDA Practice (Demo) or Live v20 REST and Pricing Stream API.
Documentation: https://developer.oanda.com/rest-live-v20/

Requirements:
- OANDA practice account API token & Account ID (configured via .env or settings).
- Fetches live bid/ask pricing stream.
- Computes real spread.
- If credentials are not provided or connection fails, falls back gracefully with
  clear status indication (never pretends simulated data is real OANDA data).
"""
import asyncio
import json
import logging
import os
from datetime import datetime
from typing import Callable, Dict, List, Optional

import aiohttp

logger = logging.getLogger(__name__)

# OANDA instrument naming convention: EUR_USD, XAU_USD, etc.
OANDA_SYMBOL_MAP = {
    "EURUSD": "EUR_USD",
    "GBPUSD": "GBP_USD",
    "USDJPY": "USD_JPY",
    "AUDUSD": "AUD_USD",
    "NZDUSD": "NZD_USD",
    "USDCAD": "USD_CAD",
    "USDCHF": "USD_CHF",
    "EURJPY": "EUR_JPY",
    "GBPJPY": "GBP_JPY",
    "XAUUSD": "XAU_USD",
}
REVERSE_MAP = {v: k for k, v in OANDA_SYMBOL_MAP.items()}


class OandaConnector:
    def __init__(self) -> None:
        self.api_key: str = os.getenv("OANDA_API_KEY", "")
        self.account_id: str = os.getenv("OANDA_ACCOUNT_ID", "")
        # Practice URL vs Live URL
        self.base_url: str = os.getenv(
            "OANDA_API_URL", "https://api-fxpractice.oanda.com"
        )
        self.stream_url: str = os.getenv(
            "OANDA_STREAM_URL", "https://stream-fxpractice.oanda.com"
        )
        self.quotes: Dict[str, dict] = {}
        self._callbacks: List[Callable] = []
        self._running: bool = False
        self.is_connected: bool = False
        self.last_error: Optional[str] = None

    def is_configured(self) -> bool:
        return bool(self.api_key and self.account_id)

    def add_callback(self, cb: Callable) -> None:
        self._callbacks.append(cb)

    async def get_historical_candles(
        self,
        symbol: str,
        granularity: str = "H1",
        count: int = 500,
    ) -> List[dict]:
        """
        Fetch historical candles from OANDA v20 REST.
        Granularity: M1, M5, M15, M30, H1, H4, D, W, M
        """
        if not self.is_configured():
            return []

        oanda_sym = OANDA_SYMBOL_MAP.get(symbol.upper(), symbol.upper())
        url = f"{self.base_url}/v3/instruments/{oanda_sym}/candles"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        params = {
            "price": "M",
            "granularity": granularity.replace("1", "").replace("M", "M1").replace("H", "H1") or granularity,
            "count": min(count, 5000),
        }

        try:
            async with aiohttp.ClientSession(headers=headers) as session:
                async with session.get(url, params=params) as resp:
                    if resp.status != 200:
                        err = await resp.text()
                        logger.error(f"OANDA candles HTTP {resp.status}: {err[:200]}")
                        return []
                    data = await resp.json()
                    candles = []
                    for c in data.get("candles", []):
                        if not c.get("complete", False):
                            continue
                        dt = datetime.fromisoformat(c["time"].replace("Z", "+00:00"))
                        candles.append({
                            "time": int(dt.timestamp()),
                            "open": float(c["mid"]["o"]),
                            "high": float(c["mid"]["h"]),
                            "low": float(c["mid"]["l"]),
                            "close": float(c["mid"]["c"]),
                            "volume": float(c["volume"]),
                            "provider": "OANDA",
                            "is_simulated": False,
                        })
                    return candles
        except Exception as e:
            logger.error(f"OANDA candle error ({symbol}): {e}")
            return []

    async def start(self) -> None:
        if not self.is_configured():
            logger.info("OANDA credentials not set; skipping live OANDA stream.")
            return

        self._running = True
        symbols_str = ",".join(OANDA_SYMBOL_MAP.values())
        url = f"{self.stream_url}/v3/accounts/{self.account_id}/pricing/stream?instruments={symbols_str}"
        headers = {"Authorization": f"Bearer {self.api_key}"}

        delay = 3
        while self._running:
            try:
                logger.info("Connecting to OANDA pricing stream...")
                timeout = aiohttp.ClientTimeout(total=0)
                async with aiohttp.ClientSession(headers=headers, timeout=timeout) as session:
                    async with session.get(url) as resp:
                        if resp.status != 200:
                            self.last_error = f"HTTP {resp.status}"
                            self.is_connected = False
                            await asyncio.sleep(delay)
                            continue

                        self.is_connected = True
                        delay = 3
                        logger.info("✅ OANDA live pricing stream connected.")

                        async for line in resp.content:
                            if not self._running:
                                break
                            if not line.strip():
                                continue
                            try:
                                msg = json.loads(line.decode("utf-8"))
                                if msg.get("type") == "PRICE":
                                    await self._process_price(msg)
                            except Exception:
                                continue
            except Exception as e:
                self.is_connected = False
                self.last_error = str(e)
                logger.warning(f"OANDA stream error: {e}. Reconnecting in {delay}s...")
                await asyncio.sleep(delay)
                delay = min(delay * 2, 60)

    async def _process_price(self, data: dict) -> None:
        inst = data.get("instrument", "")
        std_sym = REVERSE_MAP.get(inst, inst.replace("_", ""))
        bids = data.get("bids", [])
        asks = data.get("asks", [])
        if not bids or not asks:
            return

        bid = float(bids[0]["price"])
        ask = float(asks[0]["price"])
        mid = round((bid + ask) / 2.0, 5)
        spread = round(ask - bid, 5)

        quote = {
            "symbol": std_sym,
            "provider": "OANDA_PRACTICE",
            "timestamp": data.get("time", datetime.utcnow().isoformat() + "Z"),
            "bid": bid,
            "ask": ask,
            "last": mid,
            "change_pct": 0.0,
            "spread": spread,
            "data_status": "demo",
            "is_simulated": False,
            "market_status": "open" if data.get("tradeable", True) else "closed",
        }
        self.quotes[std_sym] = quote
        for cb in self._callbacks:
            try:
                await cb(quote)
            except Exception:
                pass

    async def stop(self) -> None:
        self._running = False
        self.is_connected = False
