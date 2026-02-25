// NFT sale monitor for NFT marketplace alerts

import { Pool } from "pg";
import { TransactionEvent } from "./websocketClient";

export class NFTSaleMonitor {
  constructor(private db: Pool) {}

  async evaluateNFTSale(tx: TransactionEvent) {
    if (tx.tx_type !== "contract_call") return [];

    const txData = tx.raw_tx;
    
    // Check if it's an NFT marketplace transaction
    const isNFTSale = this.isNFTMarketplaceTx(txData);
    if (!isNFTSale) return [];

    const saleData = this.extractSaleData(txData);
    if (!saleData) return [];

    const { rows } = await this.db.query(
      `SELECT * FROM alerts 
       WHERE condition_type = 'nft_sale' 
       AND is_active = true`
    );

    const triggeredAlerts = [];

    for (const alert of rows) {
      const condition = alert.condition_config;

      // Check collection filter
      if (condition.collection_id && condition.collection_id !== saleData.collection_id) {
        continue;
      }

      // Check price threshold
      if (condition.price_gte && saleData.price_stx < condition.price_gte) {
        continue;
      }

      triggeredAlerts.push({
        alert_id: alert.id,
        alert_name: alert.name,
        triggered_at: new Date().toISOString(),
        block_height: tx.block_height,
        tx_id: tx.tx_id,
        event: {
          type: "nft_sale",
          collection_id: saleData.collection_id,
          token_id: saleData.token_id,
          price_stx: saleData.price_stx,
          seller: saleData.seller,
          buyer: saleData.buyer,
        },
      });
    }

    return triggeredAlerts;
  }

  private isNFTMarketplaceTx(txData: any): boolean {
    const marketplaceContracts = [
      "gamma.io",
      "byzantion",
      "stacksart",
      "tradeport",
    ];

    return marketplaceContracts.some((marketplace) =>
      txData.contract_id?.includes(marketplace)
    );
  }

  private extractSaleData(txData: any) {
    try {
      // Extract NFT sale data from contract call
      // This is simplified - actual implementation would parse contract events
      return {
        collection_id: txData.contract_id,
        token_id: txData.function_args?.token_id || "unknown",
        price_stx: txData.function_args?.price || 0,
        seller: txData.function_args?.seller || txData.sender_address,
        buyer: txData.function_args?.buyer || "unknown",
      };
    } catch (err) {
      return null;
    }
  }
}
