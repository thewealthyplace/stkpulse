// Widget data service - fetches data for each widget type

import { Pool } from "pg";
import { WidgetType, Period } from "@stkpulse/shared/widget-types";

export class WidgetDataService {
  constructor(private db: Pool) {}

  async getSTXPrice(period: Period, currency: string = "USD") {
    const interval = this.periodToInterval(period);
    
    const { rows } = await this.db.query(
      `SELECT 
         recorded_at as timestamp,
         price_usd as price
       FROM token_prices
       WHERE contract_id = 'STX'
       AND recorded_at > NOW() - INTERVAL '${interval}'
       ORDER BY recorded_at ASC`,
      []
    );

    return {
      prices: rows,
      current: rows[rows.length - 1]?.price || 0,
      change_24h: this.calculateChange(rows),
    };
  }

  async getContractCalls(contract: string, period: Period) {
    const interval = this.periodToInterval(period);

    const { rows } = await this.db.query(
      `SELECT 
         DATE_TRUNC('hour', block_time) as timestamp,
         COUNT(*) as calls
       FROM transactions
       WHERE contract_id = $1
       AND tx_type = 'contract_call'
       AND block_time > NOW() - INTERVAL '${interval}'
       GROUP BY DATE_TRUNC('hour', block_time)
       ORDER BY timestamp ASC`,
      [contract]
    );

    return {
      calls: rows,
      total: rows.reduce((sum, r) => sum + parseInt(r.calls), 0),
    };
  }

  async getStackingCycle() {
    const { rows } = await this.db.query(
      `SELECT 
         cycle_number,
         start_block,
         end_block,
         total_stacked,
         btc_committed
       FROM stacking_cycles
       ORDER BY cycle_number DESC
       LIMIT 1`
    );

    if (rows.length === 0) return null;

    const cycle = rows[0];
    return {
      cycle_number: cycle.cycle_number,
      start_block: cycle.start_block,
      end_block: cycle.end_block,
      total_stacked: cycle.total_stacked,
      btc_committed: cycle.btc_committed,
      blocks_remaining: cycle.end_block - cycle.start_block,
    };
  }

  async getTokenPrice(contract: string, period: Period) {
    const interval = this.periodToInterval(period);

    const { rows } = await this.db.query(
      `SELECT 
         recorded_at as timestamp,
         price_usd as price
       FROM token_prices
       WHERE contract_id = $1
       AND recorded_at > NOW() - INTERVAL '${interval}'
       ORDER BY recorded_at ASC`,
      [contract]
    );

    return {
      prices: rows,
      current: rows[rows.length - 1]?.price || 0,
      change_24h: this.calculateChange(rows),
    };
  }

  async getTVL(protocol: string, period: Period) {
    const interval = this.periodToInterval(period);

    const { rows } = await this.db.query(
      `SELECT 
         snapped_at as timestamp,
         value_usd as tvl
       FROM protocol_tvl
       WHERE protocol = $1
       AND snapped_at > NOW() - INTERVAL '${interval}'
       ORDER BY snapped_at ASC`,
      [protocol]
    );

    return {
      tvl: rows,
      current: rows[rows.length - 1]?.tvl || 0,
    };
  }

  async getNFTFloor(collection: string, period: Period) {
    const interval = this.periodToInterval(period);

    const { rows } = await this.db.query(
      `SELECT 
         DATE_TRUNC('day', block_time) as timestamp,
         MIN(amount) as floor_price
       FROM transactions
       WHERE contract_id = $1
       AND tx_type = 'nft_sale'
       AND block_time > NOW() - INTERVAL '${interval}'
       GROUP BY DATE_TRUNC('day', block_time)
       ORDER BY timestamp ASC`,
      [collection]
    );

    return {
      floors: rows,
      current: rows[rows.length - 1]?.floor_price || 0,
    };
  }

  private periodToInterval(period: Period): string {
    const map = {
      "24h": "1 day",
      "7d": "7 days",
      "30d": "30 days",
      "1y": "1 year",
    };
    return map[period];
  }

  private calculateChange(rows: any[]): number {
    if (rows.length < 2) return 0;
    const first = parseFloat(rows[0].price);
    const last = parseFloat(rows[rows.length - 1].price);
    return ((last - first) / first) * 100;
  }
}
