import { TraceContext } from '../tracing/TraceContext';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'authorization',
  'apikey',
  'creditcard',
  'cvv',
]);

export class StructuredLogger {
  private minLevel: LogLevel;
  private serviceName: string;

  constructor(serviceName: string = 'taskflow', minLevel: LogLevel = 'info') {
    this.serviceName = serviceName;
    this.minLevel = minLevel;
  }

  private sanitize(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitize(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    trace?: TraceContext
  ): void {
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      level,
      message,
      traceId: trace?.traceId,
      spanId: trace?.spanId,
      context: context ? this.sanitize(context) : undefined,
    };

    const output = JSON.stringify(entry);
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, context?: Record<string, any>, trace?: TraceContext): void {
    this.log('debug', message, context, trace);
  }

  info(message: string, context?: Record<string, any>, trace?: TraceContext): void {
    this.log('info', message, context, trace);
  }

  warn(message: string, context?: Record<string, any>, trace?: TraceContext): void {
    this.log('warn', message, context, trace);
  }

  error(message: string, context?: Record<string, any>, trace?: TraceContext): void {
    this.log('error', message, context, trace);
  }
}
