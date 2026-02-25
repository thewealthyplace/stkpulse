// Alert history cleanup job - removes alerts older than 90 days

import { Pool } from "pg";

export class AlertHistoryCleanup {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly RETENTION_DAYS = 90;

  constructor(private db: Pool) {}

  start() {
    // Run cleanup daily at 2 AM
    const runCleanup = async () => {
      await this.cleanup();
    };

    // Run immediately on start
    runCleanup();

    // Schedule daily cleanup (every 24 hours)
    this.cleanupInterval = setInterval(runCleanup, 24 * 60 * 60 * 1000);
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async cleanup() {
    try {
      const { rowCount } = await this.db.query(
        `DELETE FROM alert_history 
         WHERE triggered_at < NOW() - INTERVAL '${this.RETENTION_DAYS} days'`
      );

      console.log(`[AlertHistoryCleanup] Removed ${rowCount} old alert records`);

      // Also cleanup old webhook queue entries
      await this.db.query(
        `DELETE FROM webhook_queue 
         WHERE created_at < NOW() - INTERVAL '7 days'`
      );
    } catch (err) {
      console.error("[AlertHistoryCleanup] Error:", err);
    }
  }

  async getStorageStats() {
    const { rows } = await this.db.query(`
      SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '24 hours') as last_24h,
        COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '7 days') as last_7d,
        COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '30 days') as last_30d,
        pg_size_pretty(pg_total_relation_size('alert_history')) as table_size
      FROM alert_history
    `);

    return rows[0];
  }
}
