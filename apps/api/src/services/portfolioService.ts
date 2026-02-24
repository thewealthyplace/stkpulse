// portfolioService.ts — builds PortfolioSnapshot from live balances + prices

import type { Pool } from "pg";
import type { PortfolioSnapshot, TokenBalance, PortfolioValueHistory, ValueHistoryWindow } from "@stkpulse/shared";
import { fetchWalletBalances } from "./walletIndexer";
import { getBulkPrices, persistPrices } from "./priceService";

const SBTC_CONTRACT = "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token";

// Known SIP-010 tokens to always include if held
const KNOWN_SIP010: Array<{ contractId: string; symbol: string; name: string; decimals: number }> = [
  { contractId: SBTC_CONTRACT,                                          symbol: "sBTC",  name: "Stacked Bitcoin",  decimals: 8 },
  { contractId: "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex", symbol: "ALEX",  name: "ALEX Token",       decimals: 8 },
  { contractId: "SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.wstx-token", symbol: "wSTX",  name: "Wrapped STX",      decimals: 6 },
];

function formatAmount(raw: string, decimals: number): string {
  const n = Number(raw) / Math.pow(10, decimals);
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

export async function getPortfolioSnapshot(
  db: Pool,
  address: string
): Promise<PortfolioSnapshot> {
  const balancesData = await fetchWalletBalances(address);

  // Build token list
  const tokens: TokenBalance[] = [];

  // STX (native)
  const stxRaw     = balancesData.stx.balance;
  const stxBalance = Number(stxRaw) / 1_000_000;
  const stxPrice   = 0; // filled in bulk below
  tokens.push({
    contractId:        "STX",
    symbol:            "STX",
    name:              "Stacks",
    decimals:          6,
    balance:           stxRaw,
    balanceFormatted:  formatAmount(stxRaw, 6),
    priceUsd:          stxPrice,
    valueUsd:          0,
    change24hPct:      null,
    logoUrl:           null,
    isSIP010:          false,
    isSBTC:            false,
  });

  // SIP-010 fungible tokens from balance response
  for (const [contractId, data] of Object.entries(balancesData.fungible_tokens)) {
    const known = KNOWN_SIP010.find(k => k.contractId === contractId);
    tokens.push({
      contractId,
      symbol:           known?.symbol ?? contractId.split(".").pop()?.toUpperCase() ?? "?",
      name:             known?.name   ?? contractId,
      decimals:         known?.decimals ?? 6,
      balance:          data.balance,
      balanceFormatted: formatAmount(data.balance, known?.decimals ?? 6),
      priceUsd:         0,
      valueUsd:         0,
      change24hPct:     null,
      logoUrl:          null,
      isSIP010:         true,
      isSBTC:           contractId === SBTC_CONTRACT,
    });
  }

  // Fill prices in bulk
  const contractIds = tokens.map(t => t.contractId);
  const prices = await getBulkPrices(contractIds);
  await persistPrices(db, prices, "coingecko/alex");

  let totalValue = 0;
  for (const t of tokens) {
    const price  = prices.get(t.contractId) ?? 0;
    const bal    = Number(t.balance) / Math.pow(10, t.decimals);
    const value  = bal * price;
    t.priceUsd   = price;
    t.valueUsd   = value;
    totalValue  += value;
  }

  // Remove zero-balance tokens (except STX)
  const filtered = tokens.filter(t => t.contractId === "STX" || t.valueUsd > 0);

  // Save snapshot for history chart
  await db.query(
    `INSERT INTO portfolio_snapshots (address, snapped_at, value_usd)
     VALUES ($1, NOW(), $2)
     ON CONFLICT (address, snapped_at) DO UPDATE SET value_usd = $2`,
    [address, totalValue]
  ).catch(() => {/* non-critical */});

  return {
    address,
    totalValueUsd:             totalValue,
    totalValueChange24hUsd:    0,  // filled from snapshots diff
    totalValueChange24hPct:    0,
    tokens:                    filtered,
    updatedAt:                 new Date().toISOString(),
  };
}

export async function getPortfolioValueHistory(
  db: Pool,
  address: string,
  window: ValueHistoryWindow
): Promise<PortfolioValueHistory> {
  const intervalMap: Record<ValueHistoryWindow, string> = {
    "30d":  "30 days",
    "90d":  "90 days",
    "365d": "365 days",
  };
  const interval = intervalMap[window];

  const { rows } = await db.query<{ snapped_at: string; value_usd: string }>(
    `SELECT time_bucket('1 hour', snapped_at) AS snapped_at,
            AVG(value_usd) AS value_usd
     FROM portfolio_snapshots
     WHERE address = $1 AND snapped_at >= NOW() - INTERVAL '${interval}'
     GROUP BY 1
     ORDER BY 1 ASC`,
    [address]
  );

  const points = rows.map(r => ({
    timestamp: r.snapped_at,
    valueUsd:  Number(r.value_usd),
  }));

  const startValue = points[0]?.valueUsd ?? 0;
  const endValue   = points[points.length - 1]?.valueUsd ?? 0;
  const changeUsd  = endValue - startValue;
  const changePct  = startValue > 0 ? (changeUsd / startValue) * 100 : 0;

  return { address, window, points, startValue, endValue, changePct, changeUsd };
}
