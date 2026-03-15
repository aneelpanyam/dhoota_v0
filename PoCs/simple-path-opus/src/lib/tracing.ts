import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";

interface TraceContext {
  traceId: string;
}

const traceStorage = new AsyncLocalStorage<TraceContext>();

/** Generate a new trace ID (UUIDv4). */
export function generateTraceId(): string {
  return randomUUID();
}

/** Get the current request's trace ID, or "no-trace" if outside a traced context. */
export function getTraceId(): string {
  return traceStorage.getStore()?.traceId ?? "no-trace";
}

/**
 * Run a function within a traced context.
 * Use in server actions, API routes, and middleware to establish per-request tracing.
 */
export function withTraceId<T>(fn: () => T, traceId?: string): T {
  const id = traceId ?? generateTraceId();
  return traceStorage.run({ traceId: id }, fn);
}
