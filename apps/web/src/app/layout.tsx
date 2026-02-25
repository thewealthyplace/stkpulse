import type { Metadata } from "next";
import "../styles/portfolio.css";

export const metadata: Metadata = {
  title:       "stkpulse — Stacks Wallet Portfolio Tracker",
  description: "Track your STX, sBTC, and SIP-010 token holdings with FIFO PnL",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#0d1117", color: "#e6edf3", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
