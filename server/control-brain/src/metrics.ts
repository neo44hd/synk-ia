/**
 * Metrics Module - Cost tracking and performance metrics
 */

export interface ProviderCost {
  provider: string;
  tasks: number;
  total_cost: number;
  avg_latency_ms: number;
}

export class MetricsCollector {
  private costs: Map<string, { count: number; total: number; latencies: number[] }> = new Map();

  recordTask(
    provider: string,
    latency_ms: number,
    cost_estimate: number = 0
  ): void {
    if (!this.costs.has(provider)) {
      this.costs.set(provider, { count: 0, total: 0, latencies: [] });
    }

    const providerData = this.costs.get(provider)!;
    providerData.count++;
    providerData.total += cost_estimate;
    providerData.latencies.push(latency_ms);

    // Keep only last 1000 latencies to avoid memory leak
    if (providerData.latencies.length > 1000) {
      providerData.latencies = providerData.latencies.slice(-1000);
    }
  }

  getProviderStats(): ProviderCost[] {
    const stats: ProviderCost[] = [];

    this.costs.forEach((data, provider) => {
      const avgLatency = data.latencies.length > 0
        ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length
        : 0;

      stats.push({
        provider,
        tasks: data.count,
        total_cost: parseFloat(data.total.toFixed(4)),
        avg_latency_ms: parseFloat(avgLatency.toFixed(2)),
      });
    });

    return stats.sort((a, b) => b.total_cost - a.total_cost);
  }

  getTotalCost(): number {
    let total = 0;
    this.costs.forEach((data) => {
      total += data.total;
    });
    return parseFloat(total.toFixed(4));
  }

  getTotalTasks(): number {
    let total = 0;
    this.costs.forEach((data) => {
      total += data.count;
    });
    return total;
  }

  getAverageLatency(): number {
    let allLatencies: number[] = [];
    this.costs.forEach((data) => {
      allLatencies = allLatencies.concat(data.latencies);
    });

    if (allLatencies.length === 0) return 0;
    return parseFloat(
      (allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length).toFixed(2)
    );
  }
}

export const metricsCollector = new MetricsCollector();
