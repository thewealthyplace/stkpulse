// usePortfolio — fetches portfolio snapshot with auto-refresh every block (~10min)

import { useState, useEffect, useCallback } from "react";
import type { PortfolioSnapshot, PortfolioPnL, PortfolioValueHistory, ValueHistoryWindow } from "@stkpulse/shared";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const REFRESH_MS = 600_000; // 10 minutes

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  const body = await res.json();
  return (body.data ?? body) as T;
}

// ── Snapshot hook ─────────────────────────────────────────────────────

export function usePortfolioSnapshot(address: string | null) {
  const [snapshot,  setSnapshot]  = useState<PortfolioSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [tick,      setTick]      = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => {
    if (!address) { setSnapshot(null); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    apiFetch<PortfolioSnapshot>(`/api/v1/portfolio/${address}`)
      .then(data => { if (!cancelled) { setSnapshot(data); setIsLoading(false); } })
      .catch(err  => { if (!cancelled) { setError(String(err)); setIsLoading(false); } });

    const timer = setInterval(refresh, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [address, tick, refresh]);

  return { snapshot, isLoading, error, refresh };
}

// ── PnL hook ──────────────────────────────────────────────────────────

export function usePortfolioPnL(address: string | null) {
  const [pnl,       setPnl]       = useState<PortfolioPnL | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!address) { setPnl(null); return; }
    let cancelled = false;
    setIsLoading(true);

    apiFetch<PortfolioPnL>(`/api/v1/portfolio/${address}/pnl`)
      .then(data => { if (!cancelled) { setPnl(data); setIsLoading(false); } })
      .catch(err  => { if (!cancelled) { setError(String(err)); setIsLoading(false); } });

    return () => { cancelled = true; };
  }, [address]);

  return { pnl, isLoading, error };
}

// ── Value history hook ────────────────────────────────────────────────

export function usePortfolioHistory(address: string | null, window: ValueHistoryWindow = "30d") {
  const [history,   setHistory]   = useState<PortfolioValueHistory | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!address) { setHistory(null); return; }
    let cancelled = false;
    setIsLoading(true);

    apiFetch<PortfolioValueHistory>(`/api/v1/portfolio/${address}/history?window=${window}`)
      .then(data => { if (!cancelled) { setHistory(data); setIsLoading(false); } })
      .catch(err  => { if (!cancelled) { setError(String(err)); setIsLoading(false); } });

    return () => { cancelled = true; };
  }, [address, window]);

  return { history, isLoading, error };
}

// ── Transaction history hook ──────────────────────────────────────────

export interface TxFilters { type?: string; contract?: string; }

export function useTransactions(address: string | null, page = 1, pageSize = 30, filters: TxFilters = {}) {
  const [data,      setData]      = useState<{ rows: unknown[]; total: number; hasMore: boolean }>({ rows: [], total: 0, hasMore: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setIsLoading(true);

    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (filters.type)     params.set("type", filters.type);
    if (filters.contract) params.set("contract", filters.contract);

    fetch(`${API}/api/v1/portfolio/${address}/transactions?${params}`)
      .then(r => r.json())
      .then(body => {
        if (!cancelled) {
          setData({ rows: body.data ?? [], total: body.total ?? 0, hasMore: body.hasMore ?? false });
          setIsLoading(false);
        }
      })
      .catch(err => { if (!cancelled) { setError(String(err)); setIsLoading(false); } });

    return () => { cancelled = true; };
  }, [address, page, pageSize, filters.type, filters.contract]);

  return { ...data, isLoading, error };
}

// ── Sync trigger ──────────────────────────────────────────────────────

export async function triggerSync(address: string): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/v1/portfolio/${address}/sync`, { method: "POST" });
    return res.status === 202;
  } catch {
    return false;
  }
}
