/**
 * Metrics collection for monitoring and observability
 * Tracks tool usage, performance, errors, and system health
 */

interface ToolMetrics {
  count: number;
  totalTime: number;
  errors: number;
  lastCall: number;
}

interface SystemMetrics {
  totalRequests: number;
  totalErrors: number;
  cacheHitRate: number;
  rateLimitHits: number;
  circuitBreakerOpens: number;
}

class MetricsCollector {
  private toolMetrics: Map<string, ToolMetrics> = new Map();
  private systemMetrics: SystemMetrics = {
    totalRequests: 0,
    totalErrors: 0,
    cacheHitRate: 0,
    rateLimitHits: 0,
    circuitBreakerOpens: 0,
  };
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  /**
   * Records a tool execution
   */
  recordToolExecution(toolName: string, duration: number, success: boolean): void {
    const metrics = this.toolMetrics.get(toolName) || {
      count: 0,
      totalTime: 0,
      errors: 0,
      lastCall: 0,
    };

    metrics.count++;
    metrics.totalTime += duration;
    metrics.lastCall = Date.now();
    if (!success) {
      metrics.errors++;
      this.systemMetrics.totalErrors++;
    }

    this.toolMetrics.set(toolName, metrics);
    this.systemMetrics.totalRequests++;
  }

  /**
   * Records a cache hit
   */
  recordCacheHit(): void {
    this.cacheHits++;
    this.updateCacheHitRate();
  }

  /**
   * Records a cache miss
   */
  recordCacheMiss(): void {
    this.cacheMisses++;
    this.updateCacheHitRate();
  }

  /**
   * Updates cache hit rate
   */
  private updateCacheHitRate(): void {
    const total = this.cacheHits + this.cacheMisses;
    if (total > 0) {
      this.systemMetrics.cacheHitRate = this.cacheHits / total;
    }
  }

  /**
   * Records a rate limit hit
   */
  recordRateLimitHit(): void {
    this.systemMetrics.rateLimitHits++;
  }

  /**
   * Records a circuit breaker open
   */
  recordCircuitBreakerOpen(): void {
    this.systemMetrics.circuitBreakerOpens++;
  }

  /**
   * Gets metrics for a specific tool
   */
  getToolMetrics(toolName: string): ToolMetrics | null {
    return this.toolMetrics.get(toolName) || null;
  }

  /**
   * Gets all tool metrics
   */
  getAllToolMetrics(): Record<string, ToolMetrics> {
    const result: Record<string, ToolMetrics> = {};
    for (const [tool, metrics] of this.toolMetrics.entries()) {
      result[tool] = { ...metrics };
    }
    return result;
  }

  /**
   * Gets system-wide metrics
   */
  getSystemMetrics(): SystemMetrics {
    return { ...this.systemMetrics };
  }

  /**
   * Gets summary statistics
   */
  getSummary(): {
    totalTools: number;
    totalRequests: number;
    totalErrors: number;
    errorRate: number;
    avgResponseTime: number;
    cacheHitRate: number;
    topTools: Array<{ tool: string; count: number; avgTime: number }>;
  } {
    const tools = Array.from(this.toolMetrics.values());
    const totalTime = tools.reduce((sum, m) => sum + m.totalTime, 0);
    const totalCount = tools.reduce((sum, m) => sum + m.count, 0);
    const avgResponseTime = totalCount > 0 ? totalTime / totalCount : 0;

    const topTools = Array.from(this.toolMetrics.entries())
      .map(([tool, metrics]) => ({
        tool,
        count: metrics.count,
        avgTime: metrics.count > 0 ? metrics.totalTime / metrics.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTools: this.toolMetrics.size,
      totalRequests: this.systemMetrics.totalRequests,
      totalErrors: this.systemMetrics.totalErrors,
      errorRate:
        this.systemMetrics.totalRequests > 0
          ? this.systemMetrics.totalErrors / this.systemMetrics.totalRequests
          : 0,
      avgResponseTime,
      cacheHitRate: this.systemMetrics.cacheHitRate,
      topTools,
    };
  }

  /**
   * Resets all metrics
   */
  reset(): void {
    this.toolMetrics.clear();
    this.systemMetrics = {
      totalRequests: 0,
      totalErrors: 0,
      cacheHitRate: 0,
      rateLimitHits: 0,
      circuitBreakerOpens: 0,
    };
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}

// Global metrics collector instance
export const metrics = new MetricsCollector();
