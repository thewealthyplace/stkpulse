// Webhook delivery service with exponential backoff retry

import { Pool } from "pg";
import fetch from "node-fetch";
import { AlertEvent } from "@stkpulse/shared/alert-types";

export class WebhookService {
  constructor(private db: Pool) {}

  async deliverWebhook(alertEvent: AlertEvent, webhookUrl: string) {
    const payload = this.buildPayload(alertEvent);

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Alert-Id": alertEvent.alert_id,
          "X-Idempotency-Key": `${alertEvent.alert_id}-${alertEvent.tx_id}`,
        },
        body: JSON.stringify(payload),
        timeout: 10000,
      });

      if (response.ok) {
        await this.markWebhookSent(alertEvent.alert_id);
        return { success: true };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error: any) {
      await this.queueRetry(alertEvent, webhookUrl, error.message);
      return { success: false, error: error.message };
    }
  }

  private buildPayload(event: AlertEvent) {
    return {
      alert_id: event.alert_id,
      alert_name: event.alert_name,
      triggered_at: event.triggered_at,
      block_height: event.block_height,
      tx_id: event.tx_id,
      event: event.event,
    };
  }

  private async markWebhookSent(alertId: string) {
    await this.db.query(
      `UPDATE alert_history SET webhook_status = 'sent' 
       WHERE alert_id = $1 AND webhook_status = 'pending'`,
      [alertId]
    );
  }

  private async queueRetry(event: AlertEvent, webhookUrl: string, error: string) {
    const { rows } = await this.db.query(
      `SELECT id FROM alert_history 
       WHERE alert_id = $1 AND tx_id = $2 
       ORDER BY triggered_at DESC LIMIT 1`,
      [event.alert_id, event.tx_id]
    );

    if (rows.length > 0) {
      await this.db.query(
        `INSERT INTO webhook_queue (history_id, webhook_url, payload, last_error)
         VALUES ($1, $2, $3, $4)`,
        [rows[0].id, webhookUrl, JSON.stringify(this.buildPayload(event)), error]
      );
    }
  }

  async processRetryQueue() {
    const { rows } = await this.db.query(
      `SELECT * FROM webhook_queue 
       WHERE attempts < 3 AND next_retry_at <= NOW()
       ORDER BY next_retry_at ASC LIMIT 10`
    );

    for (const job of rows) {
      await this.retryWebhook(job);
    }
  }

  private async retryWebhook(job: any) {
    try {
      const response = await fetch(job.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(job.payload),
        timeout: 10000,
      });

      if (response.ok) {
        await this.db.query(`DELETE FROM webhook_queue WHERE id = $1`, [job.id]);
        await this.db.query(
          `UPDATE alert_history SET webhook_status = 'sent' WHERE id = $1`,
          [job.history_id]
        );
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error: any) {
      const nextAttempt = job.attempts + 1;
      const backoffMs = Math.pow(2, nextAttempt) * 1000;

      if (nextAttempt >= 3) {
        await this.db.query(
          `UPDATE alert_history SET webhook_status = 'failed' WHERE id = $1`,
          [job.history_id]
        );
        await this.db.query(`DELETE FROM webhook_queue WHERE id = $1`, [job.id]);
      } else {
        await this.db.query(
          `UPDATE webhook_queue 
           SET attempts = $1, next_retry_at = NOW() + INTERVAL '${backoffMs} milliseconds', last_error = $2
           WHERE id = $3`,
          [nextAttempt, error.message, job.id]
        );
      }
    }
  }
}
