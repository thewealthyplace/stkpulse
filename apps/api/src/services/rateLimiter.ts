// Rate limiter for alert system - max 100 alerts per user per day

import { Pool } from "pg";

export class AlertRateLimiter {
  private readonly MAX_ALERTS_PER_DAY = 100;

  constructor(private db: Pool) {}

  async checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*) as count 
       FROM alert_history ah
       JOIN alerts a ON ah.alert_id = a.id
       WHERE a.user_id = $1 
       AND ah.triggered_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    const count = parseInt(rows[0].count);
    const remaining = Math.max(0, this.MAX_ALERTS_PER_DAY - count);

    return {
      allowed: count < this.MAX_ALERTS_PER_DAY,
      remaining,
    };
  }

  async recordAlert(userId: string): Promise<void> {
    // Alert is already recorded in alert_history by the engine
    // This method can be used for additional rate limit tracking if needed
  }

  async getUserAlertStats(userId: string) {
    const { rows } = await this.db.query(
      `SELECT 
         COUNT(*) as total_today,
         COUNT(*) FILTER (WHERE webhook_status = 'sent') as webhooks_sent,
         COUNT(*) FILTER (WHERE email_status = 'sent') as emails_sent
       FROM alert_history ah
       JOIN alerts a ON ah.alert_id = a.id
       WHERE a.user_id = $1 
       AND ah.triggered_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    return rows[0];
  }
}
