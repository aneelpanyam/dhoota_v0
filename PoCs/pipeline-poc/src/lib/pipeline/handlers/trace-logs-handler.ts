import { queryLogsByTraceId } from "@/lib/cloudwatch/logs";
import type { SqlResult } from "@/types/pipeline";
import type { PipelineHandler, PipelineHandlerContext } from "./types";

export const traceLogsHandler: PipelineHandler = {
  async execute(optionId, params, _context) {
    const traceId = params.trace_id as string | undefined;
    if (!traceId) {
      return [{
        templateName: "trace_logs",
        rows: [{ error: "trace_id is required" }],
        rowCount: 1,
        queryType: "read" as const,
      }];
    }

    const logs = await queryLogsByTraceId(traceId);
    const rows = logs.map((log) => ({
      timestamp: (log.timestamp as string) ?? (log as Record<string, unknown>).timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      data: log.data,
      traceId: log.traceId,
      durationMs: log.durationMs,
    }));

    const result: SqlResult = {
      templateName: "trace_logs",
      rows,
      rowCount: rows.length,
      queryType: "read",
    };
    return [result];
  },
};
