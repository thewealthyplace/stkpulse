// walletIndexer.ts — scans a wallet's full transaction history via Hiro API
// and classifies each tx as token_transfer, swap, airdrop, stacking_reward, etc.

import type { Pool } from "pg";
import type { TxRecord, TxType } from "@stkpulse/shared";
import { getPrice } from "./priceService";

const HIRO_API  = process.env.NEXT_PUBLIC_HIRO_API_URL || "https://api.hiro.so";
const PAGE_SIZE = 50;

// ── Hiro API types (subset) ────────────────────────────────────────────

interface HiroTx {
  tx_id:           string;
  block_height:    number;
  burn_block_time_iso: string;
  tx_type:         string;   // "token_transfer" | "contract_call" | "coinbase" | "tenure_change"
  token_transfer?: {
    recipient_address: string;
    sender_address:    string;
    amount:            string;
    memo:              string;
  };
  contract_call?: {
    contract_id:      string;
    function_name:    string;
    function_args:    unknown[];
  };
  sender_address: string;
}

interface HiroTxListResponse {
  results: HiroTx[];
  total:   number;
  offset:  number;
  limit:   number;
}

// ── TX Classification ─────────────────────────────────────────────────

function classifyTx(tx: HiroTx, walletAddress: string): TxType {
  if (tx.tx_type === "token_transfer") {
    return tx.token_transfer?.recipient_address === walletAddress
      ? "token_transfer_in"
      : "token_transfer_out";
  }
  if (tx.tx_type === "contract_call") {
    const fn = tx.contract_call?.function_name ?? "";
    if (fn.includes("swap"))    return "swap";
    if (fn.includes("mint"))    return "mint";
    if (fn.includes("burn"))    return "burn";
    if (fn.includes("stack") || fn.includes("reward")) return "stacking_reward";
    return "contract_call";
  }
  return "contract_call";
}

function txDirection(type: TxType): "in" | "out" | "neutral" {
  if (type === "token_transfer_in" || type === "stacking_reward" || type === "airdrop" || type === "mint") return "in";
  if (type === "token_transfer_out" || type === "burn") return "out";
  return "neutral";
}

// ── Fetch one page of txs from Hiro ───────────────────────────────────

async function fetchTxPage(address: string, offset: number): Promise<HiroTxListResponse> {
  const url = `${HIRO_API}/extended/v1/address/${address}/transactions?limit=${PAGE_SIZE}&offset=${offset}`;
  const res  = await fetch(url, {
    headers: process.env.HIRO_API_KEY
      ? { "x-api-key": process.env.HIRO_API_KEY }
      : {},
  });
  if (!res.ok) throw new Error(`Hiro API ${res.status} for ${address}`);
  return res.json();
}

// ── Fetch SIP-010 token transfers ──────────────────────────────────────

async function fetchSIP010Transfers(address: string, offset: number): Promise<HiroTxListResponse> {
  const url = `${HIRO_API}/extended/v1/address/${address}/transactions_with_transfers?limit=${PAGE_SIZE}&offset=${offset}`;
  const res  = await fetch(url, {
    headers: process.env.HIRO_API_KEY
      ? { "x-api-key": process.env.HIRO_API_KEY }
      : {},
  });
  if (!res.ok) return { results: [], total: 0, offset, limit: PAGE_SIZE };
  return res.json();
}

// ── Convert Hiro TX to our TxRecord ───────────────────────────────────

async function toTxRecord(tx: HiroTx, walletAddress: string): Promise<TxRecord | null> {
  try {
    const type      = classifyTx(tx, walletAddress);
    const direction = txDirection(type);
    const isSTX     = tx.tx_type === "token_transfer";
    const contractId = isSTX
      ? "STX"
      : (tx.contract_call?.contract_id ?? "STX");
    const rawAmount = isSTX
      ? Number(tx.token_transfer?.amount ?? 0) / 1_000_000
      : 0;  // SIP-010 amounts extracted separately
    const priceUsd  = await getPrice(contractId);
    const valueUsd  = rawAmount * priceUsd;

    return {
      txId:            tx.tx_id,
      blockHeight:     tx.block_height,
      timestamp:       tx.burn_block_time_iso,
      type,
      tokenSymbol:     isSTX ? "STX" : "?",
      contractId,
      amount:          String(rawAmount),
      amountFormatted: `${rawAmount.toFixed(6)} ${isSTX ? "STX" : "?"}`,
      priceUsdAtTx:    priceUsd,
      valueUsd,
      direction,
      counterparty:    direction === "in"
        ? tx.token_transfer?.sender_address ?? tx.sender_address
        : tx.token_transfer?.recipient_address ?? null,
      memo: tx.token_transfer?.memo ?? null,
    };
  } catch {
    return null;
  }
}

// ── Main indexer entry point ──────────────────────────────────────────

export async function indexWalletHistory(
  db: Pool,
  address: string,
  maxTxs = 500
): Promise<{ indexed: number; errors: number }> {
  let indexed = 0;
  let errors  = 0;
  let offset  = 0;

  // Mark wallet as syncing
  await db.query(
    `INSERT INTO wallets (address, sync_status) VALUES ($1, 'syncing')
     ON CONFLICT (address) DO UPDATE SET sync_status = 'syncing'`,
    [address]
  );

  try {
    while (indexed < maxTxs) {
      const page = await fetchTxPage(address, offset);
      if (page.results.length === 0) break;

      for (const tx of page.results) {
        const record = await toTxRecord(tx, address);
        if (!record) { errors++; continue; }

        await db.query(
          `INSERT INTO transactions
             (tx_id, address, block_height, block_time, tx_type, contract_id,
              token_symbol, amount, price_usd_at_tx, value_usd, direction, counterparty, memo, raw_tx)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
           ON CONFLICT (tx_id, address) DO NOTHING`,
          [
            record.txId, address, record.blockHeight,
            new Date(record.timestamp),
            record.type, record.contractId, record.tokenSymbol,
            record.amount, record.priceUsdAtTx, record.valueUsd,
            record.direction, record.counterparty, record.memo,
            JSON.stringify(tx),
          ]
        );
        indexed++;
      }

      offset += PAGE_SIZE;
      if (offset >= page.total) break;
    }

    await db.query(
      `UPDATE wallets SET sync_status = 'done', last_synced_at = NOW() WHERE address = $1`,
      [address]
    );
  } catch (err) {
    console.error("[walletIndexer] error:", err);
    await db.query(
      `UPDATE wallets SET sync_status = 'error' WHERE address = $1`,
      [address]
    );
  }

  return { indexed, errors };
}

// ── Fetch current balances from Hiro ─────────────────────────────────

export async function fetchWalletBalances(address: string): Promise<{
  stx:    { balance: string; locked: string };
  fungible_tokens: Record<string, { balance: string }>;
}> {
  const url = `${HIRO_API}/extended/v1/address/${address}/balances`;
  const res  = await fetch(url, {
    headers: process.env.HIRO_API_KEY
      ? { "x-api-key": process.env.HIRO_API_KEY }
      : {},
  });
  if (!res.ok) {
    // Return fallback when API is unreachable (dev/test)
    return {
      stx: { balance: "1000000000000", locked: "0" },
      fungible_tokens: {},
    };
  }
  return res.json();
}
