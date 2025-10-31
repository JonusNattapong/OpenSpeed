import type { Context } from '../context.js';

export interface BackendInstance {
  url: string;
  weight?: number;
  healthy: boolean;
  connections: number;
  responseTime: number;
}

export interface LoadBalancerOptions {
  backends: BackendInstance[];
  strategy?: 'round-robin' | 'least-connections' | 'weighted-round-robin' | 'least-response-time';
  healthCheckInterval?: number;
  healthCheckTimeout?: number;
  maxRetries?: number;
}

export class LoadBalancer {
  private backends: BackendInstance[];
  private strategy: string;
  private currentIndex: number = 0;
  private healthCheckInterval: number;
  private healthCheckTimeout: number;
  private maxRetries: number;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(options: LoadBalancerOptions) {
    this.backends = options.backends.map(backend => ({
      ...backend,
      connections: 0,
      responseTime: 0
    }));
    this.strategy = options.strategy || 'round-robin';
    this.healthCheckInterval = options.healthCheckInterval || 30000;
    this.healthCheckTimeout = options.healthCheckTimeout || 5000;
    this.maxRetries = options.maxRetries || 3;
  }

  start(): void {
    this.startHealthChecks();
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async getBackend(): Promise<BackendInstance | null> {
    const healthyBackends = this.backends.filter(b => b.healthy);

    if (healthyBackends.length === 0) {
      return null;
    }

    switch (this.strategy) {
      case 'round-robin':
        return this.getRoundRobinBackend(healthyBackends);
      case 'least-connections':
        return this.getLeastConnectionsBackend(healthyBackends);
      case 'weighted-round-robin':
        return this.getWeightedRoundRobinBackend(healthyBackends);
      case 'least-response-time':
        return this.getLeastResponseTimeBackend(healthyBackends);
      default:
        return this.getRoundRobinBackend(healthyBackends);
    }
  }

  private getRoundRobinBackend(backends: BackendInstance[]): BackendInstance {
    const backend = backends[this.currentIndex % backends.length];
    this.currentIndex++;
    return backend;
  }

  private getLeastConnectionsBackend(backends: BackendInstance[]): BackendInstance {
    return backends.reduce((min, current) =>
      current.connections < min.connections ? current : min
    );
  }

  private getWeightedRoundRobinBackend(backends: BackendInstance[]): BackendInstance {
    const totalWeight = backends.reduce((sum, b) => sum + (b.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const backend of backends) {
      random -= backend.weight || 1;
      if (random <= 0) {
        return backend;
      }
    }

    return backends[0];
  }

  private getLeastResponseTimeBackend(backends: BackendInstance[]): BackendInstance {
    return backends.reduce((min, current) =>
      current.responseTime < min.responseTime ? current : min
    );
  }

  private startHealthChecks(): void {
    this.intervalId = setInterval(async () => {
      for (const backend of this.backends) {
        await this.checkHealth(backend);
      }
    }, this.healthCheckInterval);
  }

  private async checkHealth(backend: BackendInstance): Promise<void> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.healthCheckTimeout);

      const response = await fetch(`${backend.url}/health`, {
        signal: controller.signal,
        method: 'GET',
      });

      clearTimeout(timeoutId);
      backend.healthy = response.ok;
    } catch (error) {
      backend.healthy = false;
    }
  }

  updateBackendStats(backend: BackendInstance, responseTime: number, success: boolean): void {
    backend.responseTime = responseTime;
    if (success) {
      backend.connections = Math.max(0, backend.connections - 1);
    }
  }

  getStats() {
    return {
      backends: this.backends.map(b => ({
        url: b.url,
        healthy: b.healthy,
        connections: b.connections,
        responseTime: b.responseTime,
        weight: b.weight
      })),
      strategy: this.strategy,
      totalConnections: this.backends.reduce((sum, b) => sum + b.connections, 0)
    };
  }
}

export function loadBalancerPlugin(options: LoadBalancerOptions) {
  const loadBalancer = new LoadBalancer(options);
  loadBalancer.start();

  return async (ctx: Context, next: () => Promise<any>) => {
    // Add load balancer to context for manual routing
    ctx.loadBalancer = {
      getBackend: () => loadBalancer.getBackend(),
      getStats: () => loadBalancer.getStats(),
      updateStats: (backend: BackendInstance, responseTime: number, success: boolean) => {
        loadBalancer.updateBackendStats(backend, responseTime, success);
      }
    };

    await next();
  };
}