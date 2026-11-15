-- =====================================================================
-- FXWOLVER — PostgreSQL Database Schema
-- Designed for PostgreSQL 14+ with optional TimescaleDB extension
-- =====================================================================

-- Optional: Enable TimescaleDB if installed
-- CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & AUTHENTICATION
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. ACCOUNTS (Supports paper & demo accounts)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_number VARCHAR(50) UNIQUE NOT NULL,
    account_type VARCHAR(20) DEFAULT 'paper', -- 'paper', 'demo', 'live'
    currency VARCHAR(10) DEFAULT 'USD',
    balance NUMERIC(18, 4) DEFAULT 10000.0000,
    leverage INT DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. INSTRUMENTS / SYMBOLS
CREATE TABLE IF NOT EXISTS instruments (
    symbol VARCHAR(30) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    asset_class VARCHAR(20) NOT NULL, -- 'forex', 'crypto', 'stock', 'commodity'
    base_currency VARCHAR(10),
    quote_currency VARCHAR(10),
    contract_size NUMERIC(18, 4) NOT NULL DEFAULT 1,
    digits INT NOT NULL DEFAULT 5,
    min_volume NUMERIC(18, 4) DEFAULT 0.01,
    max_volume NUMERIC(18, 4) DEFAULT 100.00,
    volume_step NUMERIC(18, 4) DEFAULT 0.01,
    is_active BOOLEAN DEFAULT TRUE
);

-- 4. MARKET CANDLES (OHLCV)
CREATE TABLE IF NOT EXISTS candles (
    symbol VARCHAR(30) NOT NULL,
    timeframe VARCHAR(10) NOT NULL, -- 'M1', 'M5', 'M15', 'H1', 'D1'
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    open NUMERIC(18, 6) NOT NULL,
    high NUMERIC(18, 6) NOT NULL,
    low NUMERIC(18, 6) NOT NULL,
    close NUMERIC(18, 6) NOT NULL,
    volume NUMERIC(24, 6) DEFAULT 0,
    provider VARCHAR(30) DEFAULT 'UNKNOWN',
    is_simulated BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (symbol, timeframe, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_candles_lookup 
ON candles (symbol, timeframe, timestamp DESC);

-- 5. ORDERS (Pending & executed market orders)
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(30) NOT NULL,
    side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
    order_type VARCHAR(20) NOT NULL, -- 'market', 'limit', 'stop'
    volume NUMERIC(18, 4) NOT NULL,
    price NUMERIC(18, 6),
    stop_loss NUMERIC(18, 6),
    take_profit NUMERIC(18, 6),
    status VARCHAR(20) DEFAULT 'pending', -- 'filled', 'canceled', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    filled_at TIMESTAMP WITH TIME ZONE
);

-- 6. POSITIONS (Open positions)
CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(30) NOT NULL,
    side VARCHAR(10) NOT NULL, -- 'buy', 'sell'
    volume NUMERIC(18, 4) NOT NULL,
    open_price NUMERIC(18, 6) NOT NULL,
    current_price NUMERIC(18, 6) NOT NULL,
    stop_loss NUMERIC(18, 6),
    take_profit NUMERIC(18, 6),
    unrealized_pnl NUMERIC(18, 4) DEFAULT 0,
    margin NUMERIC(18, 4) DEFAULT 0,
    is_simulated BOOLEAN DEFAULT FALSE,
    data_source VARCHAR(30) DEFAULT 'UNKNOWN',
    opened_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 7. TRADES (Closed historical trade ledger)
CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    symbol VARCHAR(30) NOT NULL,
    side VARCHAR(10) NOT NULL,
    volume NUMERIC(18, 4) NOT NULL,
    open_price NUMERIC(18, 6) NOT NULL,
    close_price NUMERIC(18, 6) NOT NULL,
    profit NUMERIC(18, 4) NOT NULL,
    close_reason VARCHAR(50), -- 'Take Profit', 'Stop Loss', 'Manual Close'
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 8. WATCHLISTS
CREATE TABLE IF NOT EXISTS watchlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) DEFAULT 'Default',
    symbols JSONB DEFAULT '[]'::jsonb
);

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
