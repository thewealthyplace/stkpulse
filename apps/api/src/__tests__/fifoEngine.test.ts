// Unit tests for the FIFO cost basis engine (pure calculation logic)
// Tests the lot-management and PnL calculation algorithms without DB.

import { describe, it, expect } from "vitest";

// ── Pure FIFO logic (extracted for unit testing) ─────────────────────

interface Lot {
  txId:            string;
  acquiredAt:      Date;
  amount:          number;
  costBasisPerUnit: number;
  remaining:       number;
}

interface RealizedEvent {
  disposeTxId:  string;
  acquireTxId:  string;
  amount:       number;
  costBasis:    number;
  salePrice:    number;
  pnl:          number;
}

function consumeLotsFIFO(
  lots:        Lot[],
  disposeTxId: string,
  amount:      number,
  salePrice:   number
): { realized: RealizedEvent[]; remaining: number } {
  const sortedLots  = [...lots].sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime());
  const realized: RealizedEvent[] = [];
  let   remaining   = amount;

  for (const lot of sortedLots) {
    if (remaining <= 0) break;
    if (lot.remaining <= 0) continue;

    const consumed = Math.min(lot.remaining, remaining);
    const pnl      = (salePrice - lot.costBasisPerUnit) * consumed;

    realized.push({
      disposeTxId,
      acquireTxId:  lot.txId,
      amount:       consumed,
      costBasis:    lot.costBasisPerUnit,
      salePrice,
      pnl,
    });

    lot.remaining -= consumed;
    remaining     -= consumed;
  }

  return { realized, remaining };
}

function computeUnrealizedPnL(lots: Lot[], currentPrice: number): number {
  return lots.reduce((sum, lot) => {
    return sum + (currentPrice - lot.costBasisPerUnit) * lot.remaining;
  }, 0);
}

function computeAverageCostBasis(lots: Lot[]): number {
  const totalCost  = lots.reduce((s, l) => s + l.costBasisPerUnit * l.remaining, 0);
  const totalUnits = lots.reduce((s, l) => s + l.remaining, 0);
  return totalUnits > 0 ? totalCost / totalUnits : 0;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("FIFO cost basis engine", () => {

  it("creates a single lot and holds full remaining", () => {
    const lots: Lot[] = [{
      txId: "tx1", acquiredAt: new Date("2024-01-01"),
      amount: 100, costBasisPerUnit: 1.0, remaining: 100,
    }];
    expect(lots[0].remaining).toBe(100);
  });

  it("consumes oldest lot first (FIFO order)", () => {
    const lots: Lot[] = [
      { txId: "tx2", acquiredAt: new Date("2024-01-02"), amount: 50, costBasisPerUnit: 2.0, remaining: 50 },
      { txId: "tx1", acquiredAt: new Date("2024-01-01"), amount: 50, costBasisPerUnit: 1.0, remaining: 50 },
    ];
    const { realized } = consumeLotsFIFO(lots, "tx-sell-1", 50, 1.5);
    expect(realized[0].acquireTxId).toBe("tx1");   // oldest consumed first
    expect(realized[0].costBasis).toBe(1.0);
    expect(realized[0].pnl).toBeCloseTo(25.0);     // (1.5 - 1.0) * 50
  });

  it("splits across multiple lots when sell exceeds single lot", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date("2024-01-01"), amount: 30, costBasisPerUnit: 1.0, remaining: 30 },
      { txId: "tx2", acquiredAt: new Date("2024-01-02"), amount: 50, costBasisPerUnit: 2.0, remaining: 50 },
    ];
    const { realized } = consumeLotsFIFO(lots, "tx-sell-2", 60, 3.0);
    expect(realized.length).toBe(2);
    // First lot: 30 units at $1 sold at $3 → pnl = $60
    expect(realized[0].amount).toBe(30);
    expect(realized[0].pnl).toBeCloseTo(60);
    // Second lot: 30 units at $2 sold at $3 → pnl = $30
    expect(realized[1].amount).toBe(30);
    expect(realized[1].pnl).toBeCloseTo(30);
  });

  it("reduces lot remaining after consumption", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date("2024-01-01"), amount: 100, costBasisPerUnit: 1.0, remaining: 100 },
    ];
    consumeLotsFIFO(lots, "tx-sell", 40, 2.0);
    expect(lots[0].remaining).toBe(60);
  });

  it("returns correct remaining when sell exceeds available lots", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date(), amount: 50, costBasisPerUnit: 1.0, remaining: 50 },
    ];
    const { remaining } = consumeLotsFIFO(lots, "tx-sell", 80, 2.0);
    expect(remaining).toBe(30);  // 30 units unsatisfied
  });

  it("computes correct unrealized PnL when price rises", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date(), amount: 100, costBasisPerUnit: 1.0, remaining: 100 },
    ];
    const unrealized = computeUnrealizedPnL(lots, 1.5);
    expect(unrealized).toBeCloseTo(50.0);   // (1.5-1.0)*100
  });

  it("computes negative unrealized PnL when price drops", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date(), amount: 100, costBasisPerUnit: 2.0, remaining: 100 },
    ];
    const unrealized = computeUnrealizedPnL(lots, 1.5);
    expect(unrealized).toBeCloseTo(-50.0);  // (1.5-2.0)*100
  });

  it("computes zero unrealized PnL when price equals cost basis", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date(), amount: 200, costBasisPerUnit: 3.0, remaining: 200 },
    ];
    expect(computeUnrealizedPnL(lots, 3.0)).toBe(0);
  });

  it("averageCostBasis weighted by remaining amount", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date(), amount: 100, costBasisPerUnit: 1.0, remaining: 100 },
      { txId: "tx2", acquiredAt: new Date(), amount: 100, costBasisPerUnit: 3.0, remaining: 100 },
    ];
    expect(computeAverageCostBasis(lots)).toBeCloseTo(2.0);
  });

  it("averageCostBasis returns 0 for empty lots", () => {
    expect(computeAverageCostBasis([])).toBe(0);
  });

  it("realized PnL is 0 when sale price equals cost basis", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date(), amount: 50, costBasisPerUnit: 5.0, remaining: 50 },
    ];
    const { realized } = consumeLotsFIFO(lots, "sell", 50, 5.0);
    expect(realized[0].pnl).toBeCloseTo(0);
  });

  it("handles zero-remaining lots gracefully", () => {
    const lots: Lot[] = [
      { txId: "tx1", acquiredAt: new Date("2024-01-01"), amount: 50, costBasisPerUnit: 1.0, remaining: 0 },
      { txId: "tx2", acquiredAt: new Date("2024-01-02"), amount: 50, costBasisPerUnit: 2.0, remaining: 50 },
    ];
    const { realized } = consumeLotsFIFO(lots, "sell", 20, 3.0);
    expect(realized[0].acquireTxId).toBe("tx2");  // skips zero-remaining lot
  });
});
