import type { SqlResult } from "@/types/pipeline";

export interface PipelineHandlerContext {
  tenantId: string;
  userId: string;
  scopedUserId?: string;
  userType?: string;
}

export interface PipelineHandler {
  execute(
    optionId: string,
    params: Record<string, unknown>,
    context: PipelineHandlerContext
  ): Promise<SqlResult[]>;
}
