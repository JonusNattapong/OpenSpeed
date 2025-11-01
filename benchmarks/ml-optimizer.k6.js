import { describe, it, expect, beforeEach } from 'vitest';
import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * Load Test: ML Optimizer Plugin
 * 
 * This script tests the ML optimizer under various load conditions
 * to validate performance improvements and anomaly detection.
 */

export const options = {
  stages: [
    // Warm-up
    { duration: '30s', target: 20 },
    
    // Ramp up to test ML learning
    { duration: '1m', target: 50 },
    
    // Sustained load for ML training
    { duration: '2m', target: 100 },
    
    // Spike test for anomaly detection
    { duration: '30s', target: 200 },
    
    // Cool down
    { duration: '30s', target: 50 },
    { duration: '30s', target: 0 },
  ],
  
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.05'],
    'ml_prediction_confidence': ['avg>70'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test different endpoints with different priorities
  
  // 1. High-frequency endpoint (should be cached)
  const productsRes = http.get(`${BASE_URL}/api/products?page=1&limit=20`);
  
  check(productsRes, {
    'products: status 200': (r) => r.status === 200,
    'products: has ML headers': (r) => 
      r.headers['X-Ml-Prediction-Confidence'] !== undefined,
    'products: response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  // Track ML confidence
  const confidence = parseInt(productsRes.headers['X-Ml-Prediction-Confidence'] || '0');
  
  // 2. Search endpoint (variable performance)
  const searchRes = http.get(`${BASE_URL}/api/search?q=laptop`);
  
  check(searchRes, {
    'search: status 200': (r) => r.status === 200,
    'search: has results': (r) => JSON.parse(r.body).results.length > 0,
    'search: optimization applied': (r) => 
      r.headers['X-Optimization-Applied'] !== 'none',
  });
  
  // 3. Product details (should be prefetched)
  const productId = Math.floor(Math.random() * 5) + 1;
  const detailRes = http.get(`${BASE_URL}/api/products/${productId}`);
  
  check(detailRes, {
    'detail: status 200': (r) => r.status === 200,
    'detail: fast response': (r) => r.timings.duration < 100,
  });
  
  // 4. Occasionally test checkout (high priority)
  if (Math.random() < 0.1) {
    const checkoutRes = http.post(
      `${BASE_URL}/api/checkout`,
      JSON.stringify({
        paymentMethod: 'credit_card',
        shippingAddress: {
          street: '123 Main St',
          city: 'Bangkok',
        },
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Priority': 'high',
        },
      }
    );
    
    check(checkoutRes, {
      'checkout: processed': (r) => r.status === 200 || r.status === 401,
      'checkout: high priority honored': (r) => r.timings.duration < 300,
    });
  }
  
  // 5. Test anomaly detection with stress endpoint
  if (Math.random() < 0.05) {
    const stressRes = http.get(`${BASE_URL}/api/stress-test?complexity=1000`);
    
    check(stressRes, {
      'stress: completed': (r) => r.status === 200,
      'stress: anomaly detected': (r) => {
        const anomalyScore = parseFloat(r.headers['X-Anomaly-Score'] || '0');
        return anomalyScore > 0;
      },
    });
  }
  
  // Simulate realistic user behavior
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 seconds between requests
}

/**
 * Test ML learning over time
 */
export function mlLearningTest() {
  const iterations = 100;
  const endpoint = `${BASE_URL}/api/products`;
  
  let confidences = [];
  
  for (let i = 0; i < iterations; i++) {
    const res = http.get(endpoint);
    const confidence = parseInt(res.headers['X-Ml-Prediction-Confidence'] || '0');
    confidences.push(confidence);
    
    if (i % 10 === 0) {
      console.log(`Iteration ${i}: Confidence ${confidence}%`);
    }
    
    sleep(0.1);
  }
  
  // Confidence should increase over time as ML learns
  const firstTen = confidences.slice(0, 10).reduce((a, b) => a + b) / 10;
  const lastTen = confidences.slice(-10).reduce((a, b) => a + b) / 10;
  
  console.log(`Learning Progress: ${firstTen}% → ${lastTen}%`);
  
  expect(lastTen).toBeGreaterThan(firstTen);
}

/**
 * Test anomaly detection
 */
export function anomalyDetectionTest() {
  // Generate normal traffic
  for (let i = 0; i < 50; i++) {
    http.get(`${BASE_URL}/api/products`);
    sleep(0.1);
  }
  
  // Generate anomalous spike
  for (let i = 0; i < 20; i++) {
    const res = http.get(`${BASE_URL}/api/stress-test?complexity=5000`);
    const anomalyScore = parseFloat(res.headers['X-Anomaly-Score'] || '0');
    
    if (anomalyScore > 0.5) {
      console.log(`⚠️  Anomaly detected! Score: ${anomalyScore}`);
    }
  }
}

/**
 * Test resource allocation
 */
export function resourceAllocationTest() {
  // High priority requests
  const highPriorityRes = http.post(
    `${BASE_URL}/api/checkout`,
    JSON.stringify({
      paymentMethod: 'test',
      shippingAddress: { city: 'Test' },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Priority': 'high',
      },
    }
  );
  
  // Low priority requests
  const lowPriorityRes = http.get(`${BASE_URL}/api/analytics`, {
    headers: {
      'X-Priority': 'low',
    },
  });
  
  // High priority should be faster
  expect(highPriorityRes.timings.duration).toBeLessThan(
    lowPriorityRes.timings.duration
  );
}

/**
 * Summary statistics
 */
export function handleSummary(data) {
  const mlStats = {
    total_requests: data.metrics.http_reqs.values.count,
    avg_duration: data.metrics.http_req_duration.values.avg,
    p95_duration: data.metrics.http_req_duration.values['p(95)'],
    p99_duration: data.metrics.http_req_duration.values['p(99)'],
    error_rate: data.metrics.http_req_failed.values.rate,
  };
  
  console.log('\n📊 ML Optimizer Performance Summary:');
  console.log('=====================================');
  console.log(`Total Requests: ${mlStats.total_requests}`);
  console.log(`Average Duration: ${mlStats.avg_duration.toFixed(2)}ms`);
  console.log(`P95 Duration: ${mlStats.p95_duration.toFixed(2)}ms`);
  console.log(`P99 Duration: ${mlStats.p99_duration.toFixed(2)}ms`);
  console.log(`Error Rate: ${(mlStats.error_rate * 100).toFixed(2)}%`);
  console.log('=====================================\n');
  
  return {
    'ml-optimizer-summary.json': JSON.stringify(mlStats, null, 2),
  };
}
