// WebSocket client for Hiro API blockchain events

import WebSocket from "ws";
import { EventEmitter } from "events";

export interface BlockEvent {
  type: "block";
  block_height: number;
  block_hash: string;
  block_time: number;
}

export interface TransactionEvent {
  type: "transaction";
  tx_id: string;
  block_height: number;
  tx_type: string;
  sender_address: string;
  raw_tx: any;
}

export type ChainEvent = BlockEvent | TransactionEvent;

export class HiroWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;

  constructor(private wsUrl: string) {
    super();
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.wsUrl);

    this.ws.on("open", () => {
      console.log("[HiroWS] Connected");
      this.reconnectAttempts = 0;
      this.emit("connected");
      this.subscribe();
    });

    this.ws.on("message", (data: WebSocket.Data) => {
      try {
        const event = JSON.parse(data.toString());
        this.handleEvent(event);
      } catch (err) {
        console.error("[HiroWS] Parse error:", err);
      }
    });

    this.ws.on("error", (err) => {
      console.error("[HiroWS] Error:", err.message);
      this.emit("error", err);
    });

    this.ws.on("close", () => {
      console.log("[HiroWS] Disconnected");
      this.emit("disconnected");
      this.scheduleReconnect();
    });
  }

  private subscribe() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        action: "subscribe",
        channels: ["blocks", "transactions"],
      })
    );
  }

  private handleEvent(event: any) {
    if (event.type === "block") {
      this.emit("block", event as BlockEvent);
    } else if (event.type === "transaction") {
      this.emit("transaction", event as TransactionEvent);
    }
    this.emit("event", event as ChainEvent);
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[HiroWS] Max reconnect attempts reached");
      return;
    }

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[HiroWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
