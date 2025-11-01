import { describe, it, expect } from 'vitest';
import { kubernetesOperator, generateDeploymentManifest, generateHPAManifest } from '../../dist/src/openspeed/plugins/kubernetes.js';

describe('Kubernetes Operator Plugin', () => {
  it('should create kubernetes operator plugin', () => {
    const plugin = kubernetesOperator({
      deployment: 'my-app',
      minReplicas: 1,
      maxReplicas: 10,
    });

    expect(plugin).toBeDefined();
    expect(typeof plugin).toBe('function');
  });

  it('should generate deployment manifest', () => {
    const manifest = generateDeploymentManifest('my-app', 'my-image:latest', 3);

    expect(manifest).toBeDefined();
    expect(manifest.kind).toBe('Deployment');
    expect(manifest.spec.replicas).toBe(3);
    expect(manifest.spec.template.spec.containers[0].image).toBe('my-image:latest');
  });

  it('should generate HPA manifest', () => {
    const manifest = generateHPAManifest('my-app', 1, 10, 70);

    expect(manifest).toBeDefined();
    expect(manifest.kind).toBe('HorizontalPodAutoscaler');
    expect(manifest.spec.minReplicas).toBe(1);
    expect(manifest.spec.maxReplicas).toBe(10);
  });

  it('should include health check endpoints', () => {
    const plugin = kubernetesOperator({
      deployment: 'my-app',
    });

    expect(plugin).toBeDefined();
  });
});
