"use client";

import React, { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { PortfolioValueHistory, ValueHistoryWindow } from "@stkpulse/shared";
import { usePortfolioHistory } from "../../hooks/usePortfolio";

interface PortfolioChartProps { address: string | null; }

const WINDOWS: { label: string; value: ValueHistoryWindow }[] = [
  { label: "30D",  value: "30d"  },
  { label: "90D",  value: "90d"  },
  { label: "1Y",   value: "365d" },
];

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="portfolio-tooltip">
      <p className="portfolio-tooltip__date">{label ? formatDate(label) : ""}</p>
      <p className="portfolio-tooltip__value">{formatUSD(payload[0].value)}</p>
    </div>
  );
}

export function PortfolioChart({ address }: PortfolioChartProps) {
  const [window, setWindow] = useState<ValueHistoryWindow>("30d");
  const { history, isLoading, error } = usePortfolioHistory(address, window);

  if (!address) return null;

  if (isLoading) return <div className="portfolio-chart portfolio-chart--loading"><div className="skeleton skeleton--chart" /></div>;
  if (error)     return <div className="portfolio-chart portfolio-chart--error"><p>{error}</p></div>;
  if (!history || history.points.length === 0) {
    return <div className="portfolio-chart portfolio-chart--empty"><p>No history yet — syncing…</p></div>;
  }

  const isPositive = history.changePct >= 0;
  const strokeColor = isPositive ? "#22c55e" : "#ef4444";
  const fillColor   = isPositive ? "#22c55e22" : "#ef444422";

  return (
    <div className="portfolio-chart">
      <div className="portfolio-chart__header">
        <div className="portfolio-chart__change">
          <span className={`portfolio-chart__change-value ${isPositive ? "positive" : "negative"}`}>
            {isPositive ? "+" : ""}{history.changePct.toFixed(2)}%
          </span>
          <span className="portfolio-chart__change-usd">
            ({isPositive ? "+" : ""}{formatUSD(history.changeUsd)})
          </span>
          <span className="portfolio-chart__window-label">{window}</span>
        </div>
        <div className="portfolio-chart__windows" role="group">
          {WINDOWS.map(w => (
            <button
              key={w.value}
              className={`portfolio-chart__window-btn ${window === w.value ? "active" : ""}`}
              onClick={() => setWindow(w.value)}
              aria-pressed={window === w.value}
            >{w.label}</button>
          ))}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={history.points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.25} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis dataKey="timestamp" tickFormatter={formatDate} tick={{ fontSize: 11, fill: "#6b7280" }} minTickGap={40} />
          <YAxis tickFormatter={(v: number) => formatUSD(v)} tick={{ fontSize: 11, fill: "#6b7280" }} width={80} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={history.startValue} stroke="#374151" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="valueUsd" stroke={strokeColor} strokeWidth={2}
            fill="url(#portfolioGrad)" dot={false} activeDot={{ r: 4, fill: strokeColor }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
