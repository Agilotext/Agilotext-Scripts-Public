/**
 * Simple in-memory cache with TTL support
 * Used for caching prompts, wordboosts, and job statuses
 */
export class Cache {
    cache = new Map();
    defaultTtl; // milliseconds
    constructor(defaultTtl = 5 * 60 * 1000) {
        // Default 5 minutes
        this.defaultTtl = defaultTtl;
    }
    /**
     * Gets a value from cache
     */
    get(key) {
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
    set(key, value, ttl) {
        const expiresAt = Date.now() + (ttl || this.defaultTtl);
        this.cache.set(key, { data: value, expiresAt });
    }
    /**
     * Deletes a value from cache
     */
    delete(key) {
        this.cache.delete(key);
    }
    /**
     * Clears all expired entries
     */
    clearExpired() {
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
    clear() {
        this.cache.clear();
    }
    /**
     * Gets cache statistics
     */
    getStats() {
        this.clearExpired();
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
        };
    }
    /**
     * Invalidates cache entries matching a pattern
     */
    invalidatePattern(pattern) {
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
export const promptsCache = new Cache(5 * 60 * 1000); // 5 minutes
export const wordboostsCache = new Cache(5 * 60 * 1000); // 5 minutes
export const jobStatusCache = new Cache(10 * 1000); // 10 seconds
