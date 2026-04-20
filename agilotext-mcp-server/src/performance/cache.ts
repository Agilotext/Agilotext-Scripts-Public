/**
 * Simple in-memory cache with TTL support
 * Used for caching prompts, wordboosts, and job statuses
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private defaultTtl: number; // milliseconds

  constructor(defaultTtl: number = 5 * 60 * 1000) {
    // Default 5 minutes
    this.defaultTtl = defaultTtl;
  }

  /**
   * Gets a value from cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Sets a value in cache with TTL
   */
  set(key: string, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTtl);
    this.cache.set(key, { data: value, expiresAt });
  }

  /**
   * Deletes a value from cache
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clears all expired entries
   */
  clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gets cache statistics
   */
  getStats(): {
    size: number;
    keys: string[];
  } {
    this.clearExpired();
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  /**
   * Invalidates cache entries matching a pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let count = 0;
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

// Global cache instances
export const promptsCache = new Cache<any>(5 * 60 * 1000); // 5 minutes
export const wordboostsCache = new Cache<any>(5 * 60 * 1000); // 5 minutes
export const jobStatusCache = new Cache<any>(10 * 1000); // 10 seconds
