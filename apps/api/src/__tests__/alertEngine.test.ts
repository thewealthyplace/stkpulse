// Test suite for alert engine

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { AlertEngine } from "../services/alertEngine";

describe("AlertEngine", () => {
  let db: Pool;
  let engine: AlertEngine;

  beforeEach(async () => {
    db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    engine = new AlertEngine(db);

    // Setup test data
    await db.query(`
      INSERT INTO alerts (id, user_id, name, condition_type, condition_config, is_active)
      VALUES 
        ('test-1', 'user-1', 'Large Transfer', 'token_transfer', 
         '{"type":"token_transfer","asset":"STX","direction":"any","amount_gte":100000}', true),
        ('test-2', 'user-1', 'Contract Call', 'contract_call',
         '{"type":"contract_call","contract_id":"SP123.contract","function_name":"vote"}', true)
    `);
  });

  afterEach(async () => {
    await db.query("DELETE FROM alerts WHERE id LIKE 'test-%'");
    await db.end();
  });

  it("should trigger alert for large token transfer", async () => {
    const tx = {
      type: "transaction",
      tx_id: "0xabc123",
      block_height: 100000,
      tx_type: "token_transfer",
      sender_address: "SP1ABC",
      raw_tx: {
        asset: "STX",
        amount: 150000,
        sender: "SP1ABC",
        recipient: "SP2DEF",
      },
    };

    const alerts = await engine.evaluateTransaction(tx as any);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].alert_name).toBe("Large Transfer");
  });

  it("should not trigger alert below threshold", async () => {
    const tx = {
      type: "transaction",
      tx_id: "0xabc124",
      block_height: 100001,
      tx_type: "token_transfer",
      sender_address: "SP1ABC",
      raw_tx: {
        asset: "STX",
        amount: 50000,
        sender: "SP1ABC",
        recipient: "SP2DEF",
      },
    };

    const alerts = await engine.evaluateTransaction(tx as any);
    expect(alerts.length).toBe(0);
  });

  it("should respect cooldown period", async () => {
    await db.query(
      `UPDATE alerts SET last_triggered_at = NOW(), cooldown_minutes = 60 WHERE id = 'test-1'`
    );

    const tx = {
      type: "transaction",
      tx_id: "0xabc125",
      block_height: 100002,
      tx_type: "token_transfer",
      sender_address: "SP1ABC",
      raw_tx: {
        asset: "STX",
        amount: 150000,
        sender: "SP1ABC",
        recipient: "SP2DEF",
      },
    };

    const alerts = await engine.evaluateTransaction(tx as any);
    expect(alerts.length).toBe(0);
  });
});
