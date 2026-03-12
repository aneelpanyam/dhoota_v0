import { flushToCloudWatch, type LogEntry } from "./cloudwatch";

type LogLevel = "info" | "warn" | "error";

interface StructuredLog {
  timestamp: string;
  level: LogLevel;
  service: string;
  traceId?: string;
  message: string;
  data?: Record<string, unknown>;
  durationMs?: number;
}

const buffer: LogEntry[] = [];
let isCloudWatchEnabled: boolean | null = null;

let _requestTraceId: string | null = null;

function cloudWatchEnabled(): boolean {
  if (isCloudWatchEnabled === null) {
    isCloudWatchEnabled = process.env.CLOUDWATCH_ENABLED === "true";
  }
  return isCloudWatchEnabled;
}

function emit(entry: StructuredLog): void {
  const json = JSON.stringify(entry);

  if (process.env.NODE_ENV !== "production" || !cloudWatchEnabled()) {
    const prefix = entry.level === "error" ? "\x1b[31m" : entry.level === "warn" ? "\x1b[33m" : "\x1b[36m";
    const reset = "\x1b[0m";
    const tid = entry.traceId ? ` [${entry.traceId.slice(0, 8)}]` : "";
    const dur = entry.durationMs != null ? ` (${entry.durationMs}ms)` : "";
    console.log(`${prefix}[${entry.level.toUpperCase()}]${reset}${tid} ${entry.service}: ${entry.message}${dur}`);
    if (entry.data && Object.keys(entry.data).length > 0) {
      console.log("  ", JSON.stringify(entry.data, null, 2).slice(0, 500));
    }
  }

  if (cloudWatchEnabled()) {
    buffer.push({ timestamp: Date.now(), message: json });
  }
}

function log(
  level: LogLevel,
  service: string,
  message: string,
  data?: Record<string, unknown>,
  opts?: { traceId?: string; durationMs?: number }
): void {
  emit({
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    data,
    traceId: opts?.traceId ?? _requestTraceId ?? undefined,
    durationMs: opts?.durationMs,
  });
}

export const logger = {
  info(service: string, message: string, data?: Record<string, unknown>, opts?: { traceId?: string; durationMs?: number }) {
    log("info", service, message, data, opts);
  },

  warn(service: string, message: string, data?: Record<string, unknown>, opts?: { traceId?: string; durationMs?: number }) {
    log("warn", service, message, data, opts);
  },

  error(service: string, message: string, data?: Record<string, unknown>, opts?: { traceId?: string; durationMs?: number }) {
    log("error", service, message, data, opts);
  },

  /** Set a request-scoped traceId that is auto-included in all subsequent log entries. */
  setTraceId(traceId: string): void {
    _requestTraceId = traceId;
  },

  /** Clear the request-scoped traceId (call at end of request). */
  clearTraceId(): void {
    _requestTraceId = null;
  },

  /** Return the current request-scoped traceId, if set. */
  getTraceId(): string | null {
    return _requestTraceId;
  },

  /**
   * Flush buffered log entries to CloudWatch.
   * Call at the end of each request (ideally via waitUntil).
   * Returns a promise; safe to fire-and-forget if needed.
   */
  async flush(): Promise<void> {
    if (buffer.length === 0) return;
    const entries = buffer.splice(0);
    try {
      await flushToCloudWatch(entries);
    } catch (err) {
      console.error("[logger] CloudWatch flush failed, entries lost:", (err as Error).message);
    }
  },

  /** Number of buffered entries (for testing/diagnostics) */
  get bufferSize(): number {
    return buffer.length;
  },
};
