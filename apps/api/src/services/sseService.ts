// Server-Sent Events service for in-app notifications

import { FastifyReply } from "fastify";
import { EventEmitter } from "events";
import { AlertEvent } from "@stkpulse/shared/alert-types";

export class SSEService extends EventEmitter {
  private clients: Map<string, FastifyReply> = new Map();

  registerClient(userId: string, reply: FastifyReply) {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    this.clients.set(userId, reply);

    reply.raw.on("close", () => {
      this.clients.delete(userId);
    });

    // Send initial connection message
    this.sendToClient(userId, { type: "connected", timestamp: Date.now() });
  }

  sendAlertToUser(userId: string, alertEvent: AlertEvent) {
    this.sendToClient(userId, {
      type: "alert",
      data: alertEvent,
    });
  }

  broadcastAlert(alertEvent: AlertEvent) {
    for (const [userId, reply] of this.clients.entries()) {
      this.sendToClient(userId, {
        type: "alert",
        data: alertEvent,
      });
    }
  }

  private sendToClient(userId: string, data: any) {
    const reply = this.clients.get(userId);
    if (!reply) return;

    try {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(`[SSE] Failed to send to ${userId}:`, err);
      this.clients.delete(userId);
    }
  }

  getActiveConnections(): number {
    return this.clients.size;
  }
}
