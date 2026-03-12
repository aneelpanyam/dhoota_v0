export interface LlmCallDebug {
  model: string;
  systemPrompt: string;
  userInput: string;
  response: string;
  finishReason?: string;
}

export interface SqlCallDebug {
  sql: string;
  params: unknown[];
  rowCount: number;
}

export interface PipelineStep {
  name: string;
  durationMs: number;
  success: boolean;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  llm?: LlmCallDebug;
  sql?: SqlCallDebug[];
}

export interface PipelineTraceData {
  traceId: string;
  startedAt: string;
  totalDurationMs: number;
  steps: PipelineStep[];
  request: {
    source: string;
    optionId?: string;
    hasContent: boolean;
  };
}

type LogLevel = "full" | "summary" | "off";

function getLogLevel(): LogLevel {
  const level = process.env.DEBUG_LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "off" : "full");
  if (level === "full" || level === "summary" || level === "off") return level;
  return "off";
}

export class PipelineTrace {
  private steps: PipelineStep[] = [];
  private startTime: number;
  private traceId: string;
  private level: LogLevel;
  private requestMeta: PipelineTraceData["request"];

  constructor(requestMeta: PipelineTraceData["request"]) {
    this.startTime = Date.now();
    this.traceId = crypto.randomUUID();
    this.level = getLogLevel();
    this.requestMeta = requestMeta;
  }

  isEnabled(): boolean {
    return this.level !== "off";
  }

  async step<T>(
    name: string,
    fn: () => Promise<T>,
    captureInput?: Record<string, unknown>
  ): Promise<T> {
    if (!this.isEnabled()) return fn();

    const stepStart = Date.now();
    try {
      const result = await fn();
      const step: PipelineStep = {
        name,
        durationMs: Date.now() - stepStart,
        success: true,
      };
      if (this.level === "full") {
        if (captureInput) step.input = captureInput;
        if (result && typeof result === "object") {
          step.output = this.summarizeOutput(result as Record<string, unknown>);
        }
      }
      this.steps.push(step);
      return result;
    } catch (err) {
      this.steps.push({
        name,
        durationMs: Date.now() - stepStart,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  enrichLastStep(extra: { llm?: LlmCallDebug; sql?: SqlCallDebug[] }) {
    if (this.steps.length === 0 || this.level !== "full") return;
    const last = this.steps[this.steps.length - 1];
    if (extra.llm) last.llm = extra.llm;
    if (extra.sql) last.sql = extra.sql;
  }

  private summarizeOutput(obj: Record<string, unknown>): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      if (val === null || val === undefined) {
        summary[key] = val;
      } else if (Array.isArray(val)) {
        summary[key] = `[Array(${val.length})]`;
      } else if (typeof val === "string" && val.length > 300) {
        summary[key] = val.slice(0, 300) + "...";
      } else if (typeof val === "object") {
        summary[key] = `{Object}`;
      } else {
        summary[key] = val;
      }
    }
    return summary;
  }

  toJSON(): PipelineTraceData | undefined {
    if (!this.isEnabled()) return undefined;

    return {
      traceId: this.traceId,
      startedAt: new Date(this.startTime).toISOString(),
      totalDurationMs: Date.now() - this.startTime,
      steps: this.steps,
      request: this.requestMeta,
    };
  }

  /**
   * Emit structured logs for the completed trace.
   * Call after the pipeline finishes (success or failure).
   */
  emitLogs(log: (service: string, msg: string, data?: Record<string, unknown>, opts?: { traceId?: string; durationMs?: number }) => void): void {
    const totalMs = Date.now() - this.startTime;
    const failedSteps = this.steps.filter((s) => !s.success);

    log("pipeline", "Request completed", {
      source: this.requestMeta.source,
      optionId: this.requestMeta.optionId ?? "none",
      stepCount: this.steps.length,
      failedSteps: failedSteps.length,
    }, { traceId: this.traceId, durationMs: totalMs });

    for (const step of this.steps) {
      const data: Record<string, unknown> = { success: step.success };
      if (step.error) data.error = step.error;
      if (step.llm) data.llmModel = step.llm.model;
      if (step.sql) data.sqlQueries = step.sql.length;

      log(`pipeline.step.${step.name}`, step.success ? "Step completed" : "Step failed", data, {
        traceId: this.traceId,
        durationMs: step.durationMs,
      });
    }
  }
}
