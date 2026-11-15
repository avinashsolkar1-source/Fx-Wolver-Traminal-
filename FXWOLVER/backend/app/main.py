"""
FXWOLVER — FastAPI Main Entry Point
======================================
Multi-Market Professional Trading Terminal Backend
Features:
  - Live Crypto (Binance Public WS)
  - Live Practice / REST Forex (OANDA v20)
  - Simulated Forex Fallback (transparently labeled)
  - US Stocks (Alpaca / Public Equities)
  - Advanced Paper Trading Engine
  - Historical Backtesting & Automated Bot Engine
"""
import asyncio
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router, set_services
from app.services.market_data_manager import MarketDataManager
from app.services.paper_trading import PaperTradingEngine
from app.services.auto_trader import BotManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────────── App ──────────────────────────────────────────

app = FastAPI(
    title="FXWOLVER API",
    version="2.0.0",
    description="Professional Multi-Market Trading Terminal Backend",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────── Services ─────────────────────────────────────

market = MarketDataManager()
engine = PaperTradingEngine()
bot_manager = BotManager(paper_engine=engine, market_data=market)
set_services(market, engine, bot_manager)


# ─────────────────────────────── WebSocket Manager ────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        logger.info(f"WS connect -> {len(self._connections)} client(s) active")

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections:
            self._connections.remove(ws)
        logger.info(f"WS disconnect -> {len(self._connections)} client(s) active")

    async def broadcast(self, msg: dict) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._connections):
            try:
                await ws.send_json(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


ws_manager = ConnectionManager()


async def _price_sync_loop() -> None:
    while True:
        quotes = await market.get_all_quotes()
        if quotes:
            engine.update_quotes(quotes)
        await asyncio.sleep(1)


@app.on_event("startup")
async def _startup() -> None:
    logger.info("🚀 FXWOLVER API v2.0 — starting up...")
    market.add_client(ws_manager)
    asyncio.create_task(market.start(), name="market_data")
    asyncio.create_task(_price_sync_loop(), name="price_sync")


@app.on_event("shutdown")
async def _shutdown() -> None:
    await market.stop()


@app.websocket("/ws/market")
async def ws_market(ws: WebSocket) -> None:
    await ws_manager.connect(ws)
    quotes = await market.get_all_quotes()
    if quotes:
        await ws.send_json({"type": "initial_quotes", "data": quotes})

    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


app.include_router(router, prefix="/api")


@app.get("/", tags=["Health"])
async def root():
    return {
        "app": "FXWOLVER",
        "version": "2.0.0",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    quotes = await market.get_all_quotes()
    return {
        "status": "healthy",
        "active_quotes": len(quotes),
        "open_positions": len(engine.positions),
        "pending_orders": len(engine.pending_orders),
        "account_balance": engine.balance,
        "account_equity": engine.equity,
        "active_bots": len(bot_manager.bots),
    }
