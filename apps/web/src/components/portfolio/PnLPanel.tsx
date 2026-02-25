"use client";

import React, { useState } from "react";
import type { PortfolioPnL } from "@stkpulse/shared";

interface PnLPanelProps {
  pnl:       PortfolioPnL | null;
  isLoading: boolean;
  error:     string | null;
}

function USD(v: number) {
  const sign = v >= 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v)}`;
}

export function PnLPanel({ pnl, isLoading, error }: PnLPanelProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="pnl-panel"><div className="skeleton skeleton--wide" /></div>;
  if (error)     return <div className="pnl-panel pnl-panel--error"><p>{error}</p></div>;
  if (!pnl)      return null;

  const totalCls  = pnl.totalPnl >= 0 ? "positive" : "negative";
  const realCls   = pnl.totalRealizedPnl >= 0 ? "positive" : "negative";
  const unrealCls = pnl.totalUnrealizedPnl >= 0 ? "positive" : "negative";

  return (
    <section className="pnl-panel" aria-label="Portfolio PnL">
      <h3 className="pnl-panel__title">Profit & Loss</h3>

      <div className="pnl-panel__summary">
        <div className="pnl-summary-card">
          <span className="pnl-label">Total PnL</span>
          <span className={`pnl-value pnl-value--${totalCls}`}>{USD(pnl.totalPnl)}</span>
        </div>
        <div className="pnl-summary-card">
          <span className="pnl-label">Realized</span>
          <span className={`pnl-value pnl-value--${realCls}`}>{USD(pnl.totalRealizedPnl)}</span>
        </div>
        <div className="pnl-summary-card">
          <span className="pnl-label">Unrealized</span>
          <span className={`pnl-value pnl-value--${unrealCls}`}>{USD(pnl.totalUnrealizedPnl)}</span>
        </div>
      </div>

      <div className="pnl-panel__assets">
        {pnl.assets.map(asset => (
          <div key={asset.contractId} className="pnl-asset">
            <button
              className="pnl-asset__header"
              onClick={() => setExpanded(expanded === asset.contractId ? null : asset.contractId)}
              aria-expanded={expanded === asset.contractId}
            >
              <span className="pnl-asset__symbol">{asset.symbol}</span>
              <span className={`pnl-asset__total ${asset.unrealizedPnlUsd >= 0 ? "positive" : "negative"}`}>
                {USD(asset.unrealizedPnlUsd + asset.realizedPnlUsd)}
              </span>
              <span className="pnl-asset__chevron">{expanded === asset.contractId ? "▲" : "▼"}</span>
            </button>

            {expanded === asset.contractId && (
              <div className="pnl-asset__detail">
                <dl className="pnl-detail-list">
                  <div><dt>Avg cost basis</dt><dd>${asset.averageCostBasis.toFixed(4)}</dd></div>
                  <div><dt>Current price</dt><dd>${asset.currentPrice.toFixed(4)}</dd></div>
                  <div><dt>Unrealized</dt><dd className={asset.unrealizedPnlUsd >= 0 ? "positive" : "negative"}>{USD(asset.unrealizedPnlUsd)} ({asset.unrealizedPnlPct.toFixed(2)}%)</dd></div>
                  <div><dt>Realized</dt><dd className={asset.realizedPnlUsd >= 0 ? "positive" : "negative"}>{USD(asset.realizedPnlUsd)}</dd></div>
                  <div><dt>Total bought</dt><dd>{asset.totalBought.toLocaleString()}</dd></div>
                  <div><dt>Total sold</dt><dd>{asset.totalSold.toLocaleString()}</dd></div>
                  <div><dt>FIFO lots</dt><dd>{asset.lots.length}</dd></div>
                </dl>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
