import type { Context } from '../context.js';

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening circuit
  recoveryTimeout?: number; // Time in ms to wait before trying to close circuit
  monitoringPeriod?: number; // Time window in ms for failure counting
  name?: string; // Circuit breaker name for logging
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private nextAttemptTime: number = 0;

  private options: Required<CircuitBreakerOptions>;

  constructor(options: CircuitBreakerOptions = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      recoveryTimeout: options.recoveryTimeout || 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod || 60000, // 1 minute
      name: options.name || 'default'
    };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker ${this.options.name} is OPEN`);
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
      console.warn(`Circuit breaker ${this.options.name} opened due to ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    // Auto-transition from HALF_OPEN to OPEN if still failing
    if (this.state === CircuitState.HALF_OPEN && Date.now() < this.nextAttemptTime) {
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.recoveryTimeout;
    }

    return this.state;
  }

  getStats() {
    return {
      name: this.options.name,
      state: this.state,
      failures: this.failures,
      failureThreshold: this.options.failureThreshold,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime,
      timeUntilRetry: Math.max(0, this.nextAttemptTime - Date.now())
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}

export function circuitBreakerPlugin(options: CircuitBreakerOptions = {}) {
  const circuitBreaker = new CircuitBreaker(options);

  return async (ctx: Context, next: () => Promise<any>) => {
    // Add circuit breaker to context
    ctx.circuitBreaker = {
      execute: <T>(fn: () => Promise<T>) => circuitBreaker.execute(fn),
      getState: () => circuitBreaker.getState(),
      getStats: () => circuitBreaker.getStats(),
      reset: () => circuitBreaker.reset()
    };

    await next();
  };
}

// Helper function to create circuit breaker for external service calls
export function createServiceCircuitBreaker(serviceName: string, options?: CircuitBreakerOptions) {
  return new CircuitBreaker({ ...options, name: serviceName });
}

// Example usage for external API calls
export async function callExternalService(
  url: string,
  options: RequestInit = {},
  circuitBreaker?: CircuitBreaker
): Promise<Response> {
  const fetchFn = async () => {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response;
  };

  if (circuitBreaker) {
    return circuitBreaker.execute(fetchFn);
  }

  return fetchFn();
}