# stkpulse

> Real-time analytics and monitoring dashboard for the Stacks ecosystem

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Stacks](https://img.shields.io/badge/Built%20on-Stacks-5546FF)](https://stacks.co)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014-black)](https://nextjs.org)
[![Live](https://img.shields.io/badge/Status-Live-brightgreen)](https://github.com/thewealthyplace/stkpulse)

## Overview

**stkpulse** is a comprehensive real-time analytics platform for the Stacks blockchain ecosystem. Track on-chain metrics, monitor smart contracts, analyze DeFi protocols, and gain deep insights into the Bitcoin L2 economy — all in one place.

From individual traders to protocol teams, stkpulse provides the data infrastructure needed to make informed decisions on Stacks.

---

## Features

- **Live Chain Metrics** — block time, TPS, mempool depth, fee estimates updated every block
- **DeFi Dashboard** — TVL, volume, and liquidity across all Stacks DeFi protocols
- **Contract Monitor** — track any Clarity contract's calls, state changes, and revenue
- **STX & sBTC Analytics** — price, stacking rate, circulating supply, peg health
- **Wallet Portfolio** — track your STX, sBTC, and SIP-010 token holdings with PnL
- **NFT Market Data** — floor prices, volume, sales history across Stacks marketplaces
- **Stacking Analytics** — current cycle stats, pool rankings, BTC yield estimates
- **Custom Alerts** — webhook and email alerts for on-chain events you define
- **Developer API** — REST and WebSocket API for integrating stkpulse data
- **Historical Data** — full historical export for any metric in CSV or JSON

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Charting | Recharts + D3.js |
| Realtime | WebSocket (Hiro API) |
| Data Layer | PostgreSQL + TimescaleDB |
| Cache | Redis |
| Backend | Node.js + Fastify |
| Indexer | Custom Stacks event indexer |
| APIs | Hiro Platform API, Stacks API |
| Deployment | Docker + Railway / Vercel |

---

## Architecture

```
stkpulse/
├── apps/
│   ├── web/                        # Next.js frontend
│   │   ├── app/
│   │   │   ├── dashboard/          # Main analytics dashboard
│   │   │   ├── contracts/          # Contract explorer
│   │   │   ├── defi/               # DeFi protocol analytics
│   │   │   ├── nfts/               # NFT market data
│   │   │   ├── stacking/           # Stacking analytics
│   │   │   ├── portfolio/          # Wallet portfolio
│   │   │   └── api-docs/           # Developer API docs
│   │   └── components/
│   │       ├── charts/
│   │       ├── metrics/
│   │       └── alerts/
│   └── api/                        # Fastify API server
│       ├── routes/
│       ├── services/
│       └── websocket/
├── packages/
│   ├── indexer/                    # Stacks blockchain indexer
│   │   ├── block-processor.ts
│   │   ├── contract-events.ts
│   │   └── token-transfers.ts
│   ├── db/                         # Database schemas + migrations
│   └── shared/                     # Shared types and utilities
├── docker-compose.yml
└── .env.example
```

---

## Dashboard Modules

### Chain Health
```
Block Height    │ ████████████░░ 212,847
Avg Block Time  │ 9.8 seconds
Mempool Txns    │ 143
Network TPS     │ 12.4
Fee (low)       │ 0.001 STX
Fee (high)      │ 0.05 STX
```

### DeFi Overview
| Protocol | TVL | 24h Volume | Change |
|----------|-----|-----------|--------|
| ALEX | $42.1M | $3.2M | +5.4% |
| Bitflow | $18.7M | $1.1M | -2.1% |
| Velar | $9.4M | $0.8M | +12.3% |

### Stacking Cycle (example)
```
Cycle #82
├── Cycle Start Block: 840,000
├── Cycle End Block:   842,100
├── Total STX Stacked: 1.24B STX (62% of circulating)
├── Minimum Threshold: 90,000 STX
├── BTC Committed:     148.2 BTC
└── Est. APY:          8.3%
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Docker](https://docker.com/) + Docker Compose
- [Hiro Platform API Key](https://platform.hiro.so/) (free tier available)

### Installation

```bash
git clone https://github.com/thewealthyplace/stkpulse
cd stkpulse
cp .env.example .env
# Fill in your HIRO_API_KEY and other config
```

### Start with Docker

```bash
docker-compose up -d
```

This starts:
- PostgreSQL + TimescaleDB on port 5432
- Redis on port 6379
- API server on port 3001
- Indexer (background process)
- Frontend on port 3000

### Manual Setup

```bash
# Install dependencies
npm install

# Setup database
npm run db:migrate
npm run db:seed  # loads last 30 days of historical data

# Start indexer
npm run indexer:start

# Start API
npm run api:dev

# Start frontend
npm run web:dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API Reference

All endpoints are prefixed with `/api/v1`.

### Chain Metrics
```
GET /api/v1/chain/stats
GET /api/v1/chain/blocks?limit=10
GET /api/v1/chain/mempool
```

### Token Data
```
GET /api/v1/tokens                         # List all SIP-010 tokens
GET /api/v1/tokens/:contract/price         # Token price history
GET /api/v1/tokens/:contract/holders       # Token holder distribution
```

### Stacking
```
GET /api/v1/stacking/current-cycle
GET /api/v1/stacking/cycles?limit=30
GET /api/v1/stacking/pools
```

### Contracts
```
GET /api/v1/contracts/:address             # Contract metadata
GET /api/v1/contracts/:address/calls       # Recent function calls
GET /api/v1/contracts/:address/events      # Contract events
```

### WebSocket
```
ws://localhost:3001/ws

# Subscribe to events
{ "action": "subscribe", "channel": "blocks" }
{ "action": "subscribe", "channel": "contract", "address": "SP..." }
{ "action": "subscribe", "channel": "token", "contract": "SP..." }
```

---

## Custom Alerts

```typescript
// Create an alert via API
POST /api/v1/alerts
{
  "name": "Large STX Transfer",
  "condition": {
    "type": "token_transfer",
    "token": "STX",
    "amount_gte": 1000000  // 1M STX
  },
  "notify": {
    "webhook": "https://your-webhook.com/alerts",
    "email": "you@example.com"
  }
}
```

---

## Environment Variables

```env
# Stacks API
HIRO_API_KEY=your_key_here
STACKS_NETWORK=mainnet  # mainnet | testnet

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/stkpulse
REDIS_URL=redis://localhost:6379

# App
NEXT_PUBLIC_API_URL=http://localhost:3001
ALERT_WEBHOOK_SECRET=your_secret_here
```

---

## Roadmap

- [x] Real-time chain metrics
- [x] DeFi TVL and volume tracking
- [x] Stacking cycle analytics
- [x] REST and WebSocket API
- [ ] NFT floor price aggregator
- [ ] Wallet PnL tracker
- [ ] Mobile app (React Native)
- [ ] AI-powered anomaly detection
- [ ] Public embeddable chart widgets
- [ ] Developer SDK (stkpulse-js)

---

## Contributing

```bash
git clone https://github.com/thewealthyplace/stkpulse
cd stkpulse
npm install
docker-compose up -d postgres redis
npm run db:migrate
npm run web:dev
```

---

## License

MIT © [thewealthyplace](https://github.com/thewealthyplace)

---

## Resources

- [Hiro Platform API](https://platform.hiro.so)
- [Stacks API Docs](https://docs.hiro.so/api)
- [Stacks Explorer](https://explorer.stacks.co)
- [TimescaleDB](https://www.timescale.com)
- [Stacks.js](https://stacks.js.org)
