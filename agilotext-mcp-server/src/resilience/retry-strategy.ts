/**
 * Retry strategy with exponential backoff and jitter
 * Handles both 429 (rate limit) and 5xx errors
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  jitter: true,
};

/**
 * Calculates retry delay with exponential backoff and optional jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: Partial<RetryConfig> = {}
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const baseDelay = Math.min(
    cfg.initialDelay * Math.pow(cfg.backoffMultiplier, attempt),
    cfg.maxDelay
  );

  if (cfg.jitter) {
    // Add random jitter (±25%)
    const jitterAmount = baseDelay * 0.25;
    const jitter = (Math.random() * 2 - 1) * jitterAmount;
    return Math.max(0, baseDelay + jitter);
  }

  return baseDelay;
}

/**
 * Determines if an error should be retried
 */
export function shouldRetry(error: any, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) {
    return false;
  }

  // Retry on network errors (no response)
  if (error.request && !error.response) {
    return true;
  }

  // Retry on 429 (rate limit) and 5xx (server errors)
  if (error.response) {
    const status = error.response.status;
    return status === 429 || (status >= 500 && status < 600);
  }

  // Retry on Agilotext API errors (status KO) - might be transient
  if (error.status === "KO") {
    return true;
  }

  return false;
}

/**
 * Gets retry delay from Retry-After header if present
 */
export function getRetryAfterDelay(error: any, config: Partial<RetryConfig> = {}): number | null {
  if (error.response?.headers?.["retry-after"]) {
    const retryAfter = parseInt(error.response.headers["retry-after"], 10);
    if (!isNaN(retryAfter)) {
      // Convert to milliseconds if in seconds
      return retryAfter < 1000 ? retryAfter * 1000 : retryAfter;
    }
  }
  return null;
}
