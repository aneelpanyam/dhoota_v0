type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  traceId?: string;
  [key: string]: unknown;
}

function formatEntry(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): LogEntry {
  let traceId: string | undefined;

  if (typeof window === "undefined") {
    // Server-side: include trace ID from AsyncLocalStorage
    // Dynamic import avoidance — require inline to prevent bundling issues on client
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getTraceId } = require("./tracing") as { getTraceId: () => string };
      const id = getTraceId();
      if (id !== "no-trace") traceId = id;
    } catch {
      // tracing module unavailable (client bundle) — skip
    }
  }

  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(traceId && { traceId }),
    ...context,
  };
}

function emit(entry: LogEntry): void {
  const json = JSON.stringify(entry);
  switch (entry.level) {
    case "debug":
      console.debug(json);
      break;
    case "info":
      console.info(json);
      break;
    case "warn":
      console.warn(json);
      break;
    case "error":
      console.error(json);
      break;
  }
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>) {
    emit(formatEntry("debug", message, context));
  },
  info(message: string, context?: Record<string, unknown>) {
    emit(formatEntry("info", message, context));
  },
  warn(message: string, context?: Record<string, unknown>) {
    emit(formatEntry("warn", message, context));
  },
  error(message: string, context?: Record<string, unknown>) {
    emit(formatEntry("error", message, context));
  },
};
