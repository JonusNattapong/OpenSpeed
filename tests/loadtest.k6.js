import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '30s', target: 100 }, // Ramp up to 100 users
    { duration: '1m', target: 100 }, // Stay at 100 users
    { duration: '30s', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'], // Error rate should be below 10%
  },
};

// NOTE: Use HTTPS in production. HTTP localhost is for local testing only.
const BASE_URL = __ENV.BASE_URL || 'https://localhost:3000';

export default function () {
  // Test health check
  let response = http.get(`${BASE_URL}/`);
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // Test posts endpoint
  response = http.get(`${BASE_URL}/posts`);
  check(response, {
    'posts status is 200': (r) => r.status === 200,
    'posts response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1); // Wait 1 second between iterations
}
