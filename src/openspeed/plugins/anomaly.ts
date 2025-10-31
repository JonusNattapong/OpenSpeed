import type { Context } from '../context.js';

interface AnomalyConfig {
  windowSize: number; // Number of data points to analyze
  threshold: number; // Standard deviation threshold for anomaly detection
  alertWebhook?: string; // Optional webhook URL for alerts
  alertInterval: number; // Minimum time between alerts (ms)
}

interface AnomalyData {
  timestamp: number;
  value: number;
  metric: string;
}

class AnomalyDetector {
  protected data: Map<string, AnomalyData[]> = new Map();
  private lastAlert: Map<string, number> = new Map();
  private config: AnomalyConfig;

  constructor(config: AnomalyConfig) {
    this.config = config;
  }

  addDataPoint(metric: string, value: number): boolean {
    const data = this.data.get(metric) || [];
    data.push({
      timestamp: Date.now(),
      value,
      metric
    });

    // Keep only recent data points
    const cutoff = Date.now() - (this.config.windowSize * 1000);
    const filtered = data.filter(d => d.timestamp > cutoff);
    this.data.set(metric, filtered);

    return this.detectAnomaly(metric, filtered);
  }

  private detectAnomaly(metric: string, data: AnomalyData[]): boolean {
    if (data.length < 10) return false; // Need minimum data points

    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    const latest = values[values.length - 1];
    const zScore = Math.abs((latest - mean) / stdDev);

    return zScore > this.config.threshold;
  }

  async alert(metric: string, value: number, zScore: number): Promise<void> {
    const now = Date.now();
    const lastAlert = this.lastAlert.get(metric) || 0;

    if (now - lastAlert < this.config.alertInterval) {
      return; // Too soon since last alert
    }

    this.lastAlert.set(metric, now);

    if (this.config.alertWebhook) {
      try {
        const response = await fetch(this.config.alertWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric,
            value,
            zScore,
            timestamp: now,
            message: `Anomaly detected in ${metric}: value ${value} exceeds threshold`
          })
        });

        if (!response.ok) {
          console.error('Failed to send anomaly alert:', response.statusText);
        }
      } catch (error) {
        console.error('Error sending anomaly alert:', error);
      }
    }

    console.warn(`🚨 ANOMALY DETECTED: ${metric} = ${value} (z-score: ${zScore.toFixed(2)})`);
  }

  getStats(metric: string) {
    const data = this.data.get(metric) || [];
    if (data.length === 0) return null;

    const values = data.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      count: data.length,
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      latest: values[values.length - 1]
    };
  }

  getDataForMetric(metric: string): AnomalyData[] {
    return this.data.get(metric) || [];
  }

  getAllMetrics(): string[] {
    return Array.from(this.data.keys());
  }
}

export function anomalyPlugin(config: AnomalyConfig = {
  windowSize: 300, // 5 minutes
  threshold: 3, // 3 standard deviations
  alertInterval: 60000 // 1 minute between alerts
}) {
  const detector = new AnomalyDetector(config);

  return async (ctx: Context, next: () => Promise<any>) => {
    // Add anomaly detection to context
    ctx.anomaly = {
      detect: (metric: string, value: number) => {
        const isAnomaly = detector.addDataPoint(metric, value);
        if (isAnomaly) {
          const data = detector.getDataForMetric(metric);
          if (data.length > 0) {
            const values = data.map(d => d.value);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const stdDev = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
            const zScore = Math.abs((value - mean) / stdDev);
            detector.alert(metric, value, zScore);
          }
        }
        return isAnomaly;
      },
      getStats: (metric: string) => detector.getStats(metric)
    };

    // Check if this is the anomaly stats endpoint
    if (ctx.req.url?.startsWith('/anomaly/stats')) {
      const metrics = detector.getAllMetrics();
      const stats: Record<string, any> = {};

      for (const metric of metrics) {
        stats[metric] = detector.getStats(metric);
      }

      ctx.res.body = {
        metrics: stats,
        config: {
          windowSize: config.windowSize,
          threshold: config.threshold,
          alertInterval: config.alertInterval
        }
      };
      return;
    }

    await next();
  };
}