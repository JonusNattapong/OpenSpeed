import type { Context } from '../context.js';
import { createHash } from 'crypto';

type Middleware = (ctx: Context, next: () => Promise<unknown>) => unknown;

interface SecurityConfig {
  aiDetection?: {
    enabled: boolean;
    sensitivity: number; // 0-1
    learningPeriod: number; // minutes
  };
  behavioralAnalysis?: {
    enabled: boolean;
    trackPatterns: boolean;
    anomalyThreshold: number;
  };
  threatIntelligence?: {
    enabled: boolean;
    blockKnownMalicious: boolean;
    ipBlacklist: string[];
  };
  advancedRateLimit?: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
    aiAdaptive: boolean;
  };
  autoBlocking?: {
    enabled: boolean;
    maxViolations: number;
    blockDuration: number; // minutes
  };
}

interface RequestPattern {
  ip: string;
  userAgent: string;
  endpoint: string;
  method: string;
  timestamp: number;
  responseTime: number;
  statusCode: number;
  suspicious: boolean;
}

interface ThreatScore {
  ip: string;
  score: number;
  violations: string[];
  lastActivity: number;
  blocked: boolean;
  blockExpiry?: number;
}

// AI-powered anomaly detector
class AnomalyDetector {
  private patterns: RequestPattern[] = [];
  private maxPatterns = 10000;
  private learningPeriod: number;

  constructor(learningPeriod: number) {
    this.learningPeriod = learningPeriod * 60 * 1000; // Convert to ms
  }

  recordRequest(pattern: RequestPattern): void {
    this.patterns.push(pattern);

    // Keep only recent patterns
    const cutoff = Date.now() - this.learningPeriod;
    this.patterns = this.patterns.filter((p) => p.timestamp > cutoff);

    if (this.patterns.length > this.maxPatterns) {
      this.patterns.shift();
    }
  }

  detectAnomaly(pattern: RequestPattern): { isAnomaly: boolean; score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;

    // Check for unusual patterns
    const recentPatterns = this.patterns.filter(
      (p) => p.timestamp > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    );

    // 1. Unusual request frequency from same IP
    const ipRequests = recentPatterns.filter((p) => p.ip === pattern.ip).length;
    if (ipRequests > 100) {
      score += 0.3;
      reasons.push('High request frequency from IP');
    }

    // 2. Unusual endpoints
    const endpointFrequency = recentPatterns.filter((p) => p.endpoint === pattern.endpoint).length;
    const totalRequests = recentPatterns.length;
    const endpointRatio = endpointFrequency / (totalRequests || 1);
    if (endpointRatio > 0.5) {
      score += 0.2;
      reasons.push('Unusual endpoint concentration');
    }

    // 3. Unusual user agents
    const uaFrequency = recentPatterns.filter((p) => p.userAgent === pattern.userAgent).length;
    const uaRatio = uaFrequency / (totalRequests || 1);
    if (uaRatio > 0.3) {
      score += 0.15;
      reasons.push('Unusual user agent pattern');
    }

    // 4. Failed requests ratio
    const failedRequests = recentPatterns.filter((p) => p.statusCode >= 400).length;
    const failureRatio = failedRequests / (totalRequests || 1);
    if (failureRatio > 0.5) {
      score += 0.25;
      reasons.push('High failure rate');
    }

    // 5. Suspicious patterns
    if (pattern.endpoint.includes('../') || pattern.endpoint.includes('..\\')) {
      score += 0.5;
      reasons.push('Path traversal attempt');
    }

    if (pattern.userAgent.includes('sqlmap') || pattern.userAgent.includes('nmap')) {
      score += 0.8;
      reasons.push('Known malicious tool detected');
    }

    return {
      isAnomaly: score > 0.5,
      score,
      reasons,
    };
  }

  getStats(): { totalPatterns: number; anomaliesDetected: number } {
    const anomalies = this.patterns.filter((p) => p.suspicious).length;
    return {
      totalPatterns: this.patterns.length,
      anomaliesDetected: anomalies,
    };
  }
}

// Behavioral analyzer
class BehavioralAnalyzer {
  private userProfiles = new Map<
    string,
    {
      requests: RequestPattern[];
      normalBehavior: {
        avgResponseTime: number;
        commonEndpoints: string[];
        requestFrequency: number;
      };
    }
  >();

  analyzeBehavior(ip: string, pattern: RequestPattern): { deviation: number; flags: string[] } {
    if (!this.userProfiles.has(ip)) {
      this.userProfiles.set(ip, {
        requests: [],
        normalBehavior: {
          avgResponseTime: 0,
          commonEndpoints: [],
          requestFrequency: 0,
        },
      });
    }

    const profile = this.userProfiles.get(ip)!;
    profile.requests.push(pattern);

    // Keep only recent requests (last hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    profile.requests = profile.requests.filter((r) => r.timestamp > oneHourAgo);

    // Update normal behavior
    if (profile.requests.length > 10) {
      const avgResponseTime =
        profile.requests.reduce((sum, r) => sum + r.responseTime, 0) / profile.requests.length;
      const endpointCounts = profile.requests.reduce(
        (counts, r) => {
          counts[r.endpoint] = (counts[r.endpoint] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>
      );
      const commonEndpoints = Object.entries(endpointCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([endpoint]) => endpoint);

      profile.normalBehavior = {
        avgResponseTime,
        commonEndpoints,
        requestFrequency: profile.requests.length / 60, // per minute
      };
    }

    // Calculate deviation
    const flags: string[] = [];
    let deviation = 0;

    if (profile.requests.length > 10) {
      // Check response time deviation
      const responseTimeDev =
        Math.abs(pattern.responseTime - profile.normalBehavior.avgResponseTime) /
        profile.normalBehavior.avgResponseTime;
      if (responseTimeDev > 2) {
        deviation += 0.2;
        flags.push('Unusual response time');
      }

      // Check endpoint deviation
      if (!profile.normalBehavior.commonEndpoints.includes(pattern.endpoint)) {
        deviation += 0.15;
        flags.push('Unusual endpoint access');
      }

      // Check request frequency
      const currentFreq =
        profile.requests.filter((r) => r.timestamp > Date.now() - 5 * 60 * 1000).length / 5;
      if (currentFreq > profile.normalBehavior.requestFrequency * 3) {
        deviation += 0.25;
        flags.push('Sudden request spike');
      }
    }

    return { deviation, flags };
  }
}

// Threat intelligence database
class ThreatIntelligence {
  private blacklistedIPs = new Set<string>();
  private knownMaliciousPatterns = [
    /union.*select/i,
    /script.*alert/i,
    /\.\./,
    /eval\(/,
    /base64_decode/,
    /system\(/,
    /exec\(/,
    /passthru/,
    /shell_exec/,
  ];

  constructor(blacklist: string[]) {
    blacklist.forEach((ip) => this.blacklistedIPs.add(ip));
  }

  isBlacklisted(ip: string): boolean {
    return this.blacklistedIPs.has(ip);
  }

  checkMaliciousContent(content: string): { malicious: boolean; patterns: string[] } {
    const found: string[] = [];
    for (const pattern of this.knownMaliciousPatterns) {
      if (pattern.test(content)) {
        found.push(pattern.source);
      }
    }
    return {
      malicious: found.length > 0,
      patterns: found,
    };
  }

  addToBlacklist(ip: string): void {
    this.blacklistedIPs.add(ip);
  }
}

// Advanced rate limiter with AI adaptation
class AdaptiveRateLimiter {
  private requests = new Map<string, { count: number; windowStart: number; violations: number }>();
  private blockedIPs = new Map<string, number>(); // IP -> block expiry

  constructor(
    private windowMs: number,
    private maxRequests: number,
    private aiAdaptive: boolean
  ) {}

  checkLimit(
    ip: string,
    currentLoad: number
  ): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const blockExpiry = this.blockedIPs.get(ip);

    if (blockExpiry && now < blockExpiry) {
      return { allowed: false, remaining: 0, resetTime: blockExpiry };
    }

    if (blockExpiry) {
      this.blockedIPs.delete(ip);
    }

    const record = this.requests.get(ip);
    if (!record || now - record.windowStart >= this.windowMs) {
      this.requests.set(ip, { count: 1, windowStart: now, violations: record?.violations || 0 });
      return { allowed: true, remaining: this.maxRequests - 1, resetTime: now + this.windowMs };
    }

    record.count++;

    // AI adaptive: increase limit during high load periods
    let effectiveLimit = this.maxRequests;
    if (this.aiAdaptive && currentLoad > 0.8) {
      effectiveLimit = Math.floor(this.maxRequests * 1.5);
    }

    if (record.count > effectiveLimit) {
      record.violations++;
      return { allowed: false, remaining: 0, resetTime: record.windowStart + this.windowMs };
    }

    return {
      allowed: true,
      remaining: effectiveLimit - record.count,
      resetTime: record.windowStart + this.windowMs,
    };
  }

  blockIP(ip: string, duration: number): void {
    this.blockedIPs.set(ip, Date.now() + duration);
  }

  getStats(ip: string): { requests: number; violations: number; blocked: boolean } {
    const record = this.requests.get(ip);
    const blocked = this.blockedIPs.has(ip);
    return {
      requests: record?.count || 0,
      violations: record?.violations || 0,
      blocked,
    };
  }
}

// Global instances
const anomalyDetector = new AnomalyDetector(60); // 60 minutes learning
const behavioralAnalyzer = new BehavioralAnalyzer();
const threatIntel = new ThreatIntelligence([]);
const rateLimiter = new AdaptiveRateLimiter(15 * 60 * 1000, 100, true); // 15 min window, 100 requests

/**
 * Advanced security middleware with AI-powered threat detection
 *
 * Features:
 * - AI-powered anomaly detection
 * - Behavioral analysis
 * - Threat intelligence
 * - Adaptive rate limiting
 * - Auto-blocking of malicious IPs
 */
export function advancedSecurity(config: SecurityConfig): Middleware {
  // Initialize components
  if (config.threatIntelligence?.ipBlacklist) {
    config.threatIntelligence.ipBlacklist.forEach((ip) => threatIntel.addToBlacklist(ip));
  }

  return async (ctx: Context, next: () => Promise<any>) => {
    const startTime = Date.now();
    const clientIP =
      ctx.req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
      ctx.req.headers['x-real-ip']?.toString() ||
      ctx.req.headers['cf-connecting-ip']?.toString() ||
      'unknown';

    // 1. Threat Intelligence Check
    if (config.threatIntelligence?.enabled && threatIntel.isBlacklisted(clientIP)) {
      ctx.res.status = 403;
      ctx.res.body = JSON.stringify({ error: 'Access denied - IP blacklisted' });
      return;
    }

    // 2. Content Analysis
    if (config.threatIntelligence?.enabled && ctx.req.body) {
      const bodyStr = JSON.stringify(ctx.req.body);
      const analysis = threatIntel.checkMaliciousContent(bodyStr);
      if (analysis.malicious) {
        console.warn(`[Security] Malicious content detected from ${clientIP}:`, analysis.patterns);
        ctx.res.status = 400;
        ctx.res.body = JSON.stringify({ error: 'Malicious content detected' });
        return;
      }
    }

    // 3. Rate Limiting
    if (config.advancedRateLimit?.enabled) {
      const currentLoad = 0.5; // Simplified - should be calculated from system metrics
      const rateLimit = rateLimiter.checkLimit(clientIP, currentLoad);

      if (!rateLimit.allowed) {
        ctx.res.status = 429;
        ctx.res.headers = {
          ...ctx.res.headers,
          'x-ratelimit-remaining': rateLimit.remaining.toString(),
          'x-ratelimit-reset': rateLimit.resetTime.toString(),
          'retry-after': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
        };
        ctx.res.body = JSON.stringify({ error: 'Rate limit exceeded' });
        return;
      }

      ctx.res.headers = {
        ...ctx.res.headers,
        'x-ratelimit-remaining': rateLimit.remaining.toString(),
        'x-ratelimit-reset': rateLimit.resetTime.toString(),
      };
    }

    // Execute request
    await next();

    const responseTime = Date.now() - startTime;

    // 4. Create request pattern for analysis
    const pattern: RequestPattern = {
      ip: clientIP,
      userAgent: ctx.req.headers['user-agent']?.toString() || 'unknown',
      endpoint: ctx.req.url,
      method: ctx.req.method,
      timestamp: startTime,
      responseTime,
      statusCode: ctx.res.status || 200,
      suspicious: false,
    };

    // 5. AI Anomaly Detection
    if (config.aiDetection?.enabled) {
      const anomaly = anomalyDetector.detectAnomaly(pattern);
      if (anomaly.isAnomaly && anomaly.score > config.aiDetection.sensitivity) {
        pattern.suspicious = true;
        console.warn(
          `[Security AI] Anomaly detected from ${clientIP}:`,
          anomaly.reasons,
          `Score: ${anomaly.score}`
        );

        // Auto-blocking for high-confidence anomalies
        if (config.autoBlocking?.enabled && anomaly.score > 0.8) {
          const stats = rateLimiter.getStats(clientIP);
          if (stats.violations >= (config.autoBlocking.maxViolations || 5)) {
            rateLimiter.blockIP(clientIP, (config.autoBlocking.blockDuration || 60) * 60 * 1000);
            console.warn(`[Security] Auto-blocked IP ${clientIP} for suspicious activity`);
          }
        }
      }
    }

    // 6. Behavioral Analysis
    if (config.behavioralAnalysis?.enabled) {
      const behavior = behavioralAnalyzer.analyzeBehavior(clientIP, pattern);
      if (behavior.deviation > config.behavioralAnalysis.anomalyThreshold) {
        console.warn(`[Security] Behavioral anomaly from ${clientIP}:`, behavior.flags);
      }
    }

    // 7. Record pattern for learning
    anomalyDetector.recordRequest(pattern);

    // 8. Add security headers
    ctx.res.headers = {
      ...ctx.res.headers,
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'x-xss-protection': '1; mode=block',
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'content-security-policy': "default-src 'self'",
    };
  };
}

/**
 * Security management utilities
 */
export const securityUtils = {
  getAnomalyStats: () => anomalyDetector.getStats(),

  getRateLimitStats: (ip: string) => rateLimiter.getStats(ip),

  addToBlacklist: (ip: string) => threatIntel.addToBlacklist(ip),

  isBlacklisted: (ip: string) => threatIntel.isBlacklisted(ip),

  analyzeContent: (content: string) => threatIntel.checkMaliciousContent(content),

  getBehavioralProfile: (ip: string) => behavioralAnalyzer['userProfiles'].get(ip),
};
