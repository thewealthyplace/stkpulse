// Widget API routes - public endpoints with rate limiting

import { FastifyInstance, FastifyPluginOptions } from "fastify";
import { Pool } from "pg";
import { WidgetDataService } from "../services/widgetDataService";
import { Period } from "@stkpulse/shared/widget-types";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const limit = rateLimitStore.get(ip);

  if (!limit || now > limit.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + 3600000 }); // 1 hour
    return true;
  }

  if (limit.count >= 1000) {
    return false;
  }

  limit.count++;
  return true;
}

export async function widgetRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions & { db: Pool }
) {
  const { db } = options;
  const widgetService = new WidgetDataService(db);

  // Rate limiting hook
  fastify.addHook("preHandler", async (request, reply) => {
    const ip = request.ip;
    if (!checkRateLimit(ip)) {
      return reply.status(429).send({ error: "Rate limit exceeded" });
    }
  });

  // STX Price Widget
  fastify.get<{ Querystring: { period?: Period; currency?: string } }>(
    "/widget/stx-price",
    async (request, reply) => {
      const { period = "30d", currency = "USD" } = request.query;
      
      reply.header("Cache-Control", "public, max-age=30");
      reply.header("Access-Control-Allow-Origin", "*");
      
      const data = await widgetService.getSTXPrice(period, currency);
      return { type: "stx-price", data, timestamp: Date.now(), period };
    }
  );

  // Contract Calls Widget
  fastify.get<{ Querystring: { contract: string; period?: Period } }>(
    "/widget/contract-calls",
    async (request, reply) => {
      const { contract, period = "7d" } = request.query;
      
      if (!contract) {
        return reply.status(400).send({ error: "contract parameter required" });
      }

      reply.header("Cache-Control", "public, max-age=30");
      reply.header("Access-Control-Allow-Origin", "*");
      
      const data = await widgetService.getContractCalls(contract, period);
      return { type: "contract-calls", data, timestamp: Date.now(), period };
    }
  );

  // Stacking Cycle Widget
  fastify.get("/widget/stacking-cycle", async (request, reply) => {
    reply.header("Cache-Control", "public, max-age=30");
    reply.header("Access-Control-Allow-Origin", "*");
    
    const data = await widgetService.getStackingCycle();
    return { type: "stacking-cycle", data, timestamp: Date.now() };
  });

  // Token Price Widget
  fastify.get<{ Querystring: { contract: string; period?: Period } }>(
    "/widget/token-price",
    async (request, reply) => {
      const { contract, period = "30d" } = request.query;
      
      if (!contract) {
        return reply.status(400).send({ error: "contract parameter required" });
      }

      reply.header("Cache-Control", "public, max-age=30");
      reply.header("Access-Control-Allow-Origin", "*");
      
      const data = await widgetService.getTokenPrice(contract, period);
      return { type: "token-price", data, timestamp: Date.now(), period };
    }
  );

  // TVL Widget
  fastify.get<{ Querystring: { protocol: string; period?: Period } }>(
    "/widget/tvl",
    async (request, reply) => {
      const { protocol, period = "30d" } = request.query;
      
      if (!protocol) {
        return reply.status(400).send({ error: "protocol parameter required" });
      }

      reply.header("Cache-Control", "public, max-age=30");
      reply.header("Access-Control-Allow-Origin", "*");
      
      const data = await widgetService.getTVL(protocol, period);
      return { type: "tvl", data, timestamp: Date.now(), period };
    }
  );

  // NFT Floor Widget
  fastify.get<{ Querystring: { collection: string; period?: Period } }>(
    "/widget/nft-floor",
    async (request, reply) => {
      const { collection, period = "30d" } = request.query;
      
      if (!collection) {
        return reply.status(400).send({ error: "collection parameter required" });
      }

      reply.header("Cache-Control", "public, max-age=30");
      reply.header("Access-Control-Allow-Origin", "*");
      
      const data = await widgetService.getNFTFloor(collection, period);
      return { type: "nft-floor", data, timestamp: Date.now(), period };
    }
  );
}
