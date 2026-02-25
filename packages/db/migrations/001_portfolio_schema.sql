-- stkpulse portfolio tracker schema
-- Uses TimescaleDB hypertables for time-series data

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- ── Wallets ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wallets (
  address       TEXT PRIMARY KEY,
  label         TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  sync_status   TEXT NOT NULL DEFAULT 'pending'  -- pending | syncing | done | error
);

-- ── Token Balances ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_balances (
  address        TEXT NOT NULL,
  contract_id    TEXT NOT NULL,     -- "STX" for native, "contract.token-name" for SIP-010
  symbol         TEXT NOT NULL,
  decimals       INT NOT NULL DEFAULT 6,
  balance        NUMERIC NOT NULL DEFAULT 0,
  price_usd      NUMERIC,
  value_usd      NUMERIC,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (address, contract_id)
);

-- ── Transactions ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
  tx_id          TEXT NOT NULL,
  address        TEXT NOT NULL,
  block_height   INT NOT NULL,
  block_time     TIMESTAMPTZ NOT NULL,
  tx_type        TEXT NOT NULL,       -- token_transfer_in/out | swap | airdrop | etc.
  contract_id    TEXT NOT NULL,
  token_symbol   TEXT NOT NULL,
  amount         NUMERIC NOT NULL,
  price_usd_at_tx NUMERIC,
  value_usd      NUMERIC,
  direction      TEXT NOT NULL,       -- in | out | neutral
  counterparty   TEXT,
  memo           TEXT,
  raw_tx         JSONB,
  PRIMARY KEY (tx_id, address)
);

-- TimescaleDB hypertable on block_time for efficient range queries
SELECT create_hypertable('transactions', 'block_time', if_not_exists => TRUE);

-- Index for wallet transaction lookups
CREATE INDEX IF NOT EXISTS idx_txns_address_time ON transactions (address, block_time DESC);
CREATE INDEX IF NOT EXISTS idx_txns_contract     ON transactions (address, contract_id, block_time DESC);

-- ── FIFO Cost Basis Lots ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fifo_lots (
  id               BIGSERIAL PRIMARY KEY,
  address          TEXT NOT NULL,
  contract_id      TEXT NOT NULL,
  tx_id            TEXT NOT NULL,
  acquired_at      TIMESTAMPTZ NOT NULL,
  amount           NUMERIC NOT NULL,       -- total units acquired
  cost_basis_usd   NUMERIC NOT NULL,       -- per-unit cost in USD
  remaining_amount NUMERIC NOT NULL,       -- not yet disposed
  UNIQUE (tx_id, address, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_lots_address_contract ON fifo_lots (address, contract_id, acquired_at ASC);

-- ── Realized PnL Events ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS realized_pnl (
  id              BIGSERIAL PRIMARY KEY,
  address         TEXT NOT NULL,
  contract_id     TEXT NOT NULL,
  dispose_tx_id   TEXT NOT NULL,
  acquire_tx_id   TEXT NOT NULL,
  disposed_at     TIMESTAMPTZ NOT NULL,
  amount          NUMERIC NOT NULL,
  cost_basis_usd  NUMERIC NOT NULL,    -- per-unit at acquisition
  sale_price_usd  NUMERIC NOT NULL,    -- per-unit at disposal
  pnl_usd         NUMERIC NOT NULL,
  UNIQUE (dispose_tx_id, acquire_tx_id, address)
);

SELECT create_hypertable('realized_pnl', 'disposed_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_pnl_address ON realized_pnl (address, disposed_at DESC);

-- ── Portfolio Value Snapshots ─────────────────────────────────────────
-- One row per wallet per hour for the value chart

CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  address    TEXT NOT NULL,
  snapped_at TIMESTAMPTZ NOT NULL,
  value_usd  NUMERIC NOT NULL,
  PRIMARY KEY (address, snapped_at)
);

SELECT create_hypertable('portfolio_snapshots', 'snapped_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_snapshots_address ON portfolio_snapshots (address, snapped_at DESC);

-- ── Token Price Cache ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS token_prices (
  contract_id TEXT NOT NULL,
  price_usd   NUMERIC NOT NULL,
  source      TEXT NOT NULL,    -- coingecko | alex | bitflow | manual
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (contract_id, recorded_at)
);

SELECT create_hypertable('token_prices', 'recorded_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_prices_contract ON token_prices (contract_id, recorded_at DESC);
