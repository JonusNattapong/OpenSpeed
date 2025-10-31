import v8 from 'v8';
import { EventEmitter } from 'events';
import type { Context } from '../context.js';

export interface MemoryOptions {
  maxHeapSize?: number; // Maximum heap size in MB
  gcThreshold?: number; // Memory usage threshold to trigger GC (0-1)
  checkInterval?: number; // Memory check interval in ms
  enableGC?: boolean; // Whether to enable manual GC
}

export class MemoryMonitor extends EventEmitter {
  private options: Required<MemoryOptions>;
  private intervalId: NodeJS.Timeout | null = null;
  private stats: {
    heapUsed: number[];
    heapTotal: number[];
    external: number[];
    rss: number[];
  } = {
    heapUsed: [],
    heapTotal: [],
    external: [],
    rss: []
  };

  constructor(options: MemoryOptions = {}) {
    super();
    this.options = {
      maxHeapSize: options.maxHeapSize || 512, // 512MB default
      gcThreshold: options.gcThreshold || 0.8, // 80% threshold
      checkInterval: options.checkInterval || 30000, // 30 seconds
      enableGC: options.enableGC !== false,
    };
  }

  start(): void {
    this.intervalId = setInterval(() => {
      this.checkMemory();
    }, this.options.checkInterval);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private checkMemory(): void {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
    const usageRatio = heapUsedMB / this.options.maxHeapSize;

    // Store stats (keep last 10 readings)
    this.stats.heapUsed.push(heapUsedMB);
    this.stats.heapTotal.push(heapTotalMB);
    this.stats.external.push(memUsage.external / 1024 / 1024);
    this.stats.rss.push(memUsage.rss / 1024 / 1024);

    if (this.stats.heapUsed.length > 10) {
      this.stats.heapUsed.shift();
      this.stats.heapTotal.shift();
      this.stats.external.shift();
      this.stats.rss.shift();
    }

    // Check thresholds
    if (usageRatio > this.options.gcThreshold) {
      this.emit('highMemoryUsage', {
        heapUsed: heapUsedMB,
        heapTotal: heapTotalMB,
        usageRatio,
        threshold: this.options.gcThreshold
      });

      if (this.options.enableGC && global.gc) {
        this.emit('gcTriggered', { heapUsed: heapUsedMB, heapTotal: heapTotalMB });
        global.gc();
      }
    }

    // Check for memory leaks (increasing trend)
    if (this.detectMemoryLeak()) {
      this.emit('memoryLeakDetected', {
        heapUsed: heapUsedMB,
        trend: this.calculateTrend(this.stats.heapUsed)
      });
    }
  }

  private detectMemoryLeak(): boolean {
    if (this.stats.heapUsed.length < 5) return false;

    const recent = this.stats.heapUsed.slice(-5);
    const trend = this.calculateTrend(recent);

    // If memory usage is consistently increasing
    return trend > 0.1; // 10% increase trend
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumXX = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return slope;
  }

  getStats() {
    return {
      current: process.memoryUsage(),
      history: this.stats,
      options: this.options
    };
  }
}

export function memoryPlugin(options: MemoryOptions = {}) {
  const monitor = new MemoryMonitor(options);

  // Start monitoring
  monitor.start();

  // Log memory events
  monitor.on('highMemoryUsage', (data) => {
    console.warn(`High memory usage detected: ${data.heapUsed.toFixed(2)}MB (${(data.usageRatio * 100).toFixed(1)}%)`);
  });

  monitor.on('gcTriggered', (data) => {
    console.log(`Garbage collection triggered. Heap: ${data.heapUsed.toFixed(2)}MB -> ${data.heapTotal.toFixed(2)}MB`);
  });

  monitor.on('memoryLeakDetected', (data) => {
    console.error(`Memory leak detected! Current heap usage: ${data.heapUsed.toFixed(2)}MB, Trend: ${data.trend.toFixed(3)}`);
  });

  return async (ctx: Context, next: () => Promise<any>) => {
    // Add memory stats to context
    ctx.memory = {
      getStats: () => monitor.getStats(),
      forceGC: () => {
        if (global.gc) {
          global.gc();
          return true;
        }
        return false;
      }
    };

    await next();
  };
}