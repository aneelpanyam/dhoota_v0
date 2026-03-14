import { executeSqlTemplates } from "../executor";
import type { PipelineHandler, PipelineHandlerContext } from "./types";

export const sqlHandler: PipelineHandler = {
  async execute(optionId, params, context) {
    return executeSqlTemplates(
      optionId,
      params,
      {
        tenantId: context.tenantId,
        userId: context.userId,
        scopedUserId: context.scopedUserId,
      },
      context.userType
    );
  },
};
