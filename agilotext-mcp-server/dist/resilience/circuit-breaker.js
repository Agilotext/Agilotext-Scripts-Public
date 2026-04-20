/**
 * Circuit breaker pattern implementation
 * Prevents cascading failures by opening circuit after repeated failures
 */
const DEFAULT_CONFIG = {
    failureThreshold: 5,
    resetTimeout: 60000, // 1 minute
    halfOpenMaxAttempts: 3,
};
export class CircuitBreaker {
    state = "closed";
    failureCount = 0;
    lastFailureTime = 0;
    halfOpenAttempts = 0;
    config;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * Executes a function with circuit breaker protection
     */
    async execute(fn) {
        // Check if we should attempt to close the circuit
        if (this.state === "open") {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure >= this.config.resetTimeout) {
                this.state = "half-open";
                this.halfOpenAttempts = 0;
            }
            else {
                throw new Error(`Circuit breaker is OPEN. Retry after ${Math.ceil((this.config.resetTimeout - timeSinceLastFailure) / 1000)} seconds`);
            }
        }
        // Check half-open state limits
        if (this.state === "half-open") {
            if (this.halfOpenAttempts >= this.config.halfOpenMaxAttempts) {
                this.state = "open";
                this.lastFailureTime = Date.now();
                throw new Error("Circuit breaker half-open attempts exceeded");
            }
            this.halfOpenAttempts++;
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Handles successful execution
     */
    onSuccess() {
        this.failureCount = 0;
        if (this.state === "half-open") {
            this.state = "closed";
            this.halfOpenAttempts = 0;
        }
    }
    /**
     * Handles failed execution
     */
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        if (this.state === "half-open") {
            // Failed in half-open, go back to open
            this.state = "open";
            this.halfOpenAttempts = 0;
        }
        else if (this.state === "closed" &&
            this.failureCount >= this.config.failureThreshold) {
            // Too many failures, open the circuit
            this.state = "open";
        }
    }
    /**
     * Gets current circuit state
     */
    getState() {
        // Auto-transition from open to half-open if timeout passed
        if (this.state === "open") {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime;
            if (timeSinceLastFailure >= this.config.resetTimeout) {
                this.state = "half-open";
                this.halfOpenAttempts = 0;
            }
        }
        return this.state;
    }
    /**
     * Manually reset the circuit breaker
     */
    reset() {
        this.state = "closed";
        this.failureCount = 0;
        this.lastFailureTime = 0;
        this.halfOpenAttempts = 0;
    }
    /**
     * Gets current statistics
     */
    getStats() {
        return {
            state: this.getState(),
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
            halfOpenAttempts: this.halfOpenAttempts,
        };
    }
}
