// Widget cache service for edge caching

import { Pool } from "pg";

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class WidgetCache {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL = 30000; // 30 seconds

  constructor(private db: Pool) {}

  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    const age = Date.now() - entry.timestamp;
    if (age > this.TTL) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getCacheStats() {
    return {
      size: this.cache.size,
      ttl: this.TTL,
    };
  }

  // Cleanup old entries periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.TTL) {
          this.cache.delete(key);
        }
      }
    }, 60000); // Every minute
  }
}
