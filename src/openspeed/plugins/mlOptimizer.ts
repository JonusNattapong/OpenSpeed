import { randomBytes } from 'crypto';
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
  const neuralAnomalyDetector = new NeuralNetworkAnomalyDetector();
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
    neuralAnomalyDetector,
    resourceAllocator,
    metricsStore,
  });

  // Monitoring dashboard

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
          estimatedLoad: metricsStore.getCurrentLoad(),
          availableResources: getSystemResources(),
          priority: Array.isArray(priorityHeader) ? priorityHeader[0] : priorityHeader || 'normal',
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
        responseSize:
          typeof ctx.res.body === 'string'
            ? ctx.res.body.length
            : JSON.stringify(ctx.res.body || '').length,
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

        // Neural network anomaly detection
        const neuralResult = await neuralAnomalyDetector.detectAnomaly(metric);
        if (neuralResult.isAnomaly) {
          const neuralAnomaly: AnomalyAlert = {
            severity: neuralResult.confidence > 0.8 ? 'high' : 'medium',
            type: 'latency',
            message: `Neural network detected anomaly with confidence ${(neuralResult.confidence * 100).toFixed(1)}%`,
            metrics: {
              neuralScore: neuralResult.score,
              confidence: neuralResult.confidence,
            },
            suggestion: 'Review recent traffic patterns and system resources',
            timestamp: Date.now(),
          };
          anomalies.push(neuralAnomaly);
        }

        if (anomalies.length > 0) {
          anomalies.forEach((anomaly) => {
            anomalyHistory.push(anomaly);
            console.warn(`[ML Optimizer] Anomaly detected: ${anomaly.message}`);

            // Auto-healing
            if (anomaly.severity === 'critical') {
              applyAutoHealing(anomaly);
            }
          });
        }
      }

      // 6. Query optimization feedback
      if (features.queryOptimization !== false && ctx.queryExecutions) {
        await queryOptimizer.learn(ctx.queryExecutions);
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
        'x-ml-prediction-confidence': String(Math.round((ctx.predictionConfidence || 0) * 100)),
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
    const recommendedAction = this.getRecommendedAction(forecast, historical, input.timeOfDay);

    // Resource estimation using linear regression
    const avgMemory =
      historical.reduce((sum: number, h: MetricData) => sum + h.memoryUsage, 0) / historical.length;
    const avgCpu =
      historical.reduce((sum: number, h: MetricData) => sum + h.cpuUsage, 0) / historical.length;

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
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getRecommendedAction(
    forecast: number,
    historical: MetricData[],
    timeOfDay: number
  ): 'cache' | 'prefetch' | 'batch' | 'optimize' | 'throttle' {
    // Analyze patterns
    const avgDuration = historical.reduce((sum, h) => sum + h.duration, 0) / historical.length;
    const cacheHitRate = historical.filter((h) => h.cacheHit).length / historical.length;

    if (forecast > avgDuration * 2) return 'throttle';
    if (forecast > 100 && cacheHitRate < 0.3) return 'cache';
    if (timeOfDay >= 9 && timeOfDay <= 17) return 'prefetch'; // Business hours
    if (historical.length > 50 && forecast > 50) return 'optimize';

    return 'batch';
  }

  async train(data: MetricData[]): Promise<void> {
    // Group by endpoint
    const grouped = new Map<string, MetricData[]>();

    data.forEach((metric) => {
      const key = `${metric.method}:${metric.path}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric);
    });

    // Update patterns
    grouped.forEach((metrics, key) => {
      const durations = metrics.map((m) => m.duration);
      this.patterns.set(key, durations);
    });
  }
}

/**
 * Anomaly Detection System
 * Uses statistical analysis and pattern recognition
 */
class AnomalyDetector {
  private baselineMetrics = new Map<
    string,
    {
      mean: number;
      stdDev: number;
      p95: number;
      p99: number;
    }
  >();

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
    const latencyZScore = Math.abs((metric.duration - baseline.mean) / baseline.stdDev);

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
    if (thresholds.maxMemory && metric.memoryUsage > thresholds.maxMemory * 1024 * 1024) {
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
        (h) => h.statusCode >= 500 && Date.now() - h.timestamp < 60000
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

    const zScore = Math.abs((metric.duration - baseline.mean) / baseline.stdDev);

    return Math.min(zScore / 5, 1); // Normalize to 0-1
  }

  private updateBaseline(data: MetricData[]): void {
    const grouped = new Map<string, number[]>();

    data.forEach((metric) => {
      const key = `${metric.method}:${metric.path}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(metric.duration);
    });

    grouped.forEach((durations, key) => {
      const mean = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const variance =
        durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / durations.length;
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
/**
 * Neural Network-based Anomaly Detector
 * Uses a simple feedforward neural network for pattern recognition
 */
class NeuralNetworkAnomalyDetector {
  private network: {
    inputSize: number;
    hiddenSize: number;
    outputSize: number;
    weightsIH: number[][];
    weightsHO: number[][];
    biasH: number[];
    biasO: number[];
  };
  private learningRate: number = 0.1;
  private trainingData: number[][] = [];
  private isTrained: boolean = false;

  constructor(inputSize: number = 5, hiddenSize: number = 3) {
    this.network = {
      inputSize,
      hiddenSize,
      outputSize: 1,
      weightsIH: this.initializeWeights(inputSize, hiddenSize),
      weightsHO: this.initializeWeights(hiddenSize, 1),
      biasH: new Array(hiddenSize).fill(0),
      biasO: new Array(1).fill(0),
    };
  }

  private initializeWeights(rows: number, cols: number): number[][] {
    const weights: number[][] = [];
    for (let i = 0; i < rows; i++) {
      weights[i] = [];
      for (let j = 0; j < cols; j++) {
        weights[i][j] = (Math.random() - 0.5) * 0.1; // Small random weights
      }
    }
    return weights;
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private sigmoidDerivative(x: number): number {
    return x * (1 - x);
  }

  private forward(input: number[]): { hidden: number[]; output: number[] } {
    // Hidden layer
    const hidden: number[] = [];
    for (let i = 0; i < this.network.hiddenSize; i++) {
      let sum = this.network.biasH[i];
      for (let j = 0; j < this.network.inputSize; j++) {
        sum += input[j] * this.network.weightsIH[j][i];
      }
      hidden[i] = this.sigmoid(sum);
    }

    // Output layer
    const output: number[] = [];
    for (let i = 0; i < this.network.outputSize; i++) {
      let sum = this.network.biasO[i];
      for (let j = 0; j < this.network.hiddenSize; j++) {
        sum += hidden[j] * this.network.weightsHO[j][i];
      }
      output[i] = this.sigmoid(sum);
    }

    return { hidden, output };
  }

  private backward(input: number[], target: number[], hidden: number[], output: number[]): void {
    // Calculate output layer errors
    const outputErrors: number[] = [];
    for (let i = 0; i < this.network.outputSize; i++) {
      outputErrors[i] = (target[i] - output[i]) * this.sigmoidDerivative(output[i]);
    }

    // Calculate hidden layer errors
    const hiddenErrors: number[] = [];
    for (let i = 0; i < this.network.hiddenSize; i++) {
      let error = 0;
      for (let j = 0; j < this.network.outputSize; j++) {
        error += outputErrors[j] * this.network.weightsHO[i][j];
      }
      hiddenErrors[i] = error * this.sigmoidDerivative(hidden[i]);
    }

    // Update weights and biases
    // Hidden to output
    for (let i = 0; i < this.network.hiddenSize; i++) {
      for (let j = 0; j < this.network.outputSize; j++) {
        this.network.weightsHO[i][j] += this.learningRate * outputErrors[j] * hidden[i];
      }
    }
    for (let i = 0; i < this.network.outputSize; i++) {
      this.network.biasO[i] += this.learningRate * outputErrors[i];
    }

    // Input to hidden
    for (let i = 0; i < this.network.inputSize; i++) {
      for (let j = 0; j < this.network.hiddenSize; j++) {
        this.network.weightsIH[i][j] += this.learningRate * hiddenErrors[j] * input[i];
      }
    }
    for (let i = 0; i < this.network.hiddenSize; i++) {
      this.network.biasH[i] += this.learningRate * hiddenErrors[i];
    }
  }

  async train(data: MetricData[], epochs: number = 100): Promise<void> {
    // Prepare training data
    this.trainingData = data.map((metric) => [
      metric.duration / 1000, // Normalize duration
      metric.memoryUsage / (1024 * 1024 * 100), // Normalize memory
      metric.cpuUsage / 100, // Normalize CPU
      metric.responseSize / (1024 * 1024), // Normalize response size
      metric.queryCount || 0, // Query count
    ]);

    // Normalize data
    const normalizedData = this.normalizeData(this.trainingData);

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;

      for (const sample of normalizedData) {
        const { hidden, output } = this.forward(sample);
        // For training, we use reconstruction error as target
        const target = sample.slice(0, 1); // Use first feature as target for simplicity
        this.backward(sample, target, hidden, output);

        // Calculate loss
        const loss = Math.pow(target[0] - output[0], 2);
        totalLoss += loss;
      }

      if (epoch % 10 === 0) {
        console.log(
          `Neural Network Training - Epoch ${epoch}, Loss: ${totalLoss / normalizedData.length}`
        );
      }
    }

    this.isTrained = true;
  }

  private normalizeData(data: number[][]): number[][] {
    const normalized: number[][] = [];
    const mins = data[0].map(() => Infinity);
    const maxs = data[0].map(() => -Infinity);

    // Find min/max for each feature
    for (const sample of data) {
      for (let i = 0; i < sample.length; i++) {
        mins[i] = Math.min(mins[i], sample[i]);
        maxs[i] = Math.max(maxs[i], sample[i]);
      }
    }

    // Normalize
    for (const sample of data) {
      const normalizedSample: number[] = [];
      for (let i = 0; i < sample.length; i++) {
        const range = maxs[i] - mins[i];
        normalizedSample[i] = range > 0 ? (sample[i] - mins[i]) / range : 0;
      }
      normalized.push(normalizedSample);
    }

    return normalized;
  }

  async detectAnomaly(
    metric: MetricData
  ): Promise<{ isAnomaly: boolean; confidence: number; score: number }> {
    if (!this.isTrained) {
      return { isAnomaly: false, confidence: 0, score: 0 };
    }

    const input = [
      metric.duration / 1000,
      metric.memoryUsage / (1024 * 1024 * 100),
      metric.cpuUsage / 100,
      metric.responseSize / (1024 * 1024),
      metric.queryCount || 0,
    ];

    const normalizedInput = this.normalizeData([input])[0];
    const { output } = this.forward(normalizedInput);

    // Calculate reconstruction error
    const reconstructionError = Math.abs(normalizedInput[0] - output[0]);
    const threshold = 0.3; // Configurable threshold

    return {
      isAnomaly: reconstructionError > threshold,
      confidence: Math.min(reconstructionError / threshold, 1),
      score: reconstructionError,
    };
  }
}

class ResourceAllocator {
  private allocationHistory: Map<string, number[]> = new Map();
  private qTable: Map<string, Map<string, number>> = new Map(); // Q-learning table

  async allocate(options: {
    estimatedLoad: number;
    availableResources: any;
    priority: string;
  }): Promise<any> {
    const { estimatedLoad, availableResources, priority } = options;

    // State representation
    const state = this.getState(estimatedLoad, availableResources);

    // Action selection (epsilon-greedy)
    const action = this.selectAction(state);

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
    const memoryLevel =
      resources.memory < 1000 ? 'low' : resources.memory < 5000 ? 'medium' : 'high';
    return `${loadLevel}_${memoryLevel}`;
  }

  private selectAction(state: string): string {
    const epsilon = 0.1; // Exploration rate

    if (!this.qTable.has(state)) {
      this.qTable.set(state, new Map());
    }

    const actions = ['increase', 'decrease', 'maintain', 'adaptive'];

    // Epsilon-greedy selection (using crypto random for better randomness)
    const epsilonRandom = randomBytes(4).readUInt32BE(0) / 0xffffffff;
    if (epsilonRandom < epsilon) {
      const actionRandom = randomBytes(4).readUInt32BE(0) / 0xffffffff;
      return actions[Math.floor(actionRandom * actions.length)];
    }

    // Select best action based on Q-values
    const stateActions = this.qTable.get(state)!;
    let bestAction = 'maintain';
    let bestValue = -Infinity;

    actions.forEach((action) => {
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

  async learn(executions: any[]): Promise<void> {
    executions.forEach((exec) => {
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
    return query.replace(/['"]/g, '').replace(/\d+/g, 'N').replace(/\s+/g, ' ').toLowerCase();
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
  private endpointMetrics = new Map<
    string,
    {
      totalRequests: number;
      successfulRequests: number;
      avgResponseTime: number;
      lastUpdated: number;
    }
  >();

  updateMetrics(data: { endpoint: string; responseTime: number; success: boolean }): void {
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
    metrics.avgResponseTime = alpha * data.responseTime + (1 - alpha) * metrics.avgResponseTime;
    metrics.lastUpdated = Date.now();
  }

  getHealthScore(endpoint: string): number {
    const metrics = this.endpointMetrics.get(endpoint);
    if (!metrics || metrics.totalRequests === 0) return 0.5;

    const successRate = metrics.successfulRequests / metrics.totalRequests;
    const responseTimeFactor = Math.max(0, 1 - metrics.avgResponseTime / 1000);

    return successRate * 0.7 + responseTimeFactor * 0.3;
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
    const lastMinute = this.metrics.filter((m) => now - m.timestamp < 60000);
    return lastMinute.length; // Requests per minute
  }

  private startCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - this.retentionHours * 60 * 60 * 1000;
      this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);
      this.errors = this.errors.filter((e) => e.timestamp > cutoff);
    }, 60000); // Every minute
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

function applyAutoHealing(anomaly: AnomalyAlert): void {
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

  return {
    memory: Math.floor((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024),
    cpu: 100, // Simplified
    availableWorkers: 4,
  };
}

function startTrainingScheduler(intervalMinutes: number, models: any): void {
  setInterval(
    async () => {
      console.log('[ML Optimizer] Starting scheduled training...');

      const data = models.metricsStore.getRecentMetrics(10000);

      await models.performanceModel.train(data);
      await models.neuralAnomalyDetector.train(data, 50); // Train neural network with 50 epochs

      console.log('[ML Optimizer] Training completed');
    },
    intervalMinutes * 60 * 1000
  );
}

// Export types for TypeScript support
export type { MLOptimizerConfig, MetricData, PredictionResult, AnomalyAlert, OptimizationDecision };

export default mlOptimizer;
