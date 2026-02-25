"use client";

import React from "react";
import type { TokenBalance } from "@stkpulse/shared";

interface TokenTableProps {
  tokens:    TokenBalance[];
  isLoading: boolean;
}

function PctBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="pct-badge pct-badge--neutral">—</span>;
  const cls = pct >= 0 ? "positive" : "negative";
  return <span className={`pct-badge pct-badge--${cls}`}>{pct >= 0 ? "+" : ""}{pct.toFixed(2)}%</span>;
}

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}

export function TokenTable({ tokens, isLoading }: TokenTableProps) {
  if (isLoading) {
    return (
      <div className="token-table token-table--loading">
        {[1,2,3].map(i => <div key={i} className="skeleton skeleton--row" />)}
      </div>
    );
  }

  if (tokens.length === 0) {
    return <p className="token-table token-table--empty">No tokens found for this address.</p>;
  }

  const sorted = [...tokens].sort((a, b) => b.valueUsd - a.valueUsd);

  return (
    <div className="token-table-wrap">
      <table className="token-table" aria-label="Token balances">
        <thead>
          <tr>
            <th scope="col">Token</th>
            <th scope="col" className="right">Balance</th>
            <th scope="col" className="right">Price</th>
            <th scope="col" className="right">Value</th>
            <th scope="col" className="right">24h</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(t => (
            <tr key={t.contractId} className={t.isSBTC ? "row--sbtc" : ""}>
              <td>
                <div className="token-cell">
                  <span className="token-symbol">{t.symbol}</span>
                  {t.isSBTC && <span className="token-badge">sBTC</span>}
                  {t.isSIP010 && !t.isSBTC && <span className="token-badge token-badge--sip010">SIP-010</span>}
                  <span className="token-name">{t.name}</span>
                </div>
              </td>
              <td className="right">{t.balanceFormatted}</td>
              <td className="right">{formatUSD(t.priceUsd)}</td>
              <td className="right"><strong>{formatUSD(t.valueUsd)}</strong></td>
              <td className="right"><PctBadge pct={t.change24hPct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
