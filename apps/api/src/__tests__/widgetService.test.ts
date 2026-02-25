// Widget API tests

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Pool } from "pg";
import { WidgetDataService } from "../services/widgetDataService";

describe("WidgetDataService", () => {
  let db: Pool;
  let service: WidgetDataService;

  beforeEach(async () => {
    db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    service = new WidgetDataService(db);

    await db.query(`
      INSERT INTO token_prices (contract_id, price_usd, source, recorded_at)
      VALUES 
        ('STX', 0.50, 'test', NOW() - INTERVAL '1 day'),
        ('STX', 0.55, 'test', NOW())
    `);
  });

  afterEach(async () => {
    await db.query("DELETE FROM token_prices WHERE source = 'test'");
    await db.end();
  });

  it("should fetch STX price data", async () => {
    const result = await service.getSTXPrice("24h", "USD");
    
    expect(result.prices).toBeDefined();
    expect(result.prices.length).toBeGreaterThan(0);
    expect(result.current).toBeGreaterThan(0);
  });

  it("should calculate price change", async () => {
    const result = await service.getSTXPrice("24h", "USD");
    
    expect(result.change_24h).toBeDefined();
    expect(typeof result.change_24h).toBe("number");
  });

  it("should handle different periods", async () => {
    const result7d = await service.getSTXPrice("7d", "USD");
    const result30d = await service.getSTXPrice("30d", "USD");
    
    expect(result7d.prices).toBeDefined();
    expect(result30d.prices).toBeDefined();
  });
});

describe("Widget Cache", () => {
  it("should cache widget data", async () => {
    const { WidgetCache } = await import("../services/widgetCache");
    const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const cache = new WidgetCache(db);

    const testData = { prices: [{ timestamp: Date.now(), price: 0.5 }] };
    cache.set("test-key", testData);

    const cached = await cache.get("test-key");
    expect(cached).toEqual(testData);

    await db.end();
  });

  it("should expire cache after TTL", async () => {
    const { WidgetCache } = await import("../services/widgetCache");
    const db = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    const cache = new WidgetCache(db);

    cache.set("test-key", { data: "test" });

    await new Promise(resolve => setTimeout(resolve, 31000));

    const cached = await cache.get("test-key");
    expect(cached).toBeNull();

    await db.end();
  });
});
