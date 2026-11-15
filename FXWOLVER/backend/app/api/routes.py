"""
REST API Routes
===============
Complete HTTP endpoints for FXWOLVER:
- Quotes & Historical Data
- Market & Pending Orders (Limit, Stop, Trailing)
- Positions & Trade History
- Dukascopy Forex Data Importer
- Strategy Backtester
- Automated Trading Bots
"""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.backtester import Backtester

router = APIRouter()

_market = None
_engine = None
_bot_manager = None


def set_services(market, engine, bot_manager=None) -> None:
    global _market, _engine, _bot_manager
    _market = market
    _engine = engine
    _bot_manager = bot_manager


# ─────────────────────── Schemas ─────────────────────────────────────────────

class MarketOrderReq(BaseModel):
    symbol: str
    side: str = Field(..., pattern="^(buy|sell)$")
    volume: float = Field(..., gt=0, le=100)
    stop_loss: Optional[float] = Field(default=None, gt=0)
    take_profit: Optional[float] = Field(default=None, gt=0)
    trailing_stop_pips: Optional[float] = Field(default=None, ge=0)


class PendingOrderReq(BaseModel):
    symbol: str
    order_type: str = Field(..., pattern="^(buy_limit|sell_limit|buy_stop|sell_stop)$")
    target_price: float = Field(..., gt=0)
    volume: float = Field(..., gt=0, le=100)
    stop_loss: Optional[float] = Field(default=None, gt=0)
    take_profit: Optional[float] = Field(default=None, gt=0)


class BacktestReq(BaseModel):
    symbol: str
    timeframe: str = "H1"
    strategy: str = "ema_cross"  # or 'rsi'
    initial_balance: float = 10000.0
    volume: float = 1.0
    fast_period: Optional[int] = 9
    slow_period: Optional[int] = 21
    rsi_period: Optional[int] = 14


class CreateBotReq(BaseModel):
    name: str
    symbol: str
    strategy: str = "ema_cross"
    volume: float = 0.01


# ─────────────────────── Market Data ─────────────────────────────────────────

@router.get("/quotes", summary="All current market quotes")
async def all_quotes():
    return await _market.get_all_quotes()


@router.get("/historical/{symbol}/{timeframe}", summary="Historical OHLCV candles")
async def historical(
    symbol: str,
    timeframe: str,
    limit: int = Query(default=500, ge=1, le=1000),
):
    candles = await _market.get_historical(
        symbol.upper(), timeframe.upper(), limit
    )
    return {
        "symbol": symbol.upper(),
        "timeframe": timeframe.upper(),
        "candles": candles,
        "count": len(candles),
    }


# ─────────────────────── Trading ──────────────────────────────────────────────

@router.post("/orders/market", summary="Place a paper market order")
async def place_market_order(req: MarketOrderReq):
    result = _engine.place_market_order(
        req.symbol.upper(),
        req.side,
        req.volume,
        req.stop_loss,
        req.take_profit,
        req.trailing_stop_pips,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/orders/pending", summary="Place a limit or stop order")
async def place_pending_order(req: PendingOrderReq):
    result = _engine.place_pending_order(
        symbol=req.symbol.upper(),
        order_type=req.order_type,
        target_price=req.target_price,
        volume=req.volume,
        stop_loss=req.stop_loss,
        take_profit=req.take_profit,
    )
    return result


@router.delete("/orders/pending/{oid}", summary="Cancel a pending order")
async def cancel_pending_order(oid: str):
    res = _engine.cancel_pending_order(oid)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


@router.get("/orders/pending", summary="List pending orders")
async def get_pending_orders():
    return _engine.get_pending_orders()


@router.post("/positions/{pid}/close", summary="Close an open position")
async def close_position(pid: str):
    result = _engine.close_position(pid.upper())
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/account", summary="Account summary & analytics")
async def get_account():
    return _engine.account_info()


@router.get("/positions", summary="Open positions")
async def get_positions():
    return _engine.get_positions()


@router.get("/trades", summary="Closed trade history")
async def get_trades():
    return _engine.get_trades()


# ─────────────────────── Strategy Backtester ─────────────────────────────────

@router.post("/backtest", summary="Run historical strategy backtest")
async def run_backtest(req: BacktestReq):
    candles = await _market.get_historical(req.symbol.upper(), req.timeframe.upper(), 500)
    params = {
        "fast_period": req.fast_period,
        "slow_period": req.slow_period,
        "rsi_period": req.rsi_period,
    }
    result = Backtester.run_strategy(
        candles=candles,
        strategy_name=req.strategy,
        initial_balance=req.initial_balance,
        volume=req.volume,
        params=params,
    )
    return result


# ─────────────────────── Trading Bots ────────────────────────────────────────

@router.get("/bots", summary="List automated bots")
async def list_bots():
    if not _bot_manager:
        return []
    return _bot_manager.list_bots()


@router.post("/bots/create", summary="Create automated bot")
async def create_bot(req: CreateBotReq):
    if not _bot_manager:
        raise HTTPException(status_code=500, detail="Bot manager offline")
    return _bot_manager.create_bot(req.name, req.symbol, req.strategy, req.volume)


@router.post("/bots/{bid}/start", summary="Start bot")
async def start_bot(bid: str):
    return await _bot_manager.start_bot(bid)


@router.post("/bots/{bid}/stop", summary="Stop bot")
async def stop_bot(bid: str):
    return await _bot_manager.stop_bot(bid)
