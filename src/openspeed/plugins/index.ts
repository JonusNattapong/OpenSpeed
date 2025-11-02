export { cors } from './cors.js';
export { security, securityPresets, generateCSRFToken, setCSRFCookie } from './security.js';
export { logger } from './logger.js';
export { json } from './json.js';
export { validate, createValidatedHandler } from './validate.js';
export { openapi } from './openapi.js';
export { auth, requireAuth } from './auth.js';
export { rateLimit } from './rateLimit.js';
export { serveStatic } from './static.js';
export { upload, single, array, fields } from './upload.js';
export { websocket, WebSocketRoom, wsRoom } from './websocket.js';
export { cookie, setCookie, getCookie, deleteCookie, clearCookies } from './cookie.js';
export { graphql } from './graphql.js';
export { stripePlugin } from './stripe.js';
export { emailPlugin } from './email.js';
export { twilioPlugin } from './twilio.js';
export { storagePlugin } from './storage.js';
export { compressionPlugin } from './compression.js';
export { memoryPlugin } from './memory.js';
export { loadBalancerPlugin } from './loadBalancer.js';
export { circuitBreakerPlugin } from './circuitBreaker.js';
export { tracingPlugin } from './tracing.js';
export { metricsPlugin } from './metrics.js';
export { dashboardPlugin } from './dashboard.js';
export { anomalyPlugin } from './anomaly.js';
export { hotReloadPlugin } from './hotReload.js';
export { playgroundPlugin } from './playground.js';
export { codeGenPlugin } from './codegen.js';
export * from './errorHandler.js';

// New features (inspired by Hono & Elysia)
export {
  jsxPlugin,
  jsx,
  h,
  createElement,
  Fragment,
  renderToString,
  html,
  raw,
  Layout,
  Html,
  Head,
  Body,
  Title,
  Meta,
  Link,
  Script,
  Style,
  Div,
  Span,
  P,
  A,
  Img,
  Button,
  Input,
  Form,
  Label,
  H1,
  H2,
  H3,
  Ul,
  Li,
} from './jsx.js';

export { ssg, generateStatic, defineRoutes, generateSitemap, generateRobots } from './ssg.js';

export {
  rpc,
  createClient,
  treaty,
  batch,
  defineRoute,
  createContract,
  RPCSubscription,
} from './rpc.js';

export {
  stream,
  fromArray,
  fromReadableStream,
  pipe,
  filter,
  batch as batchStream,
  throttle,
  merge,
  streamFile,
} from './stream.js';

// Advanced features (Phase 1-6 roadmap)
export { fileRouting, watchRoutes } from './fileRouting.js';
export {
  database,
  MongoQueryBuilder,
  SQLQueryBuilder,
  RedisCache,
  closeAllConnections,
} from './database.js';
export { rbac, requirePermission, requireRole, RoleBuilder } from './rbac.js';
export { auditLog, queryAuditLogs } from './auditLog.js';
export {
  kubernetesOperator,
  generateDeploymentManifest,
  generateHPAManifest,
} from './kubernetes.js';
export {
  adaptiveOptimizer,
  streamLargeResponse,
  ObjectPool,
  BloomFilter,
} from './adaptiveOptimizer.js';

// Type exports for better TypeScript support
export type { SecurityOptions, SecurityEvent } from './security.js';
export type { ValidationOptions, ValidationError, Validator } from './validate.js';
export type { JSXOptions, JSXElement, JSXChild } from './jsx.js';
export type { SSGOptions, SSGRoute, SSGStats, SSGContext } from './ssg.js';
export type { RPCClientOptions, RPCResponse, RequestOptions, RPCClient, RPCApp } from './rpc.js';
export type { StreamOptions, SSEOptions } from './stream.js';
