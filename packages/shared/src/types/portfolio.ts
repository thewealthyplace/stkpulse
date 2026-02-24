// Portfolio tracker types for stkpulse

export type TxType =
  | "token_transfer_in"
  | "token_transfer_out"
  | "contract_call"
  | "swap"
  | "airdrop"
  | "stacking_reward"
  | "mint"
  | "burn";

export interface TokenBalance {
  contractId:   string;       // e.g. "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc" or "STX"
  symbol:       string;
  name:         string;
  decimals:     number;
  balance:      string;       // raw balance as string (bigint-safe)
  balanceFormatted: string;   // human-readable
  priceUsd:     number;
  valueUsd:     number;
  change24hPct: number | null;
  logoUrl:      string | null;
  isSIP010:     boolean;
  isSBTC:       boolean;
}

export interface PortfolioSnapshot {
  address:          string;
  totalValueUsd:    number;
  totalValueChange24hUsd: number;
  totalValueChange24hPct: number;
  tokens:           TokenBalance[];
  updatedAt:        string;   // ISO 8601
}

export interface TxRecord {
  txId:         string;
  blockHeight:  number;
  timestamp:    string;
  type:         TxType;
  tokenSymbol:  string;
  contractId:   string;
  amount:       string;
  amountFormatted: string;
  priceUsdAtTx: number;
  valueUsd:     number;
  direction:    "in" | "out" | "neutral";
  counterparty: string | null;
  memo:         string | null;
}

// ── FIFO Cost Basis ────────────────────────────────────────────────────

export interface FIFOLot {
  txId:           string;
  timestamp:      string;
  amount:         number;       // units (not raw)
  costBasisUsd:   number;       // per-unit cost at acquisition
  remainingAmount: number;      // units not yet disposed
}

export interface AssetPnL {
  contractId:       string;
  symbol:           string;
  totalBought:      number;
  totalSold:        number;
  realizedPnlUsd:   number;
  unrealizedPnlUsd: number;
  unrealizedPnlPct: number;
  averageCostBasis: number;
  currentPrice:     number;
  lots:             FIFOLot[];
}

export interface PortfolioPnL {
  address:          string;
  totalRealizedPnl: number;
  totalUnrealizedPnl: number;
  totalPnl:         number;
  assets:           AssetPnL[];
  calculatedAt:     string;
}

// ── Portfolio Value History ─────────────────────────────────────────────

export type ValueHistoryWindow = "30d" | "90d" | "365d";

export interface ValueDataPoint {
  timestamp: string;
  valueUsd:  number;
  blockHeight?: number;
}

export interface PortfolioValueHistory {
  address:  string;
  window:   ValueHistoryWindow;
  points:   ValueDataPoint[];
  startValue: number;
  endValue:   number;
  changePct:  number;
  changeUsd:  number;
}

// ── API Response Wrappers ─────────────────────────────────────────────

export interface ApiResponse<T> {
  data:       T;
  updatedAt:  string;
  cached:     boolean;
}

export interface PaginatedResponse<T> {
  data:     T[];
  total:    number;
  page:     number;
  pageSize: number;
  hasMore:  boolean;
}
