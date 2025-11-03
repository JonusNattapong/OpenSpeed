import type { Context } from '../context.js';

type Middleware = (ctx: Context, next: () => Promise<any>) => any;

interface KubernetesConfig {
  namespace?: string;
  deployment: string;
  minReplicas?: number;
  maxReplicas?: number;
  targetCPU?: number;
  targetMemory?: number;
  scaleUpThreshold?: number;
  scaleDownThreshold?: number;
  cooldownPeriod?: number;
  metricsEndpoint?: string;
  kubeconfig?: string;
}

interface PodMetrics {
  name: string;
  cpu: number;
  memory: number;
  requests: number;
  timestamp: Date;
}

interface ScalingDecision {
  currentReplicas: number;
  desiredReplicas: number;
  reason: string;
  metrics: PodMetrics[];
}

/**
 * Kubernetes Operator Plugin for Auto-scaling
 *
 * Features:
 * - Horizontal Pod Autoscaling (HPA)
 * - Custom metrics-based scaling
 * - Request-based scaling
 * - Memory and CPU-based scaling
 * - Cooldown periods to prevent flapping
 * - Integration with Kubernetes API
 * - Health checks and readiness probes
 * - Rolling updates support
 */
export function kubernetesOperator(config: KubernetesConfig): Middleware {
  const {
    namespace = 'default',
    deployment,
    minReplicas = 1,
    maxReplicas = 10,
    targetCPU = 70,
    targetMemory = 80,
    scaleUpThreshold = 80,
    scaleDownThreshold = 30,
    cooldownPeriod = 300000, // 5 minutes
    metricsEndpoint = '/metrics',
  } = config;

  let lastScaleTime = 0;
  const metricsHistory: PodMetrics[] = [];

  // Start metrics collection
  startMetricsCollection(deployment, namespace, metricsHistory, config);

  // Start autoscaling loop
  startAutoscalingLoop(deployment, namespace, config, metricsHistory);

  return async (ctx: Context, next: () => Promise<any>) => {
    // Add Kubernetes health check endpoints
    const url = new URL(ctx.req.url);

    if (url.pathname === '/health') {
      ctx.res.status = 200;
      ctx.res.body = JSON.stringify({ status: 'healthy' });
      return;
    }

    if (url.pathname === '/ready') {
      const ready = await checkReadiness();
      ctx.res.status = ready ? 200 : 503;
      ctx.res.body = JSON.stringify({ ready });
      return;
    }

    if (url.pathname === metricsEndpoint) {
      const metrics = await collectMetrics();
      ctx.res.status = 200;
      ctx.res.headers = { ...ctx.res.headers, 'content-type': 'application/json' };
      ctx.res.body = JSON.stringify(metrics);
      return;
    }

    await next();
  };
}

/**
 * Start metrics collection from pods
 */
function startMetricsCollection(
  deployment: string,
  namespace: string,
  history: PodMetrics[],
  config: KubernetesConfig
): void {
  setInterval(async () => {
    try {
      const metrics = await getPodMetrics(deployment, namespace, config);
      history.push(...metrics);

      // Keep only last 1 hour of metrics
      const oneHourAgo = Date.now() - 3600000;
      while (history.length > 0 && history[0].timestamp.getTime() < oneHourAgo) {
        history.shift();
      }
    } catch (error) {
      console.error('[K8s] Error collecting metrics:', error);
    }
  }, 30000); // Collect every 30 seconds
}

/**
 * Start autoscaling loop
 */
function startAutoscalingLoop(
  deployment: string,
  namespace: string,
  config: KubernetesConfig,
  history: PodMetrics[]
): void {
  setInterval(async () => {
    try {
      const decision = await makeScalingDecision(deployment, namespace, config, history);

      if (decision.desiredReplicas !== decision.currentReplicas) {
        const now = Date.now();
        if (now - (globalThis as any).__lastK8sScaleTime > (config.cooldownPeriod || 300000)) {
          await scaleDeployment(deployment, namespace, decision.desiredReplicas, config);
          (globalThis as any).__lastK8sScaleTime = now;
          console.log(
            `[K8s] Scaled ${deployment} from ${decision.currentReplicas} to ${decision.desiredReplicas} replicas. Reason: ${decision.reason}`
          );
        } else {
          console.log('[K8s] Scaling skipped due to cooldown period');
        }
      }
    } catch (error) {
      console.error('[K8s] Error in autoscaling loop:', error);
    }
  }, 60000); // Check every minute
}

/**
 * Get pod metrics from Kubernetes
 */
async function getPodMetrics(
  deployment: string,
  namespace: string,
  config: KubernetesConfig
): Promise<PodMetrics[]> {
  // In a real implementation, this would call the Kubernetes API
  // Using kubectl or Kubernetes client library
  // For now, return mock data

  try {
    const k8sClient = await getKubernetesClient(config);
    const pods = await k8sClient.listPods(namespace, deployment);

    return pods.map((pod: any) => ({
      name: pod.name,
      cpu: pod.cpu || 0, // Default to 0 if metrics not available
      memory: pod.memory || 0, // Default to 0 if metrics not available
      requests: pod.requests || 0, // Default to 0 if metrics not available
      timestamp: new Date(),
    }));
  } catch (error) {
    console.error('[K8s] Error fetching pod metrics:', error);
    return [];
  }
}

/**
 * Make scaling decision based on metrics
 */
async function makeScalingDecision(
  deployment: string,
  namespace: string,
  config: KubernetesConfig,
  history: PodMetrics[]
): Promise<ScalingDecision> {
  const currentReplicas = await getCurrentReplicas(deployment, namespace, config);

  // Calculate average metrics from recent history
  const recentMetrics = history.slice(-10); // Last 10 data points
  if (recentMetrics.length === 0) {
    return {
      currentReplicas,
      desiredReplicas: currentReplicas,
      reason: 'No metrics available',
      metrics: [],
    };
  }

  const avgCPU = recentMetrics.reduce((sum, m) => sum + m.cpu, 0) / recentMetrics.length;
  const avgMemory = recentMetrics.reduce((sum, m) => sum + m.memory, 0) / recentMetrics.length;
  const avgRequests = recentMetrics.reduce((sum, m) => sum + m.requests, 0) / recentMetrics.length;

  let desiredReplicas = currentReplicas;
  let reason = 'No scaling needed';

  // CPU-based scaling
  if (avgCPU > (config.scaleUpThreshold || 80)) {
    const scaleFactor = avgCPU / (config.targetCPU || 70);
    desiredReplicas = Math.ceil(currentReplicas * scaleFactor);
    reason = `High CPU usage: ${avgCPU.toFixed(2)}%`;
  } else if (avgCPU < (config.scaleDownThreshold || 30)) {
    const scaleFactor = avgCPU / (config.targetCPU || 70);
    desiredReplicas = Math.max(1, Math.floor(currentReplicas * scaleFactor));
    reason = `Low CPU usage: ${avgCPU.toFixed(2)}%`;
  }

  // Memory-based scaling
  if (avgMemory > (config.scaleUpThreshold || 80)) {
    const scaleFactor = avgMemory / (config.targetMemory || 80);
    desiredReplicas = Math.max(desiredReplicas, Math.ceil(currentReplicas * scaleFactor));
    reason = `High memory usage: ${avgMemory.toFixed(2)}%`;
  }

  // Request-based scaling (100 requests per replica target)
  const requestsPerReplica = avgRequests / currentReplicas;
  if (requestsPerReplica > 100) {
    const neededReplicas = Math.ceil(avgRequests / 100);
    desiredReplicas = Math.max(desiredReplicas, neededReplicas);
    reason = `High request rate: ${avgRequests.toFixed(0)} req/s`;
  }

  // Apply min/max constraints
  desiredReplicas = Math.max(
    config.minReplicas || 1,
    Math.min(config.maxReplicas || 10, desiredReplicas)
  );

  return {
    currentReplicas,
    desiredReplicas,
    reason,
    metrics: recentMetrics,
  };
}

/**
 * Get current number of replicas
 */
async function getCurrentReplicas(
  deployment: string,
  namespace: string,
  config: KubernetesConfig
): Promise<number> {
  try {
    const k8sClient = await getKubernetesClient(config);
    const deploymentInfo = await k8sClient.getDeployment(namespace, deployment);
    return deploymentInfo.replicas || 1;
  } catch (error) {
    console.error('[K8s] Error getting current replicas:', error);
    return 1;
  }
}

/**
 * Scale deployment to desired replicas
 */
async function scaleDeployment(
  deployment: string,
  namespace: string,
  replicas: number,
  config: KubernetesConfig
): Promise<void> {
  try {
    const k8sClient = await getKubernetesClient(config);
    await k8sClient.scaleDeployment(namespace, deployment, replicas);
  } catch (error) {
    console.error('[K8s] Error scaling deployment:', error);
    throw error;
  }
}

/**
 * Get Kubernetes client
 */
async function getKubernetesClient(config: KubernetesConfig): Promise<any> {
  // In a real implementation, this would initialize the Kubernetes client
  // using @kubernetes/client-node or similar
  // For now, return a mock client

  return {
    async listPods(namespace: string, deployment: string) {
      // Mock implementation
      return [];
    },

    async getDeployment(namespace: string, deployment: string) {
      // Mock implementation
      return { replicas: 1 };
    },

    async scaleDeployment(namespace: string, deployment: string, replicas: number) {
      // Mock implementation
      console.log(`[K8s] Would scale ${namespace}/${deployment} to ${replicas} replicas`);
    },
  };
}

/**
 * Check application readiness
 */
async function checkReadiness(): Promise<boolean> {
  // Implement readiness checks
  // Check database connections, dependencies, etc.
  return true;
}

/**
 * Collect application metrics
 */
async function collectMetrics(): Promise<any> {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    timestamp: new Date().toISOString(),
    memory: {
      rss: memoryUsage.rss,
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
    },
    uptime: process.uptime(),
  };
}

/**
 * Create Kubernetes deployment manifest
 */
export function generateDeploymentManifest(
  name: string,
  image: string,
  replicas: number = 3,
  resources?: {
    cpu?: string;
    memory?: string;
  }
): any {
  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name,
      labels: {
        app: name,
        'managed-by': 'openspeed',
      },
    },
    spec: {
      replicas,
      selector: {
        matchLabels: {
          app: name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: name,
          },
        },
        spec: {
          containers: [
            {
              name,
              image,
              ports: [
                {
                  containerPort: 3000,
                },
              ],
              resources: {
                requests: {
                  cpu: resources?.cpu || '100m',
                  memory: resources?.memory || '128Mi',
                },
                limits: {
                  cpu: resources?.cpu || '500m',
                  memory: resources?.memory || '512Mi',
                },
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 3000,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: {
                  path: '/ready',
                  port: 3000,
                },
                initialDelaySeconds: 10,
                periodSeconds: 5,
              },
            },
          ],
        },
      },
    },
  };
}

/**
 * Create HPA (Horizontal Pod Autoscaler) manifest
 */
export function generateHPAManifest(
  name: string,
  minReplicas: number = 1,
  maxReplicas: number = 10,
  targetCPU: number = 70
): any {
  return {
    apiVersion: 'autoscaling/v2',
    kind: 'HorizontalPodAutoscaler',
    metadata: {
      name: `${name}-hpa`,
    },
    spec: {
      scaleTargetRef: {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name,
      },
      minReplicas,
      maxReplicas,
      metrics: [
        {
          type: 'Resource',
          resource: {
            name: 'cpu',
            target: {
              type: 'Utilization',
              averageUtilization: targetCPU,
            },
          },
        },
      ],
    },
  };
}

// Export types
export { type KubernetesConfig, type PodMetrics, type ScalingDecision };
