// Alert orchestrator - coordinates WebSocket, engine, and delivery services

import { Pool } from "pg";
import { HiroWebSocketClient } from "./websocketClient";
import { AlertEngine } from "./alertEngine";
import { WebhookService } from "./webhookService";
import { EmailService } from "./emailService";
import { SSEService } from "./sseService";
import { PriceMonitor } from "./priceMonitor";
import { StackingCycleMonitor } from "./stackingCycleMonitor";
import { NFTSaleMonitor } from "./nftSaleMonitor";

export class AlertOrchestrator {
  private wsClient: HiroWebSocketClient;
  private alertEngine: AlertEngine;
  private webhookService: WebhookService;
  private emailService: EmailService;
  private sseService: SSEService;
  private priceMonitor: PriceMonitor;
  private stackingMonitor: StackingCycleMonitor;
  private nftMonitor: NFTSaleMonitor;
  private retryInterval: NodeJS.Timeout | null = null;

  constructor(private db: Pool, wsUrl: string) {
    this.wsClient = new HiroWebSocketClient(wsUrl);
    this.alertEngine = new AlertEngine(db);
    this.webhookService = new WebhookService(db);
    this.emailService = new EmailService(db);
    this.sseService = new SSEService();
    this.priceMonitor = new PriceMonitor(db);
    this.stackingMonitor = new StackingCycleMonitor(db);
    this.nftMonitor = new NFTSaleMonitor(db);

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.wsClient.on("transaction", async (tx) => {
      const triggeredAlerts = await this.alertEngine.evaluateTransaction(tx);

      for (const alertEvent of triggeredAlerts) {
        await this.deliverAlert(alertEvent);
      }

      // Check NFT sales
      const nftAlerts = await this.nftMonitor.evaluateNFTSale(tx);
      for (const alertEvent of nftAlerts) {
        await this.deliverAlert(alertEvent);
      }
    });

    // Price threshold alerts
    this.priceMonitor.on("price_change", async (priceUpdate) => {
      const priceAlerts = await this.priceMonitor.evaluatePriceAlerts(priceUpdate);
      for (const alertEvent of priceAlerts) {
        await this.deliverAlert(alertEvent);
      }
    });

    // Stacking cycle alerts
    this.stackingMonitor.on("cycle_start", async (event) => {
      const alerts = await this.stackingMonitor.evaluateStackingAlerts(event);
      for (const alertEvent of alerts) {
        await this.deliverAlert(alertEvent);
      }
    });

    this.stackingMonitor.on("cycle_end", async (event) => {
      const alerts = await this.stackingMonitor.evaluateStackingAlerts(event);
      for (const alertEvent of alerts) {
        await this.deliverAlert(alertEvent);
      }
    });

    this.wsClient.on("connected", () => {
      console.log("[Orchestrator] WebSocket connected");
    });

    this.wsClient.on("disconnected", () => {
      console.log("[Orchestrator] WebSocket disconnected");
    });

    this.wsClient.on("error", (err) => {
      console.error("[Orchestrator] WebSocket error:", err);
    });
  }

  private async deliverAlert(alertEvent: any) {
    const alert = await this.getAlert(alertEvent.alert_id);
    if (!alert) return;

    // Webhook delivery
    if (alert.notify_webhook) {
      await this.webhookService.deliverWebhook(alertEvent, alert.notify_webhook);
    }

    // Email delivery
    if (alert.notify_email) {
      await this.emailService.sendAlertEmail(alertEvent, alert.notify_email);
    }

    // In-app notification
    if (alert.notify_in_app) {
      this.sseService.sendAlertToUser(alert.user_id, alertEvent);
    }
  }

  private async getAlert(alertId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM alerts WHERE id = $1`,
      [alertId]
    );
    return rows[0];
  }

  start() {
    console.log("[Orchestrator] Starting alert system");
    this.wsClient.connect();
    this.priceMonitor.start();
    this.stackingMonitor.start();

    // Start webhook retry processor (every 30 seconds)
    this.retryInterval = setInterval(() => {
      this.webhookService.processRetryQueue();
    }, 30000);
  }

  stop() {
    console.log("[Orchestrator] Stopping alert system");
    this.wsClient.disconnect();
    this.priceMonitor.stop();
    this.stackingMonitor.stop();
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }

  getSSEService(): SSEService {
    return this.sseService;
  }
}
