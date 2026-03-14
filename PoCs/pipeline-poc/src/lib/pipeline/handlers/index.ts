import { registerHandler } from "./registry";
import { sqlHandler } from "./sql-handler";
import { traceLogsHandler } from "./trace-logs-handler";
import { socialPostHandler } from "./social-post-handler";

registerHandler("sql", sqlHandler);
registerHandler("trace_logs", traceLogsHandler);
registerHandler("social_post", socialPostHandler);

export { getHandler, registerHandler } from "./registry";
export type { PipelineHandler, PipelineHandlerContext } from "./types";
