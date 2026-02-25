"use client";

// /portfolio — stkpulse wallet portfolio tracker
// Supports wallet connect (Hiro / Leather) and read-only mode (?address=)

import React, { useState, useEffect } from "react";
import { PortfolioChart }      from "../../components/portfolio/PortfolioChart";
import { TokenTable }          from "../../components/portfolio/TokenTable";
import { PnLPanel }            from "../../components/portfolio/PnLPanel";
import { TransactionHistory }  from "../../components/portfolio/TransactionHistory";
import { usePortfolioSnapshot, usePortfolioPnL, triggerSync } from "../../hooks/usePortfolio";

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(v);
}

export default function PortfolioPage() {
  const [address, setAddress]           = useState<string | null>(null);
  const [inputVal, setInputVal]         = useState("");
  const [syncState, setSyncState]       = useState<"idle" | "syncing" | "done">("idle");

  // Pick up ?address= from query string (read-only mode)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const addr   = params.get("address");
    if (addr) setAddress(addr);
  }, []);

  const { snapshot, isLoading, error, refresh } = usePortfolioSnapshot(address);
  const { pnl, isLoading: pnlLoading, error: pnlError } = usePortfolioPnL(address);

  async function handleSync() {
    if (!address) return;
    setSyncState("syncing");
    const ok = await triggerSync(address);
    setSyncState(ok ? "done" : "idle");
    if (ok) setTimeout(() => { refresh(); setSyncState("idle"); }, 3000);
  }

  function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (trimmed) setAddress(trimmed);
  }

  return (
    <main className="portfolio-page">
      <header className="portfolio-header">
        <h1>Portfolio Tracker</h1>
        <p className="portfolio-header__sub">
          Track your STX, sBTC, and SIP-010 token holdings with FIFO PnL.
        </p>
      </header>

      {/* Address entry */}
      {!address ? (
        <section className="portfolio-connect">
          <form onSubmit={handleAddressSubmit} className="portfolio-connect__form">
            <input
              type="text"
              placeholder="Enter Stacks address (SP... or ST...)"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="portfolio-connect__input"
              aria-label="Stacks wallet address"
            />
            <button type="submit" className="portfolio-connect__btn">View Portfolio</button>
          </form>
          <p className="portfolio-connect__note">Read-only mode — no wallet connection required.</p>
          {/* In production: <HiroConnectButton onAddress={setAddress} /> */}
        </section>
      ) : (
        <>
          {/* Address bar */}
          <div className="portfolio-address-bar">
            <code className="portfolio-address-bar__addr">{address}</code>
            <div className="portfolio-address-bar__actions">
              <button
                className="portfolio-address-bar__sync"
                onClick={handleSync}
                disabled={syncState === "syncing"}
              >
                {syncState === "syncing" ? "Syncing…" : syncState === "done" ? "Synced ✓" : "Sync"}
              </button>
              <button className="portfolio-address-bar__clear" onClick={() => setAddress(null)}>
                Clear
              </button>
            </div>
          </div>

          {/* Total value summary */}
          {snapshot && (
            <div className="portfolio-total">
              <span className="portfolio-total__value">{formatUSD(snapshot.totalValueUsd)}</span>
              <span className="portfolio-total__label">Total Portfolio Value</span>
              <span className="portfolio-total__updated">Updated {new Date(snapshot.updatedAt).toLocaleTimeString()}</span>
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          {/* Value chart */}
          <PortfolioChart address={address} />

          {/* Token balances */}
          <section className="portfolio-section">
            <h2>Holdings</h2>
            <TokenTable tokens={snapshot?.tokens ?? []} isLoading={isLoading} />
          </section>

          {/* PnL */}
          <PnLPanel pnl={pnl} isLoading={pnlLoading} error={pnlError} />

          {/* Transaction history */}
          <TransactionHistory address={address} />
        </>
      )}
    </main>
  );
}
