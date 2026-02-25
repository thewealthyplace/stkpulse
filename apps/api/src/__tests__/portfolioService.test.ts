// Integration-style tests for the portfolio service helper logic
// Uses mock DB rows to validate snapshot aggregation and history shaping.

import { describe, it, expect } from "vitest";

// ── Inline helpers mirroring the real service logic ──────────────────────────

interface RawToken {
  contract_id:    string;
  symbol:         string;
  name:           string;
  balance_micro:  string;
  decimals:       number;
  price_usd:      string;
  change_24h_pct: string | null;
  is_sbtc:        boolean;
  is_sip010:      boolean;
}

function buildTokenBalance(row: RawToken) {
  const balance  = Number(row.balance_micro) / Math.pow(10, row.decimals);
  const price    = Number(row.price_usd);
  const valueUsd = balance * price;
  return {
    contractId:       row.contract_id,
    symbol:           row.symbol,
    name:             row.name,
    balance,
    balanceFormatted: balance.toLocaleString("en-US", { maximumFractionDigits: 6 }),
    priceUsd:         price,
    valueUsd,
    change24hPct:     row.change_24h_pct != null ? Number(row.change_24h_pct) : null,
    isSBTC:           row.is_sbtc,
    isSIP010:         row.is_sip010,
  };
}

function totalValueUsd(tokens: ReturnType<typeof buildTokenBalance>[]) {
  return tokens.reduce((s, t) => s + t.valueUsd, 0);
}

interface HistoryRow {
  snapshot_time: string;
  total_value_usd: string;
}

function buildHistoryPoints(rows: HistoryRow[]) {
  return rows.map(r => ({
    timestamp: r.snapshot_time,
    valueUsd:  Number(r.total_value_usd),
  }));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("portfolio service helpers", () => {

  it("converts micro-balance to human balance using decimals", () => {
    const row: RawToken = {
      contract_id: "SP.stx", symbol: "STX", name: "Stacks", decimals: 6,
      balance_micro: "5000000", price_usd: "1.50", change_24h_pct: "2.5",
      is_sbtc: false, is_sip010: false,
    };
    const token = buildTokenBalance(row);
    expect(token.balance).toBeCloseTo(5);
    expect(token.valueUsd).toBeCloseTo(7.5);
  });

  it("handles sBTC with 8 decimals correctly", () => {
    const row: RawToken = {
      contract_id: "SP.sbtc", symbol: "sBTC", name: "sBTC", decimals: 8,
      balance_micro: "100000000", price_usd: "65000", change_24h_pct: null,
      is_sbtc: true, is_sip010: true,
    };
    const token = buildTokenBalance(row);
    expect(token.balance).toBeCloseTo(1);
    expect(token.valueUsd).toBeCloseTo(65000);
    expect(token.change24hPct).toBeNull();
    expect(token.isSBTC).toBe(true);
  });

  it("sums total portfolio value from all token balances", () => {
    const rows: RawToken[] = [
      { contract_id: "a", symbol: "STX", name: "Stacks", decimals: 6,
        balance_micro: "10000000", price_usd: "1.0", change_24h_pct: null,
        is_sbtc: false, is_sip010: false },
      { contract_id: "b", symbol: "ALEX", name: "ALEX", decimals: 6,
        balance_micro: "5000000", price_usd: "2.0", change_24h_pct: "1.1",
        is_sbtc: false, is_sip010: true },
    ];
    const tokens = rows.map(buildTokenBalance);
    const total  = totalValueUsd(tokens);
    expect(total).toBeCloseTo(20);   // 10 * 1 + 5 * 2
  });

  it("returns empty total for empty token list", () => {
    expect(totalValueUsd([])).toBe(0);
  });

  it("formats large balance with comma separators", () => {
    const row: RawToken = {
      contract_id: "c", symbol: "TOKEN", name: "Token", decimals: 0,
      balance_micro: "1000000", price_usd: "0.01", change_24h_pct: null,
      is_sbtc: false, is_sip010: true,
    };
    const token = buildTokenBalance(row);
    expect(token.balanceFormatted).toBe("1,000,000");
  });

  it("sorts tokens by value descending when consumer sorts", () => {
    const rows: RawToken[] = [
      { contract_id: "low",  symbol: "LOW",  name: "Low",  decimals: 6, balance_micro: "1000000",  price_usd: "1",    change_24h_pct: null, is_sbtc: false, is_sip010: false },
      { contract_id: "high", symbol: "HIGH", name: "High", decimals: 6, balance_micro: "10000000", price_usd: "5",    change_24h_pct: null, is_sbtc: false, is_sip010: false },
      { contract_id: "mid",  symbol: "MID",  name: "Mid",  decimals: 6, balance_micro: "2000000",  price_usd: "10",   change_24h_pct: null, is_sbtc: false, is_sip010: false },
    ];
    const tokens = rows.map(buildTokenBalance).sort((a, b) => b.valueUsd - a.valueUsd);
    expect(tokens[0].symbol).toBe("HIGH"); // 50
    expect(tokens[1].symbol).toBe("MID");  // 20
    expect(tokens[2].symbol).toBe("LOW");  // 1
  });

  it("builds history points from DB rows", () => {
    const rows: HistoryRow[] = [
      { snapshot_time: "2024-01-01T00:00:00Z", total_value_usd: "1000.00" },
      { snapshot_time: "2024-01-02T00:00:00Z", total_value_usd: "1200.00" },
    ];
    const pts = buildHistoryPoints(rows);
    expect(pts).toHaveLength(2);
    expect(pts[0].valueUsd).toBe(1000);
    expect(pts[1].valueUsd).toBe(1200);
  });

  it("returns empty history for empty rows", () => {
    expect(buildHistoryPoints([])).toHaveLength(0);
  });

  it("negative change_24h_pct is preserved correctly", () => {
    const row: RawToken = {
      contract_id: "d", symbol: "DUMP", name: "Dump", decimals: 6,
      balance_micro: "1000000", price_usd: "0.5", change_24h_pct: "-15.3",
      is_sbtc: false, is_sip010: true,
    };
    const token = buildTokenBalance(row);
    expect(token.change24hPct).toBeCloseTo(-15.3);
  });
});
