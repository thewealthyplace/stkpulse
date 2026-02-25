-- Alert system schema for real-time on-chain event monitoring

-- ── Alerts Configuration ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alerts (
  id                TEXT PRIMARY KEY DEFAULT 'alrt_' || substr(md5(random()::text), 1, 10),
  user_id           TEXT NOT NULL,
  name              TEXT NOT NULL,
  condition_type    TEXT NOT NULL,  -- token_transfer | contract_call | wallet_activity | price_threshold | stacking_cycle | nft_sale
  condition_config  JSONB NOT NULL,
  notify_webhook    TEXT,
  notify_email      TEXT,
  notify_in_app     BOOLEAN DEFAULT true,
  cooldown_minutes  INT DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  is_active         BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts (user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts (condition_type, is_active);

-- ── Alert History ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alert_history (
  id              BIGSERIAL PRIMARY KEY,
  alert_id        TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  triggered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  block_height    INT,
  tx_id           TEXT,
  event_data      JSONB NOT NULL,
  webhook_status  TEXT,  -- pending | sent | failed
  webhook_attempts INT DEFAULT 0,
  email_status    TEXT,  -- pending | sent | failed
  in_app_read     BOOLEAN DEFAULT false
);

SELECT create_hypertable('alert_history', 'triggered_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_history_alert ON alert_history (alert_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_history_webhook ON alert_history (webhook_status, triggered_at) WHERE webhook_status = 'pending';

-- ── Webhook Retry Queue ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_queue (
  id              BIGSERIAL PRIMARY KEY,
  history_id      BIGINT NOT NULL REFERENCES alert_history(id) ON DELETE CASCADE,
  webhook_url     TEXT NOT NULL,
  payload         JSONB NOT NULL,
  attempts        INT DEFAULT 0,
  next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_retry ON webhook_queue (next_retry_at) WHERE attempts < 3;
