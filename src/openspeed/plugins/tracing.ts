import { trace, Span, Tracer, TracerProvider } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';
import type { Context } from '../context.js';

export interface TracingOptions {
  serviceName?: string;
  serviceVersion?: string;
  exporter?: 'console' | 'jaeger' | 'zipkin' | 'otlp';
  jaegerEndpoint?: string;
  zipkinEndpoint?: string;
  otlpEndpoint?: string;
  sampleRate?: number; // 0.0 to 1.0
}

export class TracingManager {
  private tracer: Tracer;
  private provider: NodeTracerProvider;

  constructor(options: TracingOptions = {}) {
    const {
      serviceName = 'openspeed-app',
      serviceVersion = '1.0.0',
      exporter = 'console',
      sampleRate = 1.0
    } = options;

    // Initialize tracer provider
    this.provider = new NodeTracerProvider();

    // Configure exporter
    let spanExporter;
    switch (exporter) {
      case 'console':
        spanExporter = new ConsoleSpanExporter();
        break;
      case 'jaeger':
        // Would need @opentelemetry/exporter-jaeger
        spanExporter = new ConsoleSpanExporter(); // Fallback
        break;
      case 'zipkin':
        // Would need @opentelemetry/exporter-zipkin
        spanExporter = new ConsoleSpanExporter(); // Fallback
        break;
      case 'otlp':
        // Would need @opentelemetry/exporter-otlp-http
        spanExporter = new ConsoleSpanExporter(); // Fallback
        break;
      default:
        spanExporter = new ConsoleSpanExporter();
    }

    this.provider.addSpanProcessor(new SimpleSpanProcessor(spanExporter));
    this.provider.register();

    this.tracer = trace.getTracer(serviceName, serviceVersion);
  }

  createSpan(name: string, parentSpan?: Span): Span {
    const spanOptions: any = {
      name,
    };

    if (parentSpan) {
      spanOptions.parent = parentSpan;
    }

    return this.tracer.startSpan(name, spanOptions);
  }

  getTracer(): Tracer {
    return this.tracer;
  }

  shutdown(): Promise<void> {
    return this.provider.shutdown();
  }
}

export function tracingPlugin(options: TracingOptions = {}) {
  const tracingManager = new TracingManager(options);

  return async (ctx: Context, next: () => Promise<any>) => {
    // Create a span for this request
    const span = tracingManager.createSpan(`${ctx.req.method} ${ctx.req.url}`, undefined);

    // Add request information to span
    span.setAttribute('http.method', ctx.req.method);
    span.setAttribute('http.url', ctx.req.url);
    span.setAttribute('http.user_agent', ctx.req.headers['user-agent'] as string || '');

    // Add span to context
    ctx.tracing = {
      span,
      createChildSpan: (name: string) => tracingManager.createSpan(name, span),
      getTracer: () => tracingManager.getTracer(),
      setAttribute: (key: string, value: any) => span.setAttribute(key, value),
      addEvent: (name: string, attributes?: Record<string, any>) => span.addEvent(name, attributes),
      setStatus: (code: number, message?: string) => span.setStatus({ code, message }),
      end: () => span.end()
    };

    try {
      await next();

      // Set response attributes
      span.setAttribute('http.status_code', ctx.res.status || 200);
      span.setStatus({ code: 0 }); // OK
    } catch (error: any) {
      // Record error
      span.recordException(error);
      span.setStatus({ code: 1, message: error.message }); // ERROR
      throw error;
    } finally {
      span.end();
    }
  };
}

// Helper function to create traced external calls
export async function tracedFetch(
  url: string,
  options: RequestInit = {},
  span?: Span
): Promise<Response> {
  const tracer = trace.getTracer('openspeed');
  const fetchSpan = tracer.startSpan(`HTTP ${options.method || 'GET'} ${url}`);

  fetchSpan.setAttribute('http.method', options.method || 'GET');
  fetchSpan.setAttribute('http.url', url);

  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    fetchSpan.setAttribute('http.status_code', response.status);
    fetchSpan.setAttribute('http.duration_ms', duration);
    fetchSpan.setStatus({ code: 0 });

    return response;
  } catch (error: any) {
    fetchSpan.recordException(error);
    fetchSpan.setStatus({ code: 1, message: error.message });
    throw error;
  } finally {
    fetchSpan.end();
  }
}