// fifoEngine.ts — FIFO cost basis and realized PnL calculation
//
// Algorithm:
//  - Every "in" transaction creates a FIFO lot (amount, cost_basis_usd/unit).
//  - Every "out" transaction (sell / swap out) consumes lots oldest-first.
//  - Realized PnL = sum over consumed lots of (sale_price - cost_basis) * amount.
//  - Unrealized PnL = sum over remaining lots of (current_price - cost_basis) * remaining.

import type { Pool, PoolClient } from "pg";
import type { AssetPnL, FIFOLot, PortfolioPnL } from "@stkpulse/shared";
import { getPrice } from "./priceService";

// ── Lot Management ─────────────────────────────────────────────────────

export async function recordAcquisition(
  client: PoolClient,
  address: string,
  contractId: string,
  txId: string,
  acquiredAt: Date,
  amount: number,
  priceUsdPerUnit: number
): Promise<void> {
  await client.query(
    `INSERT INTO fifo_lots
       (address, contract_id, tx_id, acquired_at, amount, cost_basis_usd, remaining_amount)
     VALUES ($1, $2, $3, $4, $5, $6, $6 * $5)
     ON CONFLICT (tx_id, address, contract_id) DO NOTHING`,
    [address, contractId, txId, acquiredAt, amount, priceUsdPerUnit]
  );
  // Note: remaining_amount = amount (fully available at acquisition)
}

export async function consumeLots(
  client: PoolClient,
  address: string,
  contractId: string,
  disposeTxId: string,
  disposedAt: Date,
  amount: number,
  salePriceUsd: number
): Promise<number> {
  // Fetch lots oldest-first (FIFO)
  const { rows: lots } = await client.query<{
    id: string;
    remaining_amount: string;
    cost_basis_usd: string;
    tx_id: string;
  }>(
    `SELECT id, remaining_amount, cost_basis_usd, tx_id
     FROM fifo_lots
     WHERE address = $1 AND contract_id = $2 AND remaining_amount > 0
     ORDER BY acquired_at ASC`,
    [address, contractId]
  );

  let remaining = amount;
  let totalPnl  = 0;

  for (const lot of lots) {
    if (remaining <= 0) break;

    const available  = Number(lot.remaining_amount);
    const costBasis  = Number(lot.cost_basis_usd);
    const consumed   = Math.min(available, remaining);
    const pnl        = (salePriceUsd - costBasis) * consumed;

    // Reduce lot remaining
    await client.query(
      `UPDATE fifo_lots SET remaining_amount = remaining_amount - $1 WHERE id = $2`,
      [consumed, lot.id]
    );

    // Record realized PnL event
    await client.query(
      `INSERT INTO realized_pnl
         (address, contract_id, dispose_tx_id, acquire_tx_id, disposed_at, amount, cost_basis_usd, sale_price_usd, pnl_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (dispose_tx_id, acquire_tx_id, address) DO NOTHING`,
      [address, contractId, disposeTxId, lot.tx_id, disposedAt, consumed, costBasis, salePriceUsd, pnl]
    );

    totalPnl  += pnl;
    remaining -= consumed;
  }

  return totalPnl;
}

// ── PnL Aggregation ───────────────────────────────────────────────────

export async function computeAssetPnL(
  db: Pool,
  address: string,
  contractId: string
): Promise<AssetPnL> {
  const currentPrice = await getPrice(contractId);

  // Realized PnL
  const { rows: realized } = await db.query<{ total: string }>(
    `SELECT COALESCE(SUM(pnl_usd), 0) AS total
     FROM realized_pnl
     WHERE address = $1 AND contract_id = $2`,
    [address, contractId]
  );
  const realizedPnl = Number(realized[0].total);

  // Unrealized PnL from remaining lots
  const { rows: lots } = await db.query<{
    tx_id: string;
    acquired_at: string;
    amount: string;
    cost_basis_usd: string;
    remaining_amount: string;
  }>(
    `SELECT tx_id, acquired_at, amount, cost_basis_usd, remaining_amount
     FROM fifo_lots
     WHERE address = $1 AND contract_id = $2 AND remaining_amount > 0
     ORDER BY acquired_at ASC`,
    [address, contractId]
  );

  let unrealizedPnl   = 0;
  let totalCost       = 0;
  let totalRemaining  = 0;

  const fifoLots: FIFOLot[] = lots.map(l => {
    const remaining = Number(l.remaining_amount);
    const costBasis = Number(l.cost_basis_usd);
    unrealizedPnl  += (currentPrice - costBasis) * remaining;
    totalCost      += costBasis * remaining;
    totalRemaining += remaining;
    return {
      txId:            l.tx_id,
      timestamp:       l.acquired_at,
      amount:          Number(l.amount),
      costBasisUsd:    costBasis,
      remainingAmount: remaining,
    };
  });

  const avgCostBasis = totalRemaining > 0 ? totalCost / totalRemaining : 0;
  const currentValue = totalRemaining * currentPrice;
  const unrealizedPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;

  // Totals bought / sold
  const { rows: totals } = await db.query<{ bought: string; sold: string; sym: string }>(
    `SELECT
       COALESCE(SUM(CASE WHEN direction = 'in' THEN amount ELSE 0 END), 0) AS bought,
       COALESCE(SUM(CASE WHEN direction = 'out' THEN amount ELSE 0 END), 0) AS sold,
       MAX(token_symbol) AS sym
     FROM transactions
     WHERE address = $1 AND contract_id = $2`,
    [address, contractId]
  );

  return {
    contractId,
    symbol:           totals[0]?.sym ?? contractId,
    totalBought:      Number(totals[0]?.bought ?? 0),
    totalSold:        Number(totals[0]?.sold ?? 0),
    realizedPnlUsd:   realizedPnl,
    unrealizedPnlUsd: unrealizedPnl,
    unrealizedPnlPct: unrealizedPct,
    averageCostBasis: avgCostBasis,
    currentPrice,
    lots:             fifoLots,
  };
  void currentValue;
}

export async function computePortfolioPnL(
  db: Pool,
  address: string
): Promise<PortfolioPnL> {
  // Get all unique contract IDs for this wallet
  const { rows } = await db.query<{ contract_id: string }>(
    `SELECT DISTINCT contract_id FROM transactions WHERE address = $1`,
    [address]
  );

  const assets = await Promise.all(
    rows.map(r => computeAssetPnL(db, address, r.contract_id))
  );

  return {
    address,
    totalRealizedPnl:   assets.reduce((s, a) => s + a.realizedPnlUsd, 0),
    totalUnrealizedPnl: assets.reduce((s, a) => s + a.unrealizedPnlUsd, 0),
    totalPnl:           assets.reduce((s, a) => s + a.realizedPnlUsd + a.unrealizedPnlUsd, 0),
    assets,
    calculatedAt:       new Date().toISOString(),
  };
}
