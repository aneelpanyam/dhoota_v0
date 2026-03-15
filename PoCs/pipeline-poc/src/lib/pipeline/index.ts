import type { SendMessageRequest, ChatMessageResponse, Widget, WidgetType, FileReference } from "@/types/api";
import type { UserContext } from "@/types/pipeline";
import { generateId } from "@/lib/utils";
import { resolveOption } from "./resolver";
import { startQASession, continueQASession } from "./qa-engine";
import { refineInput } from "./refiner";
import { consumeSqlDebug } from "./executor";
import { getHandler } from "./handlers";
import type { OptionDefinition } from "@/types/options";
import { formatResponse } from "./formatter";
import { optionsToReferences } from "./context";
import { loadSqlTemplates } from "./loader";
import { getLLMProvider } from "@/lib/llm/factory";
import { consumeLlmDebug } from "@/lib/llm/openai";
import { createServiceSupabase } from "@/lib/supabase/server";
import { PipelineTrace } from "./trace";
import { logger } from "@/lib/logging/logger";
import { handleInsightsQuery, handleReportQuery } from "./insights";
import { setLlmLogContext, clearLlmLogContext } from "@/lib/llm/cost";
import { validateParams, normalizeParams } from "./validator";

export async function processMessage(
  request: SendMessageRequest,
  context: UserContext,
  traceId?: string
): Promise<ChatMessageResponse> {
  const defaultOpts = optionsToReferences(context.defaultOptions);
  const execStartMs = Date.now();
  const trace = new PipelineTrace({
    source: request.source,
    optionId: request.optionId,
    hasContent: !!request.content,
  }, traceId);

  logger.setTraceId(trace.getTraceId());

  setLlmLogContext({
    tenantId: context.tenantId,
    userId: context.userId,
    conversationId: context.conversationId,
    optionId: request.optionId,
  });

  try {
    // Insights path: user sent a question with pinned context items or a filter
    const hasContextItems = Array.isArray(request.params?.contextItems) && request.params.contextItems.length > 0;
    const hasFilterId = !!request.params?.filterId;
    const reportRequest = !!request.params?.reportRequest;
    if (request.source === "insights" && (hasContextItems || hasFilterId)) {
      if (reportRequest && hasFilterId) {
        const result = await handleReportQuery(request, context, defaultOpts, trace);
        result.debugTrace = trace.toJSON();
        return result;
      }
      if (request.content) {
        const result = await handleInsightsQuery(request, context, defaultOpts, trace);
        result.debugTrace = trace.toJSON();
        return result;
      }
    }

    if (request.source === "qa_response" && request.optionId && request.params) {
      const result = await handleQAResponse(request, context, defaultOpts, trace);
      result.debugTrace = trace.toJSON();
      return result;
    }

    if (request.source === "confirmation" && request.optionId && request.params) {
      const result = await handleConfirmation(request, context, defaultOpts, trace);
      result.debugTrace = trace.toJSON();
      return result;
    }

    if (request.targetResourceId && request.optionId) {
      const targetOption = context.availableOptions.find((o) => o.id === request.optionId);
      const etype = targetOption?.entity_type ?? request.optionId.split(".")[0];
      const key = `${etype}_id`;
      request = { ...request, params: { ...request.params, [key]: request.targetResourceId } };
    }

    const resolved = await trace.step(
      "resolve_option",
      () => resolveOption(request, context),
      { source: request.source, optionId: request.optionId, content: request.content?.slice(0, 100) }
    );

    if (!resolved.option) {
      const result = buildErrorResponse(
        "Please choose an option from the menu above, or use the insight feature to ask questions about displayed data.",
        context,
        defaultOpts
      );
      result.debugTrace = trace.toJSON();
      return result;
    }

    // Always attempt Q&A — catches optional questions even when all required params are already provided
    const qaResult = await trace.step(
      "qa_session_start",
      () => startQASession(resolved.option!, resolved.extractedParams ?? {}, context.tenantId),
      { optionId: resolved.option.id }
    );

    if (qaResult.status === "need_more" && qaResult.nextQuestions) {
      const baseParams = {
        ...(resolved.extractedParams ?? {}),
        tenant_id: (resolved.extractedParams?.tenant_id as string) ?? context.tenantId,
        user_id: (resolved.extractedParams?.user_id as string) ?? context.userId,
      };
      const sessionParams = await enrichSessionParamsWithPublicSiteConfig(
        resolved.option!.id,
        baseParams,
        context
      );
      const { params: avatarParams, currentAvatarUrl } = await enrichSessionParamsWithAvatar(
        resolved.option!.id,
        sessionParams,
        context
      );
      const { params: welcomeParams, currentBannerUrl } = await enrichSessionParamsWithWelcomeMessage(
        resolved.option!.id,
        avatarParams,
        context
      );
      const entityCtx = await fetchEntityContext(welcomeParams, context.tenantId);
      const enrichedQuestions = await enrichTagQuestionsWithPrefetch(
        qaResult.nextQuestions,
        resolved.option!.id,
        welcomeParams,
        context.tenantId
      );

      const widgets: Widget[] = [];
      widgets.push({
        id: generateId(),
        type: "question_stepper" as WidgetType,
        data: {
          optionId: resolved.option!.id,
          questions: enrichedQuestions,
          sessionParams: welcomeParams,
          entityContext: entityCtx,
          currentAvatarUrl: currentAvatarUrl ?? undefined,
          currentBannerUrl: currentBannerUrl ?? undefined,
        },
        bookmarkable: false,
      });

      return {
        messageId: generateId(),
        conversationId: context.conversationId,
        widgets,
        followUps: [],
        defaultOptions: defaultOpts,
        conversationState: "awaiting_input",
        debugTrace: trace.toJSON(),
      };
    }

    resolved.extractedParams = qaResult.collectedParams ?? resolved.extractedParams;

    const hasWrites = resolved.option.has_writes ?? (await loadSqlTemplates(resolved.option.id)).some((t) => t.query_type === "write");

    if (hasWrites && request.source !== "confirmation") {
      const shouldConfirm = resolved.option.requires_confirmation;
      const shouldRefine = !resolved.option.skip_refinement;

      const prefetchedParams = await prefetchEntityForEdit(
        resolved.option.id,
        resolved.extractedParams ?? {},
      );

      const didPrefetch = resolved.option.id in EDIT_ENTITY_MAP;

      let confirmFields: { label: string; value: string; inferred?: boolean }[];
      let confirmParams: Record<string, unknown>;
      let suggestedTags: { name: string; confidence: number }[] = [];

      if (!shouldRefine || didPrefetch) {
        confirmParams = prefetchedParams;
        confirmFields = buildSimpleDisplayFields(confirmParams, resolved.option.id);
      } else {
        const refined = await trace.step(
          "refine_input",
          () => refineInput(resolved.option!, prefetchedParams, context.tenantId),
          { params: prefetchedParams }
        );
        trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });
        confirmParams = refined.params;
        suggestedTags = (refined.suggestions.tags ?? []) as { name: string; confidence: number }[];
        confirmFields = Object.entries(refined.displaySummary).map(([label, value]) => ({
          label,
          value: String(value),
          inferred: refined.refinementNotes.some((n) => n.toLowerCase().includes(label.toLowerCase())),
        }));
      }

      if (resolved.option.id === "admin.user.provision" && confirmParams.tenant_id) {
        const tenantName = await fetchTenantName(confirmParams.tenant_id as string);
        if (tenantName) confirmParams = { ...confirmParams, tenant_name: tenantName };
      }

      confirmFields = ensureConfirmFields(confirmFields, confirmParams, resolved.option.id);

      if (shouldConfirm) {
        const entityCtxMain = await fetchEntityContext(confirmParams, context.tenantId);

        const confirmWidget: Widget = {
          id: generateId(),
          type: "confirmation_card" as WidgetType,
          data: {
            title: `Confirm: ${resolved.option.name}`,
            fields: confirmFields,
            suggestedTags,
            optionId: resolved.option.id,
            params: confirmParams,
            entityContext: entityCtxMain,
          },
          bookmarkable: false,
        };

        return {
          messageId: generateId(),
          conversationId: context.conversationId,
          widgets: [
            {
              id: generateId(),
              type: "text_response" as WidgetType,
              data: { text: "Here's what I've prepared. Does this look right?" },
              bookmarkable: false,
            },
            confirmWidget,
          ],
          followUps: [],
          defaultOptions: defaultOpts,
          conversationState: "awaiting_confirmation",
          debugTrace: trace.toJSON(),
        };
      }

      // No confirmation needed -- execute directly
      resolved.extractedParams = confirmParams;
    }

    const validation = validateParams(
      resolved.extractedParams ?? {},
      resolved.option!.input_schema
    );
    if (!validation.valid) {
      const result = buildErrorResponse(
        validation.errors?.join(" ") ?? "Invalid parameters.",
        context,
        defaultOpts
      );
      result.debugTrace = trace.toJSON();
      return result;
    }

    const sqlResults = await trace.step(
      "execute_sql",
      () => executeWithHandler(resolved.option!, resolved.extractedParams ?? {}, context),
      { optionId: resolved.option.id, params: resolved.extractedParams }
    );
    trace.enrichLastStep({ sql: consumeSqlDebug() ?? undefined });
    logOptionExecution(resolved.option.id, context, resolved.extractedParams ?? {}, sqlResults, execStartMs, true);

    const formatted = await trace.step(
      "format_response",
      () => formatResponse(resolved.option!, sqlResults, context, resolved.extractedParams),
      { rowCounts: sqlResults.map((r) => ({ name: r.templateName, count: r.rowCount })) }
    );

    const processedWidgets = filterEmptyWidgets(
      applyPinnableFlags(attachItemActions(formatted.widgets, resolved.option, context), resolved.option)
    );

    const widgets: Widget[] = processedWidgets.map((w) => ({
      id: generateId(),
      type: w.type as WidgetType,
      data: w.data,
      actions: w.actions,
      bookmarkable: true,
    }));

    const resourceId = extractResourceIdFromParams(resolved.extractedParams ?? {}, resolved.option)
      ?? extractResourceId(sqlResults);
    const resultParams = extractResultParams(resolved.option, sqlResults);
    const followUps = buildFollowUps(resolved.option, context, resourceId, resultParams);

    const pipelineResponse: ChatMessageResponse = {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [
        {
          id: generateId(),
          type: "text_response" as WidgetType,
          data: { text: formatted.summary },
          bookmarkable: false,
        },
        ...widgets,
      ],
      followUps,
      defaultOptions: defaultOpts,
      conversationState: "active",
      debugTrace: trace.toJSON(),
    };

    trace.emitLogs(logger.info.bind(logger));
    clearLlmLogContext();
    return pipelineResponse;
  } catch (error) {
    logger.error("pipeline", "Pipeline error", { error: (error as Error).message });
    trace.emitLogs(logger.info.bind(logger));
    clearLlmLogContext();
    const result = buildErrorResponse(
      "Something went wrong processing your request. Please try again.",
      context,
      defaultOpts,
      {
        source: request.source,
        optionId: request.optionId,
        content: request.content,
        params: request.params,
      }
    );
    result.debugTrace = trace.toJSON();
    return result;
  }
}

async function handleQAResponse(
  request: SendMessageRequest,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const qaStartMs = Date.now();
  const option = context.availableOptions.find((o) => o.id === request.optionId);
  if (!option) {
    return buildErrorResponse("Option not found.", context, defaultOpts);
  }

  let newAnswers = request.params ?? {};

  const hasStructuredAnswers = Object.keys(newAnswers).length > 0;
  if (request.content && !hasStructuredAnswers) {
    newAnswers = await trace.step(
      "extract_params_from_text",
      async () => {
        const llm = getLLMProvider();
        const extracted = await llm.extractParams(request.content!, option.input_schema ?? {});
        return { ...newAnswers, ...extracted };
      },
      { content: request.content?.slice(0, 100) }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });
  }

  const previousParams = (request.params as Record<string, unknown>) ?? {};
  const qaResult = await trace.step(
    "qa_session_continue",
    () => continueQASession(option, previousParams, newAnswers, context.tenantId),
    { optionId: option.id }
  );

  if (qaResult.status === "need_more" && qaResult.nextQuestions) {
    const collectedSoFar = qaResult.collectedParams ?? previousParams;
    const baseParams = {
      ...collectedSoFar,
      tenant_id: (collectedSoFar.tenant_id as string) ?? context.tenantId,
      user_id: (collectedSoFar.user_id as string) ?? context.userId,
    };
    const sessionParams = await enrichSessionParamsWithPublicSiteConfig(
      option.id,
      baseParams,
      context
    );
    const { params: avatarParams, currentAvatarUrl } = await enrichSessionParamsWithAvatar(
      option.id,
      sessionParams,
      context
    );
    const { params: welcomeParams, currentBannerUrl } = await enrichSessionParamsWithWelcomeMessage(
      option.id,
      avatarParams,
      context
    );
    const entityCtx = await fetchEntityContext(welcomeParams, context.tenantId);
    const enrichedQuestions = await enrichTagQuestionsWithPrefetch(
      qaResult.nextQuestions,
      option.id,
      welcomeParams,
      context.tenantId
    );

    const widgets: Widget[] = [{
      id: generateId(),
      type: "question_stepper" as WidgetType,
      data: {
        optionId: option.id,
        questions: enrichedQuestions,
        sessionParams: welcomeParams,
        entityContext: entityCtx,
        currentAvatarUrl: currentAvatarUrl ?? undefined,
        currentBannerUrl: currentBannerUrl ?? undefined,
      },
      bookmarkable: false,
    }];

    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets,
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "awaiting_input",
    };
  }

  const hasWrites = option.has_writes ?? (await loadSqlTemplates(option.id)).some((t) => t.query_type === "write");
  const collectedParams = normalizeParams(qaResult.collectedParams ?? {}, option.input_schema);

  const validation = validateParams(collectedParams, option.input_schema);
  if (!validation.valid) {
    return buildErrorResponse(
      validation.errors?.join(" ") ?? "Invalid parameters.",
      context,
      defaultOpts
    );
  }

  if (!hasWrites) {
    const sqlResults = await trace.step(
      "execute_sql",
      () => executeWithHandler(option, collectedParams, context),
      { optionId: option.id, params: collectedParams }
    );
    trace.enrichLastStep({ sql: consumeSqlDebug() ?? undefined });
    logOptionExecution(option.id, context, collectedParams, sqlResults, qaStartMs, true);

    const formatted = await trace.step(
      "format_response",
      () => formatResponse(option, sqlResults, context, collectedParams),
      { rowCounts: sqlResults.map((r) => ({ name: r.templateName, count: r.rowCount })) }
    );

    const processedWidgets = filterEmptyWidgets(
      applyPinnableFlags(attachItemActions(formatted.widgets, option, context), option)
    );

    const widgets: Widget[] = processedWidgets.map((w) => ({
      id: generateId(),
      type: w.type as WidgetType,
      data: w.data,
      actions: w.actions,
      bookmarkable: true,
    }));

    const resourceId = extractResourceId(sqlResults);
    const resultParams = extractResultParams(option, sqlResults);
    const followUps = buildFollowUps(option, context, resourceId, resultParams);

    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [
        {
          id: generateId(),
          type: "text_response" as WidgetType,
          data: { text: formatted.summary },
          bookmarkable: false,
        },
        ...widgets,
      ],
      followUps,
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  }

  // Write options
  const shouldRefine = !option.skip_refinement;
  const shouldConfirm = option.requires_confirmation;

  const prefetchedCollected = await prefetchEntityForEdit(option.id, collectedParams);
  const didPrefetchQA = option.id in EDIT_ENTITY_MAP;

  let confirmFields: { label: string; value: string; inferred?: boolean }[];
  let confirmParams: Record<string, unknown>;
  let suggestedTags: { name: string; confidence: number }[] = [];

  if (!shouldRefine || didPrefetchQA) {
    confirmParams = prefetchedCollected;
    confirmFields = buildSimpleDisplayFields(confirmParams, option.id);
  } else {
    const refined = await trace.step(
      "refine_input",
      () => refineInput(option, prefetchedCollected, context.tenantId),
      { params: prefetchedCollected }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });
    confirmParams = refined.params;
    suggestedTags = (refined.suggestions.tags ?? []) as { name: string; confidence: number }[];
    confirmFields = Object.entries(refined.displaySummary).map(([label, value]) => ({
      label,
      value: String(value),
      inferred: false,
    }));
  }

  if (option.id === "admin.user.provision" && confirmParams.tenant_id) {
    const tenantName = await fetchTenantName(confirmParams.tenant_id as string);
    if (tenantName) confirmParams = { ...confirmParams, tenant_name: tenantName };
  }

  confirmFields = ensureConfirmFields(confirmFields, confirmParams, option.id);

  if (shouldConfirm) {
    const entityCtxForConfirm = await fetchEntityContext(confirmParams, context.tenantId);

    const confirmWidget: Widget = {
      id: generateId(),
      type: "confirmation_card" as WidgetType,
      data: {
        title: `Confirm: ${option.name}`,
        fields: confirmFields,
        suggestedTags,
        optionId: option.id,
        params: confirmParams,
        entityContext: entityCtxForConfirm,
      },
      bookmarkable: false,
    };

    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [
        {
          id: generateId(),
          type: "text_response" as WidgetType,
          data: { text: "Here's what I've prepared. Does this look right?" },
          bookmarkable: false,
        },
        confirmWidget,
      ],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "awaiting_confirmation",
    };
  }

  // No confirmation -- execute directly
  return handleConfirmation(
    { ...request, params: confirmParams },
    context,
    defaultOpts,
    trace
  );
}

async function handleConfirmation(
  request: SendMessageRequest,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const confirmStartMs = Date.now();
  const option = context.availableOptions.find((o) => o.id === request.optionId);
  if (!option) {
    return buildErrorResponse("Option not found.", context, defaultOpts);
  }

  const rawParams = request.params ?? {};
  const params = normalizeParams(rawParams, option.input_schema);

  const validation = validateParams(params, option.input_schema);
  if (!validation.valid) {
    return buildErrorResponse(
      validation.errors?.join(" ") ?? "Invalid parameters.",
      context,
      defaultOpts
    );
  }

  const sqlResults = await trace.step(
    "execute_sql",
    () => executeWithHandler(option, params, context),
    { optionId: option.id, paramKeys: Object.keys(params) }
  );
  trace.enrichLastStep({ sql: consumeSqlDebug() ?? undefined });
  logOptionExecution(option.id, context, params, sqlResults, confirmStartMs, true);

  const resourceId = extractResourceIdFromParams(params, option)
    ?? extractResourceId(sqlResults);

  if (params.tags && Array.isArray(params.tags) && resourceId) {
    await trace.step(
      "save_tags",
      () => saveActivityTags(resourceId!, params.tags as string[], context.tenantId),
      { tagCount: (params.tags as string[]).length, activityId: resourceId }
    );
  }

  let savedMediaFiles: FileReference[] = [];
  if (option.id === "activity.create_bulk") {
    const activities = (params.activities ?? []) as Array<Record<string, unknown>>;
    const createdRows = sqlResults[0]?.rows ?? [];
    for (let i = 0; i < createdRows.length; i++) {
      const row = createdRows[i] as Record<string, unknown>;
      const activityId = row?.id as string | undefined;
      const mediaKeys = activities[i]?.media_keys;
      if (activityId && Array.isArray(mediaKeys) && mediaKeys.length > 0) {
        const files = mediaKeys.filter(
          (f): f is FileReference => {
            if (f == null || typeof f !== "object") return false;
            const obj = f as Record<string, unknown>;
            return "s3Key" in obj || "s3_key" in obj;
          }
        ).map((f) => {
          const obj = f as unknown as Record<string, unknown>;
          return {
            s3Key: (obj.s3Key ?? obj.s3_key) as string,
            originalFilename: (obj.originalFilename ?? obj.original_filename) as string,
            mimeType: (obj.mimeType ?? obj.mime_type) as string,
            fileSizeBytes: (obj.fileSizeBytes ?? obj.file_size_bytes ?? 0) as number,
          };
        });
        if (files.length > 0) {
          await trace.step(
            "save_media",
            () => saveActivityMedia(activityId, files, context.tenantId, context.userId),
            { fileCount: files.length, activityId }
          );
        }
      }
    }
  } else if (params.media_keys && Array.isArray(params.media_keys) && resourceId) {
    const files = params.media_keys.filter(
      (f): f is FileReference => {
        if (f == null || typeof f !== "object") return false;
        const obj = f as Record<string, unknown>;
        return "s3Key" in obj || "s3_key" in obj;
      }
    ).map((f) => {
      const obj = f as unknown as Record<string, unknown>;
      return {
        s3Key: (obj.s3Key ?? obj.s3_key) as string,
        originalFilename: (obj.originalFilename ?? obj.original_filename) as string,
        mimeType: (obj.mimeType ?? obj.mime_type) as string,
        fileSizeBytes: (obj.fileSizeBytes ?? obj.file_size_bytes ?? 0) as number,
      };
    });
    if (files.length > 0) {
      savedMediaFiles = files;
      await trace.step(
        "save_media",
        () => saveActivityMedia(resourceId!, files, context.tenantId, context.userId),
        { fileCount: files.length, activityId: resourceId }
      );
    }
  }

  if (resourceId && option.entity_type && option.id !== "activity.create_bulk") {
    const summaryOptions = new Set(["activity.create", "activity.edit", "announcement.create", "announcement.edit", "info_card.create", "info_card.edit", "program.create", "program.edit"]);
    if (summaryOptions.has(option.id)) {
      await trace.step(
        "generate_ai_summary",
        () => generateAndStoreAiSummary(resourceId!, params, context.tenantId, option.entity_type!),
        { resourceId, entityType: option.entity_type }
      );
      trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });
    }
  }

  const formatted = await trace.step(
    "format_response",
    () => formatResponse(option, sqlResults, context, params),
    { rowCounts: sqlResults.map((r) => ({ name: r.templateName, count: r.rowCount })) }
  );

  if (savedMediaFiles.length > 0) {
    for (const w of formatted.widgets) {
      if (w.type === "activity_card" && !w.data.media) {
        w.data.media = savedMediaFiles.map((f) => ({
          s3_key: f.s3Key,
          mime_type: f.mimeType,
          original_filename: f.originalFilename,
        }));
      }
    }
  }

  if (params.tags && Array.isArray(params.tags)) {
    for (const w of formatted.widgets) {
      if (w.type === "activity_card" && !w.data.tags) {
        w.data.tags = (params.tags as string[]).map((name) => ({ name }));
      }
    }
  }

  const processedWidgets = filterEmptyWidgets(
    attachItemActions(formatted.widgets, option, context)
  );

  const widgets: Widget[] = processedWidgets.map((w) => ({
    id: generateId(),
    type: w.type as WidgetType,
    data: w.data,
    actions: w.actions,
    bookmarkable: true,
  }));
  const resultParams = extractResultParams(option, sqlResults);
  const followUps = buildFollowUps(option, context, resourceId, resultParams);

  return {
    messageId: generateId(),
    conversationId: context.conversationId,
    widgets: [
      {
        id: generateId(),
        type: "text_response",
        data: { text: formatted.summary },
        bookmarkable: false,
      },
      ...widgets,
    ],
    followUps,
    defaultOptions: defaultOpts,
    conversationState: "active",
  };
}

function extractResourceId(sqlResults: import("@/types/pipeline").SqlResult[]): string | undefined {
  for (const result of sqlResults) {
    if (result.rows.length === 1 && result.rows[0]?.id) {
      return String(result.rows[0].id);
    }
  }
  return undefined;
}

function deriveEntityType(option: import("@/types/options").OptionDefinition): string {
  if (option.entity_type) return option.entity_type;
  const parts = option.id.split(".");
  if (["admin", "public", "citizen"].includes(parts[0]) && parts.length >= 2) {
    return parts[1];
  }
  return parts[0];
}

function extractResourceIdFromParams(
  params: Record<string, unknown>,
  option: import("@/types/options").OptionDefinition
): string | undefined {
  const entityType = deriveEntityType(option);
  const paramKey = `${entityType}_id`;
  if (params[paramKey]) return String(params[paramKey]);
  return undefined;
}

/** Extract params from SQL results for follow-up options (e.g. tenant_id from user view). */
function extractResultParams(
  option: import("@/types/options").OptionDefinition,
  sqlResults: import("@/types/pipeline").SqlResult[]
): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const result of sqlResults) {
    if (result.rows.length === 1) {
      const row = result.rows[0] as Record<string, unknown>;
      if (row.tenant_id != null) out.tenant_id = String(row.tenant_id);
      if (row.user_id != null) out.user_id = String(row.user_id);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function ensureInfoCardContentParams(params: Record<string, unknown>, optionId: string): Record<string, unknown> {
  if (optionId !== "info_card.create" && optionId !== "info_card.edit") return params;
  const raw = params.content_raw;
  if (raw == null || typeof raw !== "string") return params;
  const out = { ...params };
  out.content = { content_raw: raw };
  return out;
}

function ensureAvatarUrlFromKeys(params: Record<string, unknown>, optionId: string): Record<string, unknown> {
  if (optionId !== "profile.edit" && optionId !== "admin.user.edit" && optionId !== "profile.set_avatar") return params;
  const keys = params.avatar_keys;
  if (!Array.isArray(keys) || keys.length === 0) return params;
  const first = keys[0] as { s3Key?: string } | undefined;
  const s3Key = first?.s3Key;
  if (typeof s3Key !== "string") return params;
  const out = { ...params };
  out.avatar_url = s3Key;
  return out;
}

function ensureBannerUrlFromKeys(params: Record<string, unknown>, optionId: string): Record<string, unknown> {
  if (optionId !== "public_site.welcome_message.add" && optionId !== "public_site.welcome_message.edit") return params;
  const keys = params.banner_keys;
  if (!Array.isArray(keys) || keys.length === 0) return params;
  const first = keys[0] as { s3Key?: string } | undefined;
  const s3Key = first?.s3Key;
  if (typeof s3Key !== "string") return params;
  const out = { ...params };
  out.banner_url = s3Key;
  return out;
}

function ensureThemeOverridesFromPresets(
  params: Record<string, unknown>,
  optionId: string
): Record<string, unknown> {
  if (!["public_site.configure", "admin.public_site.configure"].includes(optionId)) {
    return params;
  }
  let p = { ...params };
  const themeSettings = p.theme_settings as Record<string, unknown> | undefined;
  if (themeSettings && typeof themeSettings === "object") {
    p = { ...p, ...themeSettings };
    delete p.theme_settings;
  }
  const existing = (p.theme_overrides as Record<string, unknown>) ?? {};
  const themeOverrides: Record<string, unknown> = { ...existing };
  if (p.theme_header_preset != null) themeOverrides.headerPreset = p.theme_header_preset;
  if (p.theme_bottom_nav_preset != null) themeOverrides.bottomNavPreset = p.theme_bottom_nav_preset;
  if (p.theme_about_me_preset != null) themeOverrides.aboutMePreset = p.theme_about_me_preset;
  if (p.theme_info_card_preset != null) themeOverrides.infoCardPreset = p.theme_info_card_preset;
  if (p.theme_welcome_message_preset != null) themeOverrides.welcomeMessagePreset = p.theme_welcome_message_preset;
  if (p.theme_header_fg_preset != null) themeOverrides.headerFgPreset = p.theme_header_fg_preset;
  if (p.theme_bottom_nav_fg_preset != null) themeOverrides.bottomNavFgPreset = p.theme_bottom_nav_fg_preset;
  if (p.theme_about_me_fg_preset != null) themeOverrides.aboutMeFgPreset = p.theme_about_me_fg_preset;
  if (p.theme_info_card_fg_preset != null) themeOverrides.infoCardFgPreset = p.theme_info_card_fg_preset;
  if (p.theme_welcome_message_fg_preset != null) themeOverrides.welcomeMessageFgPreset = p.theme_welcome_message_fg_preset;
  if (p.theme_chat_message_fg_preset != null) themeOverrides.chatMessageFgPreset = p.theme_chat_message_fg_preset;
  return { ...p, theme_overrides: themeOverrides };
}

async function executeWithHandler(
  option: OptionDefinition,
  params: Record<string, unknown>,
  context: UserContext
): Promise<import("@/types/pipeline").SqlResult[]> {
  let effectiveParams = ensureThemeOverridesFromPresets(params, option.id);
  effectiveParams = ensureAvatarUrlFromKeys(effectiveParams, option.id);
  effectiveParams = ensureBannerUrlFromKeys(effectiveParams, option.id);
  effectiveParams = ensureInfoCardContentParams(effectiveParams, option.id);
  const handlerId = option.handler_id ?? "sql";
  const handler = getHandler(handlerId);
  if (!handler) {
    throw new Error(`Unknown pipeline handler: ${handlerId}`);
  }
  return handler.execute(option.id, effectiveParams, {
    tenantId: context.tenantId,
    userId: context.userId,
    scopedUserId: context.scopedUserId,
    userType: context.userType,
  });
}

function isChildOption(optionId: string): boolean {
  return /\.(view|edit|delete|add_|remove_|respond|assign|revoke|regenerate|provision|create|manage|configure|process|list)/.test(optionId);
}

function buildFollowUps(
  option: import("@/types/options").OptionDefinition,
  context: UserContext,
  resourceId?: string,
  resultParams?: Record<string, string>
): import("@/types/api").OptionReference[] {
  const entityType = deriveEntityType(option);
  const currentParamKey = `${entityType}_id`;

  return option.follow_up_option_ids
    .map((id) => context.availableOptions.find((o) => o.id === id))
    .filter(Boolean)
    .map((opt) => {
      const ref: import("@/types/api").OptionReference = {
        optionId: opt!.id,
        name: opt!.name,
        icon: opt!.icon ?? "Zap",
        loadingMessage: opt!.loading_message ?? undefined,
      };
      const targetEntityType = deriveEntityType(opt!);
      const targetParamKey = `${targetEntityType}_id`;
      const value =
        resultParams?.[targetParamKey] ??
        (targetParamKey === currentParamKey ? resourceId : undefined);
      if (value) {
        ref.params = { [targetParamKey]: value };
      }
      return ref;
    });
}

async function saveActivityTags(
  activityId: string,
  tagNames: string[],
  tenantId: string
): Promise<void> {
  if (tagNames.length === 0) return;

  const db = createServiceSupabase();

  const { data: tags } = await db
    .from("tags")
    .select("id, name")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .in("name", tagNames);

  if (!tags || tags.length === 0) return;

  await db.from("activity_tags").delete().eq("activity_id", activityId);

  const rows = tags.map((tag: { id: string }) => ({
    activity_id: activityId,
    tag_id: tag.id,
  }));

  await db.from("activity_tags").insert(rows);
}

const HIDDEN_DISPLAY_KEYS = new Set([
  "tenant_id", "user_id", "media_keys", "media_file_names", "avatar_keys", "banner_keys",
  "offset", "pageSize", "page",
]);

const CONFIRM_FIELD_ORDER: Record<string, string[]> = {
  "admin.user.provision": ["tenant_name", "email", "display_name", "user_type"],
  "announcement.create": ["title", "content", "visibility", "pinned"],
  "announcement.edit": ["title", "content", "visibility", "pinned"],
  "info_card.create": ["title", "content", "card_type", "visibility"],
  "info_card.edit": ["title", "content", "card_type", "visibility"],
  "public_site.welcome_message.edit": ["message_text"],
};

function buildSimpleDisplayFields(
  params: Record<string, unknown>,
  optionId: string
): { label: string; value: string }[] {
  const order = CONFIRM_FIELD_ORDER[optionId];
  const entries = order
    ? [...order.map((k) => [k, params[k]] as const).filter(([, v]) => v != null), ...Object.entries(params).filter(([k]) => !order.includes(k))]
    : Object.entries(params);
  const fields: { label: string; value: string }[] = [];
  for (const [key, val] of entries) {
    if (HIDDEN_DISPLAY_KEYS.has(key) || val == null) continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      const display = val.map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v))).join(", ");
      const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
      fields.push({ label, value: display });
      continue;
    }
    if (typeof val === "object") continue;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const strVal = String(val);
    if (key.endsWith("_id") && /^[0-9a-f]{8}-/i.test(strVal)) {
      fields.push({ label: label.replace(/ Id$/, ""), value: strVal.slice(0, 8) + "..." });
    } else if (typeof val === "boolean") {
      fields.push({ label, value: val ? "Yes" : "No" });
    } else {
      fields.push({ label, value: strVal || "(not set)" });
    }
  }
  return fields;
}

function ensureConfirmFields(
  fields: { label: string; value: string; inferred?: boolean }[],
  params: Record<string, unknown>,
  optionId: string
): { label: string; value: string; inferred?: boolean }[] {
  if (fields.length > 0) return fields;
  return buildSimpleDisplayFields(params, optionId).map((f) => ({ ...f, inferred: false }));
}

function applyPinnableFlags(
  widgets: { type: string; data: Record<string, unknown>; actions?: import("@/types/api").WidgetAction[] }[],
  option: import("@/types/options").OptionDefinition | null
): typeof widgets {
  if (!option) return widgets;
  const pinnableItems = option.pinnable_items === true;
  const pinnableCollection = option.pinnable_collection === true;

  return widgets.map((w) => {
    if (w.type === "data_list") {
      const data = { ...w.data };
      if (!pinnableItems) data._noPinItems = true;
      if (!pinnableCollection) data._noPinCollection = true;
      return { ...w, data };
    }
    if (w.type === "activity_card" && !pinnableItems) {
      return { ...w, data: { ...w.data, _noPin: true } };
    }
    return w;
  });
}

function attachItemActions(
  widgets: { type: string; data: Record<string, unknown>; actions?: import("@/types/api").WidgetAction[] }[],
  option: import("@/types/options").OptionDefinition | null,
  context: UserContext
): typeof widgets {
  if (!option) return widgets;

  const entityType = option.entity_type ?? option.id.split(".")[0];
  const paramKey = `${entityType}_id`;

  const childIds = option.child_item_option_ids;
  const idsToUse =
    Array.isArray(childIds) && childIds.length > 0
      ? childIds
      : option.follow_up_option_ids.filter(
          (id) => isChildOption(id) && !/\.(view|details|edit)$/.test(id)
        );

  const itemActions: import("@/types/api").WidgetAction[] = idsToUse
    .map((id) => context.availableOptions.find((o) => o.id === id))
    .filter(Boolean)
    .map((opt) => ({
      label: opt!.name,
      icon: opt!.icon ?? "Zap",
      optionId: opt!.id,
      paramKey,
    }));

  if (itemActions.length === 0) return widgets;

  const attachCardActions = (w: { type: string; data: Record<string, unknown>; actions?: import("@/types/api").WidgetAction[] }) => {
    const resourceId = w.data.id as string | undefined;
    const cardActions = resourceId
      ? itemActions.map((a) => ({
          ...a,
          targetResourceId: resourceId,
          params: { [paramKey]: resourceId },
        }))
      : itemActions;
    return { ...w, actions: cardActions };
  };

  return widgets.map((w) => {
    if (w.type === "data_list" && !w.data._noItemActions) return { ...w, actions: itemActions };
    if (w.type === "activity_card" || w.type === "info_card" || w.type === "announcement_card") {
      return attachCardActions(w);
    }
    return w;
  });
}

function filterEmptyWidgets(
  widgets: { type: string; data: Record<string, unknown>; actions?: import("@/types/api").WidgetAction[] }[]
): typeof widgets {
  return widgets.filter((w) => {
    if (w.type === "chart") {
      const d = w.data?.data;
      if (!d || (Array.isArray(d) && d.length === 0)) return false;
    }
    if (w.type === "data_list") {
      const items = w.data?.items;
      if (!items || (Array.isArray(items) && items.length === 0)) return false;
    }
    return true;
  });
}

async function saveActivityMedia(
  activityId: string,
  files: FileReference[],
  tenantId: string,
  userId: string
): Promise<void> {
  if (files.length === 0) return;

  const db = createServiceSupabase();
  const rows = files.map((f) => ({
    tenant_id: tenantId,
    activity_id: activityId,
    uploaded_by: userId,
    media_type: f.mimeType.startsWith("image/")
      ? "image"
      : f.mimeType.startsWith("video/")
      ? "video"
      : "document",
    original_filename: f.originalFilename,
    s3_key: f.s3Key,
    file_size_bytes: f.fileSizeBytes,
    mime_type: f.mimeType,
    processing_status: "ready",
  }));

  await db.from("activity_media").insert(rows);
}

interface EntityContext {
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
}

async function fetchActivityTagNames(
  activityId: string,
  _tenantId: string
): Promise<string[]> {
  try {
    const db = createServiceSupabase();
    const { data: atData } = await db
      .from("activity_tags")
      .select("tag_id")
      .eq("activity_id", activityId);
    const tagIds = (atData ?? []).map((r: { tag_id: string }) => r.tag_id);
    if (tagIds.length === 0) return [];
    const { data: tagData } = await db.from("tags").select("name").in("id", tagIds);
    return (tagData ?? []).map((r: { name: string }) => r.name);
  } catch {
    return [];
  }
}

interface QuestionData {
  questionText: string;
  questionKey: string;
  inlineWidget?: string | null;
  widgetConfig?: Record<string, unknown>;
  isRequired?: boolean;
  paramSchema?: Record<string, unknown>;
}

async function enrichTagQuestionsWithPrefetch(
  questions: QuestionData[],
  optionId: string,
  params: Record<string, unknown>,
  tenantId: string
): Promise<QuestionData[]> {
  const activityId = params.activity_id as string | undefined;
  if (!activityId || !["activity.manage_tags", "activity.edit"].includes(optionId)) {
    return questions;
  }
  const tagNames = await fetchActivityTagNames(activityId, tenantId);
  if (tagNames.length === 0) return questions;

  return questions.map((q) => {
    if (q.questionKey !== "tags" || q.inlineWidget !== "tag_select") return q;
    return {
      ...q,
      widgetConfig: { ...(q.widgetConfig ?? {}), defaultTags: tagNames },
    };
  });
}

async function enrichSessionParamsWithAvatar(
  optionId: string,
  params: Record<string, unknown>,
  context: { tenantId: string; userId: string }
): Promise<{ params: Record<string, unknown>; currentAvatarUrl?: string | null }> {
  if (optionId !== "profile.set_avatar") {
    return { params };
  }
  const userId = (params.user_id as string) ?? context.userId;
  if (!userId) return { params };
  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("users")
      .select("avatar_url")
      .eq("id", userId)
      .single();
    const avatarUrl = data?.avatar_url as string | null | undefined;
    const currentAvatarUrl =
      avatarUrl && avatarUrl.trim()
        ? avatarUrl.startsWith("http")
          ? avatarUrl
          : `/api/media/serve?key=${encodeURIComponent(avatarUrl)}`
        : null;
    return { params, currentAvatarUrl };
  } catch {
    return { params };
  }
}

async function enrichSessionParamsWithWelcomeMessage(
  optionId: string,
  params: Record<string, unknown>,
  context: { tenantId: string; userId: string }
): Promise<{ params: Record<string, unknown>; currentBannerUrl?: string | null }> {
  if (optionId !== "public_site.welcome_message.edit") return { params };
  const welcomeMessageId = params.welcome_message_id as string | undefined;
  if (!welcomeMessageId) return { params };

  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("public_site_welcome_messages")
      .select("message_text, banner_url")
      .eq("id", welcomeMessageId)
      .eq("tenant_id", context.tenantId)
      .eq("user_id", context.userId)
      .single();
    if (!data) return { params };

    const merged = { ...params };
    if (merged.message_text == null && data.message_text != null) {
      merged.message_text = data.message_text;
    }
    let currentBannerUrl: string | null = null;
    const bannerUrl = data.banner_url as string | null | undefined;
    if (bannerUrl && bannerUrl.trim()) {
      currentBannerUrl = bannerUrl.startsWith("http")
        ? bannerUrl
        : `/api/media/serve?key=${encodeURIComponent(bannerUrl)}`;
    }
    return { params: merged, currentBannerUrl };
  } catch {
    return { params };
  }
}

async function enrichSessionParamsWithPublicSiteConfig(
  optionId: string,
  params: Record<string, unknown>,
  context: { tenantId: string; userId: string }
): Promise<Record<string, unknown>> {
  if (!["public_site.configure", "admin.public_site.configure"].includes(optionId)) {
    return params;
  }
  const tenantId = (params.tenant_id as string) ?? context.tenantId;
  const userId = (params.user_id as string) ?? context.userId;
  if (!tenantId || !userId) return params;

  try {
    const db = createServiceSupabase();
    const { data } = await db
      .from("public_site_configs")
      .select("welcome_message, site_title, enabled_option_ids, theme_overrides")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .single();
    if (!data) return params;

    const merged = { ...params };
    if (merged.welcome_message == null && data.welcome_message != null) {
      merged.welcome_message = data.welcome_message;
    }
    if (merged.site_title == null && data.site_title != null) {
      merged.site_title = data.site_title;
    }
    if (merged.enabled_option_ids == null && data.enabled_option_ids != null) {
      merged.enabled_option_ids = data.enabled_option_ids;
    }
    const themeOverrides = data.theme_overrides as Record<string, unknown> | null;
    if (themeOverrides && typeof themeOverrides === "object") {
      if (merged.theme_header_preset == null && themeOverrides.headerPreset != null) {
        merged.theme_header_preset = themeOverrides.headerPreset;
      }
      if (merged.theme_bottom_nav_preset == null && themeOverrides.bottomNavPreset != null) {
        merged.theme_bottom_nav_preset = themeOverrides.bottomNavPreset;
      }
      if (merged.theme_about_me_preset == null && themeOverrides.aboutMePreset != null) {
        merged.theme_about_me_preset = themeOverrides.aboutMePreset;
      }
      if (merged.theme_info_card_preset == null && themeOverrides.infoCardPreset != null) {
        merged.theme_info_card_preset = themeOverrides.infoCardPreset;
      }
      if (merged.theme_welcome_message_preset == null && themeOverrides.welcomeMessagePreset != null) {
        merged.theme_welcome_message_preset = themeOverrides.welcomeMessagePreset;
      }
      if (merged.theme_header_fg_preset == null && themeOverrides.headerFgPreset != null) {
        merged.theme_header_fg_preset = themeOverrides.headerFgPreset;
      }
      if (merged.theme_bottom_nav_fg_preset == null && themeOverrides.bottomNavFgPreset != null) {
        merged.theme_bottom_nav_fg_preset = themeOverrides.bottomNavFgPreset;
      }
      if (merged.theme_about_me_fg_preset == null && themeOverrides.aboutMeFgPreset != null) {
        merged.theme_about_me_fg_preset = themeOverrides.aboutMeFgPreset;
      }
      if (merged.theme_info_card_fg_preset == null && themeOverrides.infoCardFgPreset != null) {
        merged.theme_info_card_fg_preset = themeOverrides.infoCardFgPreset;
      }
      if (merged.theme_welcome_message_fg_preset == null && themeOverrides.welcomeMessageFgPreset != null) {
        merged.theme_welcome_message_fg_preset = themeOverrides.welcomeMessageFgPreset;
      }
      if (merged.theme_chat_message_fg_preset == null && themeOverrides.chatMessageFgPreset != null) {
        merged.theme_chat_message_fg_preset = themeOverrides.chatMessageFgPreset;
      }
    }
    return merged;
  } catch {
    return params;
  }
}

async function fetchTenantName(tenantId: string): Promise<string | null> {
  try {
    const db = createServiceSupabase();
    const { data } = await db.from("tenants").select("name").eq("id", tenantId).single();
    return (data?.name as string) ?? null;
  } catch {
    return null;
  }
}

async function fetchEntityContext(
  params: Record<string, unknown>,
  tenantId: string
): Promise<EntityContext | null> {
  try {
    const db = createServiceSupabase();

    const activityId = params.activity_id as string | undefined;
    if (activityId) {
      const { data } = await db
        .from("activities")
        .select("id, title, status, activity_date, ai_summary")
        .eq("id", activityId)
        .eq("tenant_id", tenantId)
        .single();
      if (!data) return null;
      const summary = data.ai_summary as Record<string, unknown> | null;
      const title = (summary?.enhancedTitle as string) ?? data.title ?? "Activity";
      const dateStr = data.activity_date
        ? new Date(data.activity_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : undefined;
      return { entityType: "activity", entityId: activityId, title, subtitle: [data.status, dateStr].filter(Boolean).join(" · ") || undefined };
    }

    const userId = params.user_id as string | undefined;
    if (userId) {
      const { data } = await db.from("users").select("id, display_name, email, user_type").eq("id", userId).single();
      if (data) return { entityType: "user", entityId: userId, title: data.display_name ?? data.email ?? "User", subtitle: `${data.user_type} · ${data.email}` };
    }

    const resolvedTenantId = params.tenant_id as string | undefined;
    if (resolvedTenantId) {
      const { data } = await db.from("tenants").select("id, name, subscription").eq("id", resolvedTenantId).single();
      if (data) return { entityType: "tenant", entityId: resolvedTenantId, title: data.name ?? "Tenant", subtitle: data.subscription ?? undefined };
    }

    const announcementId = params.announcement_id as string | undefined;
    if (announcementId) {
      const { data } = await db.from("announcements").select("id, title").eq("id", announcementId).eq("tenant_id", tenantId).single();
      if (data) return { entityType: "announcement", entityId: announcementId, title: data.title ?? "Announcement" };
    }

    const infoCardId = params.info_card_id as string | undefined;
    if (infoCardId) {
      const { data } = await db.from("info_cards").select("id, title").eq("id", infoCardId).eq("tenant_id", tenantId).single();
      if (data) return { entityType: "info_card", entityId: infoCardId, title: data.title ?? "Info Card" };
    }

    const programId = params.program_id as string | undefined;
    if (programId) {
      const { data } = await db.from("programs").select("id, title").eq("id", programId).eq("tenant_id", tenantId).single();
      if (data) return { entityType: "program", entityId: programId, title: data.title ?? "Program" };
    }

    const welcomeMessageId = params.welcome_message_id as string | undefined;
    const welcomeUserId = params.user_id as string | undefined;
    if (welcomeMessageId && welcomeUserId) {
      const { data } = await db
        .from("public_site_welcome_messages")
        .select("id, message_text")
        .eq("id", welcomeMessageId)
        .eq("tenant_id", tenantId)
        .eq("user_id", welcomeUserId)
        .single();
      if (data) {
        const preview = (data.message_text as string)?.slice(0, 50) ?? "Welcome message";
        return { entityType: "welcome_message", entityId: welcomeMessageId, title: preview + (preview.length >= 50 ? "…" : "") };
      }
    }

    return null;
  } catch {
    return null;
  }
}

const EDIT_ENTITY_MAP: Record<string, { table: string; idParam: string; fields: string }> = {
  "admin.tenant.edit": { table: "tenants", idParam: "tenant_id", fields: "id, name, subscription, custom_domain, slug" },
  "admin.user.edit": { table: "users", idParam: "user_id", fields: "id, display_name, email, user_type, access_code" },
  "admin.subscription.manage": { table: "tenants", idParam: "tenant_id", fields: "id, name, subscription" },
  "admin.report.process": { table: "report_requests", idParam: "report_id", fields: "id, status, result_url, report_type" },
  "info_card.edit": { table: "info_cards", idParam: "info_card_id", fields: "id, title, content, card_type, visibility" },
  "announcement.edit": { table: "announcements", idParam: "announcement_id", fields: "id, title, content, visibility, pinned" },
  "public_site.welcome_message.edit": { table: "public_site_welcome_messages", idParam: "welcome_message_id", fields: "id, message_text, banner_url" },
};

async function prefetchEntityForEdit(
  optionId: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const config = EDIT_ENTITY_MAP[optionId];
  if (!config) return params;

  const entityId = params[config.idParam] as string | undefined;
  if (!entityId) return params;

  const nonIdParams = Object.entries(params).filter(([k]) => k !== config.idParam && !k.endsWith("_id"));
  if (nonIdParams.some(([, v]) => v != null)) return params;

  try {
    const db = createServiceSupabase();
    const { data } = await db.from(config.table).select(config.fields).eq("id", entityId).single();
    if (!data) return params;

    const merged = { ...params };
    for (const [key, val] of Object.entries(data as unknown as Record<string, unknown>)) {
      if (key === "id") continue;
      if (merged[key] == null) {
        merged[key] = val ?? "";
      }
    }
    // info_card: extract content_raw from content jsonb for form/display
    if (optionId === "info_card.edit" && merged.content != null) {
      const content = merged.content as Record<string, unknown>;
      merged.content_raw = typeof content?.content_raw === "string" ? content.content_raw : (content?.text as string) ?? "";
    }
    return merged;
  } catch {
    return params;
  }
}

async function generateAndStoreAiSummary(
  resourceId: string,
  params: Record<string, unknown>,
  tenantId: string,
  entityType: string
): Promise<void> {
  try {
    const llm = getLLMProvider();
    const summary = await llm.generateActivitySummary({
      title: params.title,
      description: params.description,
      location: params.location,
      activity_date: params.activity_date,
      status: params.status,
      visibility: params.visibility,
      tags: params.tags,
      content: params.content,
    });

    const db = createServiceSupabase();
    const tableMap: Record<string, string> = {
      activity: "activities",
      announcement: "announcements",
      info_card: "info_cards",
      program: "programs",
    };
    const table = tableMap[entityType];
    if (!table) return;

    await db
      .from(table)
      .update({
        ai_summary: {
          ...summary,
          generatedAt: new Date().toISOString(),
        },
      })
      .eq("id", resourceId)
      .eq("tenant_id", tenantId);
  } catch {
    // Non-critical
  }
}

function logOptionExecution(
  optionId: string,
  context: UserContext,
  params: Record<string, unknown>,
  sqlResults: import("@/types/pipeline").SqlResult[],
  startMs: number,
  success: boolean,
  errorMessage?: string
): void {
  const db = createServiceSupabase();
  db.from("option_executions")
    .insert({
      tenant_id: context.tenantId,
      user_id: context.userId,
      option_id: optionId,
      conversation_id: context.conversationId,
      input_params: params,
      sql_results: sqlResults.map((r) => ({ name: r.templateName, rowCount: r.rowCount })),
      execution_ms: Math.round(Date.now() - startMs),
      llm_tokens_used: 0,
      success,
      error_message: errorMessage ?? null,
    })
    .then(
      ({ error }) => { if (error) logger.warn("pipeline", `option_executions insert failed: ${error.message}`); },
      (err) => { logger.warn("pipeline", `option_executions insert failed: ${err}`); }
    );
}

function buildErrorResponse(
  message: string,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  retryRequest?: Partial<SendMessageRequest>
): ChatMessageResponse {
  return {
    messageId: generateId(),
    conversationId: context.conversationId,
    widgets: [
      {
        id: generateId(),
        type: "error_card",
        data: {
          message,
          retryable: !!retryRequest,
          retryRequest: retryRequest ?? null,
        },
        bookmarkable: false,
      },
    ],
    followUps: [],
    defaultOptions: defaultOpts,
    conversationState: "active",
  };
}
