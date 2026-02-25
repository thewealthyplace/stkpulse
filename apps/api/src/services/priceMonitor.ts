// Price monitoring service for price threshold alerts

import { Pool } from "pg";
import { EventEmitter } from "events";

export interface PriceUpdate {
  contract_id: string;
  price_usd: number;
  previous_price?: number;
}

export class PriceMonitor extends EventEmitter {
  private priceCache: Map<string, number> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(private db: Pool, private intervalMs: number = 60000) {
    super();
  }

  start() {
    this.monitorInterval = setInterval(() => {
      this.checkPrices();
    }, this.intervalMs);
    
    // Initial check
    this.checkPrices();
  }

  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  private async checkPrices() {
    const { rows } = await this.db.query(
      `SELECT DISTINCT contract_id FROM token_balances WHERE balance > 0`
    );

    for (const { contract_id } of rows) {
      await this.checkAssetPrice(contract_id);
    }
  }

  private async checkAssetPrice(contractId: string) {
    const { rows } = await this.db.query(
      `SELECT price_usd FROM token_prices 
       WHERE contract_id = $1 
       ORDER BY recorded_at DESC 
       LIMIT 1`,
      [contractId]
    );

    if (rows.length === 0) return;

    const currentPrice = parseFloat(rows[0].price_usd);
    const previousPrice = this.priceCache.get(contractId);

    if (previousPrice !== undefined && currentPrice !== previousPrice) {
      this.emit("price_change", {
        contract_id: contractId,
        price_usd: currentPrice,
        previous_price: previousPrice,
      } as PriceUpdate);
    }

    this.priceCache.set(contractId, currentPrice);
  }

  async evaluatePriceAlerts(priceUpdate: PriceUpdate) {
    const { rows } = await this.db.query(
      `SELECT * FROM alerts 
       WHERE condition_type = 'price_threshold' 
       AND is_active = true`
    );

    const triggeredAlerts = [];

    for (const alert of rows) {
      const condition = alert.condition_config;
      
      if (condition.asset !== priceUpdate.contract_id) continue;

      const shouldTrigger = this.evaluatePriceCondition(
        condition.operator,
        priceUpdate.price_usd,
        condition.price_usd
      );

      if (shouldTrigger) {
        triggeredAlerts.push({
          alert_id: alert.id,
          alert_name: alert.name,
          triggered_at: new Date().toISOString(),
          event: {
            type: "price_threshold",
            asset: priceUpdate.contract_id,
            current_price: priceUpdate.price_usd,
            threshold_price: condition.price_usd,
            operator: condition.operator,
          },
        });
      }
    }

    return triggeredAlerts;
  }

  private evaluatePriceCondition(
    operator: string,
    currentPrice: number,
    thresholdPrice: number
  ): boolean {
    switch (operator) {
      case "gt":
        return currentPrice > thresholdPrice;
      case "lt":
        return currentPrice < thresholdPrice;
      case "gte":
        return currentPrice >= thresholdPrice;
      case "lte":
        return currentPrice <= thresholdPrice;
      default:
        return false;
    }
  }
}
