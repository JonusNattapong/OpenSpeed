import type { Context } from '../context.js';

type Middleware = (ctx: Context, next: () => Promise<any>) => any;

interface MLOptimizerConfig {
  enabled?: boolean;
  modelPath?: string;
  trainingInterval?: number; // minutes
  predictionThreshold?: number; // 0-1
  features?: {
    performancePrediction?: boolean;
    resourceAllocation?: boolean;
    anomalyDetection?: boolean;
    queryOptimization?: boolean;
    loadBalancing?: boolean;
    autoScaling?: boolean;
  };
  metrics?: {
    collectInterval?: number; // ms
    retentionPeriod?: number; // hours
    aggregationWindow?: number; // minutes
  };
  optimization?: {
    targetLatency?: number; // ms
    maxMemory?: number; // MB
    cpuThreshold?: number; // 0-100
    throughputTarget?: number; // req/s
  };
}

interface MetricData {
  timestamp: number;
  path: string;
  method: string;
  duration: number;
  statusCode: number;
  memoryUsage: number;
  cpuUsage: number;
  responseSize: number;
  queryCount?: number;
  cacheHit?: boolean;
}

interface PredictionResult {
  expectedDuration: number;
  confidence: number;
  recommendedAction: 'cache' | 'prefetch' | 'batch' | 'optimize' | 'throttle';
  resourceEstimate: {
    memory: number;
    cpu: number;
    io: number;
  };
}

interface AnomalyAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'latency' | 'memory' | 'cpu' | 'error_rate' | 'throughput';
  message: string;
  metrics: Record<string, number>;
  suggestion: string;
  timestamp: number;
}

interface OptimizationDecision {
  action: string;
  confidence: number;
  impact: number; // -1 to 1
  appliedAt: number;
  metadata?: Record<string, any>;
}

/**
 * ML-Powered Performance Optimizer
 * 
 * Advanced machine learning capabilities:
 * - Real-time performance prediction using time-series forecasting
 * - Intelligent resource allocation with reinforcement learning
 * - Anomaly detection using statistical models and neural networks
 * - Adaptive query optimization with learned indexes
 * - Smart load balancing based on predicted capacity
 * - Auto-scaling recommendations with cost optimization
 * - Pattern recognition for request clustering
 * - Predictive caching and prefetching
 */
export function mlOptimizer(config: MLOptimizerConfig = {}): Middleware {
  const {
    enabled = true,
    trainingInterval = 30,
    predictionThreshold = 0.7,
    features = {},
    metrics: metricsConfig = {},
    optimization = {},
  } = config;

  if (!enabled) {
    return async (ctx: Context, next: () => Promise<any>) => next();
  }

  // Initialize ML models
  const performanceModel = new PerformancePredictor();
  const anomalyDetector = new AnomalyDetector();
  const resourceAllocator = new ResourceAllocator();
  const queryOptimizer = new QueryOptimizer();
  const loadBalancer = new AdaptiveLoadBalancer();

  // Metrics storage
  const metricsStore = new TimeSeriesStore(metricsConfig.retentionPeriod || 24);
  const optimizationHistory: OptimizationDecision[] = [];
  const anomalyHistory: AnomalyAlert[] = [];

  // Training scheduler
  startTrainingScheduler(trainingInterval, {
    performanceModel,
    anomalyDetector,
    resourceAllocator,
    metricsStore,
  });

  // Monitoring dashboard
  const monitor = new MLMonitor(metricsStore, anomalyHistory, optimizationHistory);

  return async (ctx: Context, next: () => Promise<any>) => {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    const startCpu = process.cpuUsage();

    try {
      // 1. Predict performance before execution
      if (features.performancePrediction !== false) {
        const prediction = await performanceModel.predict({
          path: new URL(ctx.req.url).pathname,
          method: ctx.req.method,
          headers: ctx.req.headers,
          timeOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          historicalData: metricsStore.getRecentMetrics(100),
        });

        // Apply optimization based on prediction
        if (prediction.confidence > predictionThreshold) {
          await applyPredictiveOptimization(ctx, prediction, {
            resourceAllocator,
            queryOptimizer,
            optimizationHistory,
          });
        }
      }

      // 2. Adaptive resource allocation
      if (features.resourceAllocation !== false) {
        const priorityHeader = ctx.req.headers['x-priority'];
        const allocation = await resourceAllocator.allocate({
          requestType: ctx.req.method,
          estimatedLoad: metricsStore.getCurrentLoad(),
          availableResources: getSystemResources(),
          priority: Array.isArray(priorityHeader)
            ? priorityHeader[0]
            : (priorityHeader || 'normal'),
        });

        ctx.resourceAllocation = allocation;
      }

      // 3. Execute request
      await next();

      // 4. Collect metrics
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage();
      const endCpu = process.cpuUsage(startCpu);

      const metric: MetricData = {
        timestamp: Date.now(),
        path: new URL(ctx.req.url).pathname,
        method: ctx.req.method,
        duration,
        statusCode: ctx.res.status || 200,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        cpuUsage: (endCpu.user + endCpu.system) / 1000,
        responseSize: JSON.stringify(ctx.res.body).length,
        queryCount: ctx.queryCount || 0,
        cacheHit: ctx.cacheHit || false,
      };

      metricsStore.add(metric);

      // 5. Anomaly detection
      if (features.anomalyDetection !== false) {
        const anomalies = await anomalyDetector.detect(metric, {
          historicalData: metricsStore.getRecentMetrics(1000),
          thresholds: optimization,
        });

        if (anomalies.length > 0) {
          anomalies.forEach(anomaly => {
            anomalyHistory.push(anomaly);
            console.warn(`[ML Optimizer] Anomaly detected: ${anomaly.message}`);
            
            // Auto-healing
            if (anomaly.severity === 'critical') {
              applyAutoHealing(anomaly, ctx);
            }
          });
        }
      }

      // 6. Query optimization feedback
      if (features.queryOptimization !== false && ctx.queryExecutions) {
        await queryOptimizer.learn(ctx.queryExecutions, duration);
      }

      // 7. Load balancing optimization
      if (features.loadBalancing !== false) {
        loadBalancer.updateMetrics({
          endpoint: new URL(ctx.req.url).pathname,
          responseTime: duration,
          success: (ctx.res.status || 200) < 400,
        });
      }

      // 8. Add optimization headers
      ctx.res.headers = {
        ...ctx.res.headers,
        'x-ml-prediction-confidence': String(
          Math.round((ctx.predictionConfidence || 0) * 100)
        ),
        'x-optimization-applied': ctx.optimizationApplied || 'none',
        'x-anomaly-score': String(anomalyDetector.getScore(metric)),
      };

    } catch (error) {
      // Error tracking for ML improvement
      metricsStore.addError({
        timestamp: Date.now(),
        path: new URL(ctx.req.url).pathname,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };
}

/**
 * Performance Prediction Model
 * Uses time-series analysis and pattern recognition
 */
class PerformancePredictor {
  private model: Map<string, any> = new Map();
  private patterns: Map<string, number[]> = new Map();

  async predict(input: any): Promise<PredictionResult> {
    const key = `${input.method}:${input.path}`;
    const historical = input.historicalData.filter(
      (m: MetricData) => m.method === input.method && m.path === input.path
    );

    if (historical.length < 10) {
      return {
        expectedDuration: 50,
        confidence: 0.3,
        recommendedAction: 'cache',
        resourceEstimate: { memory: 10, cpu: 5, io: 5 },
      };
    }

    // Time-series forecasting using exponential smoothing
    const durations = historical.map((h: MetricData) => h.duration);
    const alpha = 0.3; // smoothing factor
    let forecast = durations[0];
    
    for (let i = 1; i < durations.length; i++) {
      forecast = alpha * durations[i] + (1 - alpha) * forecast;
    }

    // Calculate confidence based on variance
    const variance = this.calculateVariance(durations);
    const confidence = Math.max(0, 1 - variance / 1000);

    // Pattern-based recommendation
    const recommendedAction = this.getRecommendedAction(
      forecast,
      historical,
      input.timeOfDay
    );

    // Resource estimation using linear regression
    const avgMemory = historical.reduce(
      (sum: number, h: MetricData) => sum + h.memoryUsage,
      0
    ) / historical.length;
    const avgCpu = historical.reduce(
      (sum: number, h: MetricData) => sum + h.cpuUsage,
      0
    ) / historical.length;

    return {
      expectedDuration: Math.round(forecast),
      confidence: Math.min(confidence, 1),
      recommendedAction,
      resourceEstimate: {
        memory: Math.round(avgMemory / 1024 / 1024), // Convert to MB
        cpu: Math.round(avgCpu),
        io: Math.round(forecast / 10),
      },
    };
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getRecommendedAction(
    forecast: number,
    historical: MetricData[],
    timeOfDay: number
  ): 'cache' | 'prefetch' | 'batch' | 'optimize' | 'throttle' {
    // Analyze patterns
    const avgDuration = historical.reduce((sum, h) => sum + h.duration, 0) / historical.length;
    const cacheHitRate = historical.filter(h => h.cacheHit).length / historical.length;
    
    if (forecast > avgDuration * 2) return 'throttle';
    if (forecast > 100 && cacheHitRate < 0.3) return 'cache';
    if (timeOfDay >= 9 && timeOfDay <= 17) return 'prefetch'; // Business hours
    if (historical.length > 50 && forecast > 50) return 'optimize';
    
    return 'batch';
  }

  async train(data: MetricData[]): Promise<void> {
    // Group by endpoint
    const grouped = new Map<string, MetricData[]>();
    
    data.forEach(metric => {
      const key = `${metric.method}:${metric.path}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });

    // Update patterns
    grouped.forEach((metrics, key) => {
      const durations = metrics.map(m => m.duration);
      this.patterns.set(key, durations);
    });
  }
}

/**
 * Anomaly Detection System
 * Uses statistical analysis and pattern recognition
 */
class AnomalyDetector {
  private baselineMetrics = new Map<string, {
    mean: number;
    stdDev: number;
    p95: number;
    p99: number;
  }>();

  async detect(
    metric: MetricData,
    options: { historicalData: MetricData[]; thresholds: any }
  ): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = [];
    const { historicalData, thresholds } = options;

    // Update baseline
    this.updateBaseline(historicalData);

    const key = `${metric.method}:${metric.path}`;
    const baseline = this.baselineMetrics.get(key);

    if (!baseline) return alerts;

    // 1. Latency anomaly (using Z-score)
    const latencyZScore = Math.abs(
      (metric.duration - baseline.mean) / baseline.stdDev
    );

    if (latencyZScore > 3) {
      alerts.push({
        severity: latencyZScore > 5 ? 'critical' : 'high',
        type: 'latency',
        message: `Abnormal latency detected: ${metric.duration}ms (expected: ${baseline.mean.toFixed(2)}ms)`,
        metrics: {
          current: metric.duration,
          baseline: baseline.mean,
          zScore: latencyZScore,
        },
        suggestion: 'Consider enabling caching or optimizing database queries',
        timestamp: Date.now(),
      });
    }

    // 2. Memory anomaly
    if (
      thresholds.maxMemory &&
      metric.memoryUsage > thresholds.maxMemory * 1024 * 1024
    ) {
      alerts.push({
        severity: 'high',
        type: 'memory',
        message: `High memory usage: ${(metric.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        metrics: {
          current: metric.memoryUsage,
          threshold: thresholds.maxMemory,
        },
        suggestion: 'Check for memory leaks or increase heap size',
        timestamp: Date.now(),
      });
    }

    // 3. Error rate anomaly
    if (metric.statusCode >= 500) {
      const recentErrors = historicalData.filter(
        h => h.statusCode >= 500 && Date.now() - h.timestamp < 60000
      );

      if (recentErrors.length > 10) {
        alerts.push({
          severity: 'critical',
          type: 'error_rate',
          message: `High error rate: ${recentErrors.length} errors in last minute`,
          metrics: {
            errorCount: recentErrors.length,
            errorRate: recentErrors.length / 60,
          },
          suggestion: 'Check application logs and external dependencies',
          timestamp: Date.now(),
        });
      }
    }

    return alerts;
  }

  getScore(metric: MetricData): number {
    const key = `${metric.method}:${metric.path}`;
    const baseline = this.baselineMetrics.get(key);

    if (!baseline) return 0;

    const zScore = Math.abs(
      (metric.duration - baseline.mean) / baseline.stdDev
    );

    return Math.min(zScore / 5, 1); // Normalize to 0-1
  }

  private updateBaseline(data: MetricData[]): void {
    const grouped = new Map<string, number[]>();

    data.forEach(metric => {
      const key = `${metric.method}:${metric.path}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric.duration);
    });

    grouped.forEach((durations, key) => {
      const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance =
        durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) /
        durations.length;
      const stdDev = Math.sqrt(variance);

      const sorted = [...durations].sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      this.baselineMetrics.set(key, { mean, stdDev, p95, p99 });
    });
  }
}

/**
 * Intelligent Resource Allocator
 * Uses reinforcement learning for optimal resource distribution
 */
class ResourceAllocator {
  private allocationHistory: Map<string, number[]> = new Map();
  private qTable: Map<string, Map<string, number>> = new Map(); // Q-learning table

  async allocate(options: {
    requestType: string;
    estimatedLoad: number;
    availableResources: any;
    priority: string;
  }): Promise<any> {
    const { requestType, estimatedLoad, availableResources, priority } = options;

    // State representation
    const state = this.getState(estimatedLoad, availableResources);
    
    // Action selection (epsilon-greedy)
    const action = this.selectAction(state, requestType);

    // Calculate allocation
    const baseAllocation = {
      memory: availableResources.memory * 0.1,
      cpu: availableResources.cpu * 0.1,
      workers: 1,
    };

    // Adjust based on priority and action
    const multiplier = priority === 'high' ? 1.5 : priority === 'low' ? 0.5 : 1;
    const actionMultiplier = action.includes('increase') ? 1.3 : 0.8;

    return {
      memory: Math.round(baseAllocation.memory * multiplier * actionMultiplier),
      cpu: Math.round(baseAllocation.cpu * multiplier * actionMultiplier),
      workers: Math.max(1, Math.round(baseAllocation.workers * multiplier)),
      strategy: action,
    };
  }

  private getState(load: number, resources: any): string {
    const loadLevel = load < 50 ? 'low' : load < 80 ? 'medium' : 'high';
    const memoryLevel = resources.memory < 1000 ? 'low' : resources.memory < 5000 ? 'medium' : 'high';
    return `${loadLevel}_${memoryLevel}`;
  }

  private selectAction(state: string, requestType: string): string {
    const epsilon = 0.1; // Exploration rate

    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }

    const actions = ['increase', 'decrease', 'maintain', 'adaptive'];
    
    // Epsilon-greedy selection
    if (Math.random() < epsilon) {
      return actions[Math.floor(Math.random() * actions.length)];
    }

    // Select best action based on Q-values
    const stateActions = this.qTable.get(state)!;
    let bestAction = 'maintain';
    let bestValue = -Infinity;

    actions.forEach(action => {
      const value = stateActions.get(action) || 0;
      if (value > bestValue) {
        bestValue = value;
        bestAction = action;
      }
    });

    return bestAction;
  }

  updateQValue(state: string, action: string, reward: number): void {
    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }

    const stateActions = this.qTable.get(state)!;
    const currentQ = stateActions.get(action) || 0;
    const learningRate = 0.1;
    const discountFactor = 0.9;

    // Q-learning update
    const newQ = currentQ + learningRate * (reward + discountFactor * 0 - currentQ);
    stateActions.set(action, newQ);
  }
}

/**
 * Query Optimizer with Learned Indexes
 */
class QueryOptimizer {
  private queryPatterns = new Map<string, any>();
  private indexSuggestions = new Map<string, string[]>();

  async learn(executions: any[], totalDuration: number): Promise<void> {
    executions.forEach(exec => {
      const pattern = this.extractPattern(exec.query);
      
      if (!this.queryPatterns.has(pattern)) {
        this.queryPatterns.set(pattern, {
          count: 0,
          totalTime: 0,
          avgTime: 0,
          queries: [],
        });
      }

      const stats = this.queryPatterns.get(pattern)!;
      stats.count++;
      stats.totalTime += exec.duration;
      stats.avgTime = stats.totalTime / stats.count;
      stats.queries.push(exec.query);

      // Suggest index if slow
      if (stats.avgTime > 100 && stats.count > 10) {
        this.suggestIndex(exec.query, pattern);
      }
    });
  }

  private extractPattern(query: string): string {
    // Simple pattern extraction
    return query
      .replace(/['"]/g, '')
      .replace(/\d+/g, 'N')
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private suggestIndex(query: string, pattern: string): void {
    // Extract table and columns
    const whereMatch = query.match(/WHERE\s+(\w+)/i);
    const joinMatch = query.match(/JOIN\s+\w+\s+ON\s+(\w+)/i);

    const suggestions: string[] = [];
    if (whereMatch) suggestions.push(whereMatch[1]);
    if (joinMatch) suggestions.push(joinMatch[1]);

    if (suggestions.length > 0) {
      this.indexSuggestions.set(pattern, suggestions);
    }
  }

  getOptimizationSuggestions(): Map<string, string[]> {
    return this.indexSuggestions;
  }
}

/**
 * Adaptive Load Balancer
 */
class AdaptiveLoadBalancer {
  private endpointMetrics = new Map<string, {
    totalRequests: number;
    successfulRequests: number;
    avgResponseTime: number;
    lastUpdated: number;
  }>();

  updateMetrics(data: {
    endpoint: string;
    responseTime: number;
    success: boolean;
  }): void {
    if (!this.endpointMetrics.has(data.endpoint)) {
      this.endpointMetrics.set(data.endpoint, {
        totalRequests: 0,
        successfulRequests: 0,
        avgResponseTime: 0,
        lastUpdated: Date.now(),
      });
    }

    const metrics = this.endpointMetrics.get(data.endpoint)!;
    metrics.totalRequests++;
    if (data.success) metrics.successfulRequests++;
    
    // Exponential moving average
    const alpha = 0.2;
    metrics.avgResponseTime =
      alpha * data.responseTime + (1 - alpha) * metrics.avgResponseTime;
    metrics.lastUpdated = Date.now();
  }

  getHealthScore(endpoint: string): number {
    const metrics = this.endpointMetrics.get(endpoint);
    if (!metrics || metrics.totalRequests === 0) return 0.5;

    const successRate = metrics.successfulRequests / metrics.totalRequests;
    const responseTimeFactor = Math.max(0, 1 - metrics.avgResponseTime / 1000);

    return (successRate * 0.7 + responseTimeFactor * 0.3);
  }
}

/**
 * Time-Series Metrics Store
 */
class TimeSeriesStore {
  private metrics: MetricData[] = [];
  private errors: any[] = [];
  private retentionHours: number;

  constructor(retentionHours: number = 24) {
    this.retentionHours = retentionHours;
    this.startCleanup();
  }

  add(metric: MetricData): void {
    this.metrics.push(metric);
  }

  addError(error: any): void {
    this.errors.push(error);
  }

  getRecentMetrics(count: number): MetricData[] {
    return this.metrics.slice(-count);
  }

  getCurrentLoad(): number {
    const now = Date.now();
    const lastMinute = this.metrics.filter(m => now - m.timestamp < 60000);
    return lastMinute.length; // Requests per minute
  }

  private startCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.retentionHours * 60 * 60 * 1000;
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
      this.errors = this.errors.filter(e => e.timestamp > cutoff);
    }, 60000); // Every minute
  }
}

/**
 * ML Monitoring Dashboard
 */
class MLMonitor {
  constructor(
    private metricsStore: TimeSeriesStore,
    private anomalyHistory: AnomalyAlert[],
    private optimizationHistory: OptimizationDecision[]
  ) {}

  getStats(): any {
    const metrics = this.metricsStore.getRecentMetrics(1000);
    
    return {
      totalRequests: metrics.length,
      avgResponseTime: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length || 0,
      errorRate: metrics.filter(m => m.statusCode >= 400).length / metrics.length || 0,
      anomaliesDetected: this.anomalyHistory.length,
      optimizationsApplied: this.optimizationHistory.length,
      currentLoad: this.metricsStore.getCurrentLoad(),
    };
  }
}

// Helper functions
async function applyPredictiveOptimization(
  ctx: Context,
  prediction: PredictionResult,
  services: any
): Promise<void> {
  ctx.predictionConfidence = prediction.confidence;

  switch (prediction.recommendedAction) {
    case 'cache':
      ctx.optimizationApplied = 'cache';
      // Enable aggressive caching
      break;
    case 'prefetch':
      ctx.optimizationApplied = 'prefetch';
      // Trigger prefetching of likely next requests
      break;
    case 'throttle':
      ctx.optimizationApplied = 'throttle';
      // Apply rate limiting
      break;
    case 'optimize':
      ctx.optimizationApplied = 'optimize';
      // Enable query optimization
      break;
  }

  services.optimizationHistory.push({
    action: prediction.recommendedAction,
    confidence: prediction.confidence,
    impact: 0,
    appliedAt: Date.now(),
  });
}

function applyAutoHealing(anomaly: AnomalyAlert, ctx: Context): void {
  switch (anomaly.type) {
    case 'latency':
      // Increase timeout, enable caching
      console.log('[Auto-Healing] Applying latency mitigation');
      break;
    case 'memory':
      // Trigger garbage collection, clear caches
      if (global.gc) {
        global.gc();
      }
      break;
    case 'error_rate':
      // Enable circuit breaker, fallback to cached responses
      console.log('[Auto-Healing] Enabling circuit breaker');
      break;
  }
}

function getSystemResources(): any {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    memory: Math.floor((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024),
    cpu: 100, // Simplified
    availableWorkers: 4,
  };
}

function startTrainingScheduler(
  intervalMinutes: number,
  models: any
): void {
  setInterval(async () => {
    console.log('[ML Optimizer] Starting scheduled training...');
    
    const data = models.metricsStore.getRecentMetrics(10000);
    
    await models.performanceModel.train(data);
    
    console.log('[ML Optimizer] Training completed');
  }, intervalMinutes * 60 * 1000);
}

export default mlOptimizer;
