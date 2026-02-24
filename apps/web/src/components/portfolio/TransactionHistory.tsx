"use client";

import React, { useState } from "react";
import { useTransactions } from "../../hooks/usePortfolio";
import type { TxType } from "@stkpulse/shared";

interface TransactionHistoryProps { address: string | null; }

const TX_TYPE_LABELS: Record<string, string> = {
  token_transfer_in:  "Received",
  token_transfer_out: "Sent",
  swap:               "Swap",
  airdrop:            "Airdrop",
  stacking_reward:    "Stacking Reward",
  mint:               "Mint",
  burn:               "Burn",
  contract_call:      "Contract Call",
};

const DIRECTION_COLORS: Record<string, string> = {
  in:      "#22c55e",
  out:     "#ef4444",
  neutral: "#6b7280",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.join(","),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? "");
        return v.includes(",") ? `"${v}"` : v;
      }).join(",")
    ),
  ].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TransactionHistory({ address }: TransactionHistoryProps) {
  const [page,       setPage]       = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const PAGE_SIZE = 30;

  const { rows, total, hasMore, isLoading, error } = useTransactions(
    address, page, PAGE_SIZE, { type: typeFilter || undefined }
  );

  if (!address) return null;

  function handleExport() {
    const csvRows = (rows as Record<string, unknown>[]).map(tx => ({
      Date:        formatDate(String(tx.block_time ?? "")),
      Type:        TX_TYPE_LABELS[String(tx.tx_type)] ?? String(tx.tx_type),
      Token:       tx.token_symbol,
      Amount:      tx.amount,
      "Price USD": tx.price_usd_at_tx,
      "Value USD": tx.value_usd,
      Direction:   tx.direction,
      Counterparty: tx.counterparty ?? "",
      "Tx ID":     tx.tx_id,
    }));
    downloadCSV(toCSV(csvRows), `stkpulse-txns-${address}-${Date.now()}.csv`);
  }

  return (
    <section className="tx-history" aria-label="Transaction history">
      <div className="tx-history__header">
        <h3 className="tx-history__title">Transaction History <span className="tx-history__count">({total})</span></h3>
        <div className="tx-history__controls">
          <select
            value={typeFilter}
            onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="tx-history__filter"
            aria-label="Filter by type"
          >
            <option value="">All Types</option>
            {Object.entries(TX_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button className="tx-history__export" onClick={handleExport} disabled={rows.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {isLoading && <div className="skeleton skeleton--table" />}
      {error     && <p className="error-text">{error}</p>}

      {!isLoading && rows.length > 0 && (
        <>
          <div className="tx-table-wrap">
            <table className="tx-table" aria-label="Transactions">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Token</th>
                  <th className="right">Amount</th>
                  <th className="right">Value (USD)</th>
                  <th>Counterparty</th>
                </tr>
              </thead>
              <tbody>
                {(rows as Record<string, unknown>[]).map(tx => {
                  const dir = String(tx.direction ?? "neutral");
                  return (
                    <tr key={String(tx.tx_id)}>
                      <td className="tx-date">{formatDate(String(tx.block_time))}</td>
                      <td>
                        <span className="tx-type-badge" style={{ color: DIRECTION_COLORS[dir] }}>
                          {TX_TYPE_LABELS[String(tx.tx_type)] ?? String(tx.tx_type)}
                        </span>
                      </td>
                      <td>{String(tx.token_symbol)}</td>
                      <td className={`right tx-amount tx-amount--${dir}`}>
                        {dir === "in" ? "+" : dir === "out" ? "-" : ""}
                        {Number(tx.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })}
                      </td>
                      <td className="right">
                        ${Number(tx.value_usd ?? 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="tx-counterparty">
                        {tx.counterparty
                          ? <code title={String(tx.counterparty)}>{String(tx.counterparty).slice(0, 12)}…</code>
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="tx-pagination">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span>Page {page} · {total} total</span>
            <button disabled={!hasMore} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </>
      )}

      {!isLoading && rows.length === 0 && !error && (
        <p className="tx-history__empty">No transactions found. Try syncing the wallet first.</p>
      )}
    </section>
  );
}
