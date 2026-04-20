/**
 * Rate limiter for email sending and API calls
 * Prevents abuse and ensures Gmail compliance
 */
const DEFAULT_CONFIG = {
    maxPerHour: 10,
    maxPerDay: 50,
    maxConcurrent: 3,
    minDelayBetweenSends: 30000, // 30 seconds
};
export class RateLimiter {
    config;
    users = new Map();
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Checks if a user can perform an action
     * Returns { allowed: boolean, retryAfter?: number }
     */
    checkLimit(userId) {
        const now = Date.now();
        const userLimit = this.getOrCreateUserLimit(userId, now);
        // Reset counters if time windows have passed
        if (now >= userLimit.hourlyResetTime) {
            userLimit.hourlyCount = 0;
            userLimit.hourlyResetTime = now + 60 * 60 * 1000; // 1 hour
        }
        if (now >= userLimit.dailyResetTime) {
            userLimit.dailyCount = 0;
            userLimit.dailyResetTime = now + 24 * 60 * 60 * 1000; // 24 hours
        }
        // Check limits
        if (userLimit.hourlyCount >= this.config.maxPerHour) {
            const retryAfter = Math.ceil((userLimit.hourlyResetTime - now) / 1000);
            return { allowed: false, retryAfter };
        }
        if (userLimit.dailyCount >= this.config.maxPerDay) {
            const retryAfter = Math.ceil((userLimit.dailyResetTime - now) / 1000);
            return { allowed: false, retryAfter };
        }
        if (userLimit.inProgress >= this.config.maxConcurrent) {
            return { allowed: false, retryAfter: 5 }; // Retry in 5 seconds
        }
        // Check minimum delay between sends
        const timeSinceLastSend = now - userLimit.lastSendTime;
        if (timeSinceLastSend < this.config.minDelayBetweenSends) {
            const retryAfter = Math.ceil((this.config.minDelayBetweenSends - timeSinceLastSend) / 1000);
            return { allowed: false, retryAfter };
        }
        return { allowed: true };
    }
    /**
     * Records that a user performed an action
     */
    recordAction(userId) {
        const now = Date.now();
        const userLimit = this.getOrCreateUserLimit(userId, now);
        userLimit.hourlyCount++;
        userLimit.dailyCount++;
        userLimit.lastSendTime = now;
        userLimit.inProgress++;
    }
    /**
     * Decrements the in-progress counter
     */
    releaseAction(userId) {
        const userLimit = this.users.get(userId);
        if (userLimit && userLimit.inProgress > 0) {
            userLimit.inProgress--;
        }
    }
    /**
     * Gets the current queue size for a user
     */
    getQueueSize(userId) {
        const userLimit = this.users.get(userId);
        return userLimit?.queue.length || 0;
    }
    /**
     * Gets or creates a user rate limit record
     */
    getOrCreateUserLimit(userId, now) {
        let userLimit = this.users.get(userId);
        if (!userLimit) {
            userLimit = {
                hourlyCount: 0,
                dailyCount: 0,
                hourlyResetTime: now + 60 * 60 * 1000,
                dailyResetTime: now + 24 * 60 * 60 * 1000,
                queue: [],
                inProgress: 0,
                lastSendTime: 0,
            };
            this.users.set(userId, userLimit);
        }
        return userLimit;
    }
    /**
     * Resets rate limit for a user (for testing or manual override)
     */
    resetUser(userId) {
        this.users.delete(userId);
    }
    /**
     * Gets current statistics for a user
     */
    getUserStats(userId) {
        const userLimit = this.users.get(userId);
        if (!userLimit) {
            return null;
        }
        return {
            hourlyCount: userLimit.hourlyCount,
            dailyCount: userLimit.dailyCount,
            inProgress: userLimit.inProgress,
            queueSize: userLimit.queue.length,
        };
    }
}
// Global rate limiter instance
export const emailRateLimiter = new RateLimiter({
    maxPerHour: 10,
    maxPerDay: 50,
    maxConcurrent: 3,
    minDelayBetweenSends: 30000,
});
