// Alert engine - evaluates conditions against blockchain events

import { Pool } from "pg";
import { Alert, AlertCondition, AlertEvent } from "@stkpulse/shared/alert-types";
import { TransactionEvent } from "./websocketClient";

export class AlertEngine {
  constructor(private db: Pool) {}

  async evaluateTransaction(tx: TransactionEvent): Promise<AlertEvent[]> {
    const activeAlerts = await this.getActiveAlerts();
    const triggeredAlerts: AlertEvent[] = [];

    for (const alert of activeAlerts) {
      if (await this.shouldTrigger(alert, tx)) {
        const event = await this.createAlertEvent(alert, tx);
        triggeredAlerts.push(event);
        await this.recordTrigger(alert.id, event);
      }
    }

    return triggeredAlerts;
  }

  private async getActiveAlerts(): Promise<Alert[]> {
    const { rows } = await this.db.query<Alert>(
      `SELECT * FROM alerts WHERE is_active = true`
    );
    return rows;
  }

  private async shouldTrigger(alert: Alert, tx: TransactionEvent): Promise<boolean> {
    // Check cooldown
    if (alert.last_triggered_at && alert.cooldown_minutes > 0) {
      const cooldownMs = alert.cooldown_minutes * 60 * 1000;
      const timeSinceLastTrigger = Date.now() - new Date(alert.last_triggered_at).getTime();
      if (timeSinceLastTrigger < cooldownMs) return false;
    }

    const condition = alert.condition_config as AlertCondition;

    switch (condition.type) {
      case "token_transfer":
        return this.evaluateTokenTransfer(condition, tx);
      case "contract_call":
        return this.evaluateContractCall(condition, tx);
      case "wallet_activity":
        return this.evaluateWalletActivity(condition, tx);
      default:
        return false;
    }
  }

  private evaluateTokenTransfer(condition: any, tx: TransactionEvent): boolean {
    if (tx.tx_type !== "token_transfer") return false;

    const txData = tx.raw_tx;
    if (condition.asset && txData.asset !== condition.asset) return false;

    if (condition.amount_gte && txData.amount < condition.amount_gte) return false;

    if (condition.direction === "sent" && txData.sender !== condition.from_address) return false;
    if (condition.direction === "received" && txData.recipient !== condition.to_address) return false;

    return true;
  }

  private evaluateContractCall(condition: any, tx: TransactionEvent): boolean {
    if (tx.tx_type !== "contract_call") return false;

    const txData = tx.raw_tx;
    if (condition.contract_id && txData.contract_id !== condition.contract_id) return false;
    if (condition.function_name && txData.function_name !== condition.function_name) return false;

    return true;
  }

  private evaluateWalletActivity(condition: any, tx: TransactionEvent): boolean {
    const txData = tx.raw_tx;
    return (
      txData.sender === condition.watched_address ||
      txData.recipient === condition.watched_address
    );
  }

  private async createAlertEvent(alert: Alert, tx: TransactionEvent): Promise<AlertEvent> {
    return {
      alert_id: alert.id,
      alert_name: alert.name,
      triggered_at: new Date().toISOString(),
      block_height: tx.block_height,
      tx_id: tx.tx_id,
      event: tx.raw_tx,
    };
  }

  private async recordTrigger(alertId: string, event: AlertEvent) {
    await this.db.query(
      `UPDATE alerts SET last_triggered_at = NOW() WHERE id = $1`,
      [alertId]
    );

    await this.db.query(
      `INSERT INTO alert_history (alert_id, block_height, tx_id, event_data, webhook_status, email_status)
       VALUES ($1, $2, $3, $4, 'pending', 'pending')`,
      [alertId, event.block_height, event.tx_id, JSON.stringify(event.event)]
    );
  }
}
