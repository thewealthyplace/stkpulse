// apps/api/src/server.ts — Fastify server entry point

import Fastify from "fastify";
import cors from "@fastify/cors";
import { Pool } from "pg";
import { portfolioRoutes } from "./routes/portfolio";
import { alertRoutes } from "./routes/alerts";
import { AlertOrchestrator } from "./services/alertOrchestrator";
import { AlertHistoryCleanup } from "./services/alertHistoryCleanup";

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";
const HIRO_WS_URL = process.env.HIRO_WS_URL || "wss://api.hiro.so/";

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const alertOrchestrator = new AlertOrchestrator(db, HIRO_WS_URL);
const historyCleanup = new AlertHistoryCleanup(db);

async function build() {
  const fastify = Fastify({ logger: true });

  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(",") ?? true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  });

  fastify.get("/health", async () => ({ status: "ok", ts: Date.now() }));

  await fastify.register(portfolioRoutes, { prefix: "/api/v1", db });
  await fastify.register(alertRoutes, { 
    prefix: "/api/v1", 
    db, 
    sseService: alertOrchestrator.getSSEService() 
  });

  return fastify;
}

async function start() {
  const fastify = await build();
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log(`stkpulse API running on http://${HOST}:${PORT}`);
    
    // Start alert system
    alertOrchestrator.start();
    historyCleanup.start();
    
    // Graceful shutdown
    process.on("SIGTERM", async () => {
      alertOrchestrator.stop();
      historyCleanup.stop();
      await fastify.close();
    });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
