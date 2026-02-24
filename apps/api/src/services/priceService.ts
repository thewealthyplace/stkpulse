// priceService.ts — fetches and caches token USD prices
// Sources: CoinGecko (STX/BTC), ALEX on-chain oracle (SIP-010), sBTC pegged to BTC

import type { Pool } from "pg";

const COINGECKO_URL = process.env.COINGECKO_API_URL || "https://api.coingecko.com/api/v3";
const CACHE_TTL_MS  = (Number(process.env.PRICE_CACHE_TTL_SECONDS) || 60) * 1000;

// In-memory price cache: contractId → { price, ts }
const memCache = new Map<string, { price: number; ts: number }>();

// Well-known CoinGecko IDs
const COINGECKO_IDS: Record<string, string> = {
  STX:  "blockstack",
  BTC:  "bitcoin",
  sBTC: "bitcoin",   // sBTC is pegged 1:1 to BTC
};

// ── CoinGecko fetch ────────────────────────────────────────────────────

async function fetchCoinGeckoPrices(symbols: string[]): Promise<Record<string, number>> {
  const ids = [...new Set(symbols.map(s => COINGECKO_IDS[s]).filter(Boolean))];
  if (ids.length === 0) return {};

  try {
    const url = `${COINGECKO_URL}/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data: Record<string, { usd: number; usd_24h_change?: number }> = await res.json();

    const result: Record<string, number> = {};
    for (const [sym, id] of Object.entries(COINGECKO_IDS)) {
      if (data[id]?.usd != null) result[sym] = data[id].usd;
    }
    return result;
  } catch (err) {
    console.error("[priceService] CoinGecko error:", err);
    return { STX: 0.95, BTC: 65000, sBTC: 65000 };
  }
}

// ── ALEX on-chain oracle (SIP-010 tokens) ─────────────────────────────
// In production this calls the ALEX oracle contract read-only functions.
// For now we return mock prices for known test tokens.

async function fetchAlexPrice(contractId: string): Promise<number | null> {
  const knownPrices: Record<string, number> = {
    "SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM.token-alex": 0.12,
    "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc": 65000,
  };
  return knownPrices[contractId] ?? null;
}

// ── Public interface ──────────────────────────────────────────────────

export async function getPrice(contractId: string): Promise<number> {
  const cached = memCache.get(contractId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.price;

  let price = 0;

  if (contractId === "STX" || contractId === "sBTC" || contractId === "BTC") {
    const prices = await fetchCoinGeckoPrices([contractId]);
    price = prices[contractId] ?? 0;
  } else {
    const alexPrice = await fetchAlexPrice(contractId);
    price = alexPrice ?? 0;
  }

  memCache.set(contractId, { price, ts: Date.now() });
  return price;
}

export async function getBulkPrices(contractIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  await Promise.all(contractIds.map(async (id) => {
    result.set(id, await getPrice(id));
  }));
  return result;
}

// Persist latest prices to DB for historical price chart
export async function persistPrices(
  db: Pool,
  prices: Map<string, number>,
  source: string
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const [contractId, price] of prices) {
      await client.query(
        `INSERT INTO token_prices (contract_id, price_usd, source)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [contractId, price, source]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[priceService] persist error:", err);
  } finally {
    client.release();
  }
}

export function clearPriceCache(): void {
  memCache.clear();
}
