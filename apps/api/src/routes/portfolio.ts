// portfolio.ts — Fastify route plugin for wallet portfolio endpoints
//
// GET  /api/v1/portfolio/:address           — snapshot (balances + prices)
// GET  /api/v1/portfolio/:address/pnl       — FIFO cost basis + PnL
// GET  /api/v1/portfolio/:address/history   — value history chart data
// GET  /api/v1/portfolio/:address/transactions — paginated tx history
// POST /api/v1/portfolio/:address/sync      — trigger wallet re-index

import type { FastifyPluginAsync } from "fastify";
import type { Pool } from "pg";
import { getPortfolioSnapshot, getPortfolioValueHistory } from "../services/portfolioService";
import { computePortfolioPnL } from "../services/fifoEngine";
import { indexWalletHistory } from "../services/walletIndexer";
import type { ValueHistoryWindow } from "@stkpulse/shared";

// Basic Stacks address validation
function isValidAddress(addr: string): boolean {
  return /^S[A-Z0-9]{39,41}$/.test(addr);
}

interface PortfolioPlugin {
  db: Pool;
}

export const portfolioRoutes: FastifyPluginAsync<PortfolioPlugin> = async (fastify, opts) => {
  const { db } = opts;

  // GET /api/v1/portfolio/:address
  fastify.get<{ Params: { address: string } }>(
    "/portfolio/:address",
    {
      schema: {
        params: {
          type: "object",
          properties: { address: { type: "string" } },
          required: ["address"],
        },
      },
    },
    async (req, reply) => {
      const { address } = req.params;
      if (!isValidAddress(address)) {
        return reply.status(400).send({ error: "Invalid Stacks address" });
      }
      try {
        const snapshot = await getPortfolioSnapshot(db, address);
        return reply.send({ data: snapshot, updatedAt: snapshot.updatedAt, cached: false });
      } catch (err) {
        req.log.error(err);
        return reply.status(502).send({ error: "Failed to fetch portfolio" });
      }
    }
  );

  // GET /api/v1/portfolio/:address/pnl
  fastify.get<{ Params: { address: string } }>(
    "/portfolio/:address/pnl",
    async (req, reply) => {
      const { address } = req.params;
      if (!isValidAddress(address)) {
        return reply.status(400).send({ error: "Invalid Stacks address" });
      }
      try {
        const pnl = await computePortfolioPnL(db, address);
        return reply.send({ data: pnl, cached: false });
      } catch (err) {
        req.log.error(err);
        return reply.status(502).send({ error: "Failed to compute PnL" });
      }
    }
  );

  // GET /api/v1/portfolio/:address/history?window=30d
  fastify.get<{
    Params: { address: string };
    Querystring: { window?: string };
  }>(
    "/portfolio/:address/history",
    async (req, reply) => {
      const { address } = req.params;
      if (!isValidAddress(address)) {
        return reply.status(400).send({ error: "Invalid Stacks address" });
      }
      const windowParam = req.query.window ?? "30d";
      const validWindows: ValueHistoryWindow[] = ["30d", "90d", "365d"];
      const window: ValueHistoryWindow = validWindows.includes(windowParam as ValueHistoryWindow)
        ? windowParam as ValueHistoryWindow
        : "30d";

      try {
        const history = await getPortfolioValueHistory(db, address, window);
        return reply.send({ data: history, cached: false });
      } catch (err) {
        req.log.error(err);
        return reply.status(502).send({ error: "Failed to fetch history" });
      }
    }
  );

  // GET /api/v1/portfolio/:address/transactions?page=1&pageSize=30&type=...
  fastify.get<{
    Params: { address: string };
    Querystring: { page?: string; pageSize?: string; type?: string; contract?: string };
  }>(
    "/portfolio/:address/transactions",
    async (req, reply) => {
      const { address }  = req.params;
      if (!isValidAddress(address)) {
        return reply.status(400).send({ error: "Invalid Stacks address" });
      }
      const page     = Math.max(1, parseInt(req.query.page     ?? "1",  10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "30", 10) || 30));
      const offset   = (page - 1) * pageSize;
      const typeFilter    = req.query.type;
      const contractFilter = req.query.contract;

      try {
        let query = `SELECT tx_id, block_height, block_time, tx_type, contract_id,
                            token_symbol, amount, price_usd_at_tx, value_usd, direction,
                            counterparty, memo
                     FROM transactions
                     WHERE address = $1`;
        const params: unknown[] = [address];
        let pidx = 2;

        if (typeFilter) {
          query  += ` AND tx_type = $${pidx++}`;
          params.push(typeFilter);
        }
        if (contractFilter) {
          query  += ` AND contract_id = $${pidx++}`;
          params.push(contractFilter);
        }

        const countQuery = query.replace(
          /SELECT .* FROM/, "SELECT COUNT(*) AS total FROM"
        ).split("ORDER BY")[0];

        const [{ rows }, { rows: countRows }] = await Promise.all([
          db.query(query + ` ORDER BY block_time DESC LIMIT $${pidx} OFFSET $${pidx + 1}`,
            [...params, pageSize, offset]),
          db.query(countQuery, params),
        ]);

        const total = Number(countRows[0]?.total ?? 0);
        return reply.send({
          data: rows,
          total,
          page,
          pageSize,
          hasMore: offset + rows.length < total,
        });
      } catch (err) {
        req.log.error(err);
        return reply.status(502).send({ error: "Failed to fetch transactions" });
      }
    }
  );

  // POST /api/v1/portfolio/:address/sync
  fastify.post<{ Params: { address: string } }>(
    "/portfolio/:address/sync",
    async (req, reply) => {
      const { address } = req.params;
      if (!isValidAddress(address)) {
        return reply.status(400).send({ error: "Invalid Stacks address" });
      }
      // Fire-and-forget indexing
      indexWalletHistory(db, address, 500).catch(err =>
        req.log.error("[sync] indexer error:", err)
      );
      return reply.status(202).send({ message: "Sync started", address });
    }
  );
};
