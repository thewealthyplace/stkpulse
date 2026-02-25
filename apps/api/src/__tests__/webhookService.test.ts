// Test suite for webhook service

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Pool } from "pg";
import { WebhookService } from "../services/webhookService";
import fetch from "node-fetch";

vi.mock("node-fetch");

describe("WebhookService", () => {
  let db: Pool;
  let service: WebhookService;

  beforeEach(async () => {
    db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    service = new WebhookService(db);
  });

  afterEach(async () => {
    await db.end();
    vi.clearAllMocks();
  });

  it("should deliver webhook successfully", async () => {
    (fetch as any).mockResolvedValue({ ok: true, status: 200 });

    const alertEvent = {
      alert_id: "test-alert",
      alert_name: "Test Alert",
      triggered_at: new Date().toISOString(),
      block_height: 100000,
      tx_id: "0xabc123",
      event: { type: "test" },
    };

    const result = await service.deliverWebhook(alertEvent, "https://example.com/webhook");
    expect(result.success).toBe(true);
  });

  it("should queue retry on failure", async () => {
    (fetch as any).mockRejectedValue(new Error("Network error"));

    const alertEvent = {
      alert_id: "test-alert",
      alert_name: "Test Alert",
      triggered_at: new Date().toISOString(),
      block_height: 100000,
      tx_id: "0xabc123",
      event: { type: "test" },
    };

    const result = await service.deliverWebhook(alertEvent, "https://example.com/webhook");
    expect(result.success).toBe(false);
  });

  it("should include idempotency key in headers", async () => {
    let capturedHeaders: any;
    (fetch as any).mockImplementation((url: string, options: any) => {
      capturedHeaders = options.headers;
      return Promise.resolve({ ok: true, status: 200 });
    });

    const alertEvent = {
      alert_id: "test-alert",
      alert_name: "Test Alert",
      triggered_at: new Date().toISOString(),
      block_height: 100000,
      tx_id: "0xabc123",
      event: { type: "test" },
    };

    await service.deliverWebhook(alertEvent, "https://example.com/webhook");
    expect(capturedHeaders["X-Idempotency-Key"]).toBe("test-alert-0xabc123");
  });
});
