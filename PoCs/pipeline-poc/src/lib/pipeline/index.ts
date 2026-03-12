import type { SendMessageRequest, ChatMessageResponse, Widget, WidgetType, FileReference } from "@/types/api";
import type { UserContext } from "@/types/pipeline";
import { generateId } from "@/lib/utils";
import { resolveOption } from "./resolver";
import { startQASession, continueQASession } from "./qa-engine";
import { refineInput } from "./refiner";
import { executeSqlTemplates, consumeSqlDebug } from "./executor";
import { formatResponse } from "./formatter";
import {
  analyzeDynamicQuery, buildContextPickerWidget, executeContextualQuery,
  executeIntelligenceQuery, executeIntelligenceQueryOnDataset,
} from "./dynamic-sql";
import { getContextById } from "./query-contexts";
import { optionsToReferences } from "./context";
import { loadSqlTemplates } from "./loader";
import { getLLMProvider } from "@/lib/llm/factory";
import { consumeLlmDebug } from "@/lib/llm/openai";
import { createServiceSupabase } from "@/lib/supabase/server";
import { PipelineTrace } from "./trace";
import { logger } from "@/lib/logging/logger";

export async function processMessage(
  request: SendMessageRequest,
  context: UserContext
): Promise<ChatMessageResponse> {
  const defaultOpts = optionsToReferences(context.defaultOptions);
  const trace = new PipelineTrace({
    source: request.source,
    optionId: request.optionId,
    hasContent: !!request.content,
  });

  try {
    if (request.source === "qa_response" && request.optionId === "dynamic_query" && request.params?.selectedContextId) {
      const result = await handleContextualQueryExecution(request, context, defaultOpts, trace);
      result.debugTrace = trace.toJSON();
      return result;
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

    const resolved = await trace.step(
      "resolve_option",
      () => resolveOption(request, context),
      { source: request.source, optionId: request.optionId, content: request.content?.slice(0, 100) }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

    if (resolved.type === "dynamic") {
      const result = await handleDynamicQuery(request.content ?? "", context, defaultOpts, trace);
      result.debugTrace = trace.toJSON();
      return result;
    }

    if (!resolved.option) {
      const result = buildErrorResponse("I couldn't understand that. Could you try rephrasing, or choose an option?", context, defaultOpts);
      result.debugTrace = trace.toJSON();
      return result;
    }

    if (resolved.needsMoreInput) {
      const qaResult = await trace.step(
        "qa_session_start",
        () => startQASession(resolved.option!, resolved.extractedParams ?? {}),
        { optionId: resolved.option.id }
      );

      if (qaResult.status === "need_more" && qaResult.nextQuestions) {
        const entityCtx = await fetchEntityContext(resolved.extractedParams ?? {}, context.tenantId);

        const questionWidgets: Widget[] = qaResult.nextQuestions.map((q) => ({
          id: generateId(),
          type: "question_card" as WidgetType,
          data: {
            questionText: q.questionText,
            questionKey: q.questionKey,
            inlineWidget: q.inlineWidget,
            widgetConfig: q.widgetConfig ?? {},
            isRequired: q.isRequired ?? true,
            optionId: resolved.option!.id,
            sessionParams: resolved.extractedParams ?? {},
            entityContext: entityCtx,
          },
          bookmarkable: false,
        }));

        const widgets: Widget[] = [];
        if (entityCtx) {
          widgets.push({
            id: generateId(),
            type: "text_response" as WidgetType,
            data: { text: `**${resolved.option!.name}** for: *${entityCtx.title}*${entityCtx.subtitle ? ` (${entityCtx.subtitle})` : ""}` },
            bookmarkable: false,
          });
        }
        widgets.push(...questionWidgets);

        const result: ChatMessageResponse = {
          messageId: generateId(),
          conversationId: context.conversationId,
          widgets,
          followUps: [],
          defaultOptions: defaultOpts,
          conversationState: "awaiting_input",
          debugTrace: trace.toJSON(),
        };
        return result;
      }

      resolved.extractedParams = qaResult.collectedParams;
    }

    const templates = await loadSqlTemplates(resolved.option.id);
    const hasWrites = templates.some((t) => t.query_type === "write");

    if (hasWrites && request.source !== "confirmation") {
      const skipRefinement = SKIP_REFINEMENT_OPTIONS.has(resolved.option.id);
      let confirmFields: { label: string; value: string; inferred?: boolean }[];
      let confirmParams: Record<string, unknown>;
      let suggestedTags: { name: string; confidence: number }[] = [];

      if (skipRefinement) {
        confirmParams = resolved.extractedParams ?? {};
        confirmFields = buildSimpleDisplayFields(confirmParams, resolved.option.id);
      } else {
        const refined = await trace.step(
          "refine_input",
          () => refineInput(resolved.option!, resolved.extractedParams ?? {}, context.tenantId),
          { params: resolved.extractedParams }
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

      const summaryWidget: Widget = {
        id: generateId(),
        type: "text_response" as WidgetType,
        data: {
          text: "Here's what I've prepared. Does this look right?",
        },
        bookmarkable: false,
      };

      return {
        messageId: generateId(),
        conversationId: context.conversationId,
        widgets: [summaryWidget, confirmWidget],
        followUps: [],
        defaultOptions: defaultOpts,
        conversationState: "awaiting_confirmation",
        debugTrace: trace.toJSON(),
      };
    }

    const sqlResults = await trace.step(
      "execute_sql",
      () => executeSqlTemplates(resolved.option!.id, resolved.extractedParams ?? {}, { tenantId: context.tenantId, userId: context.userId }),
      { optionId: resolved.option.id, params: resolved.extractedParams }
    );
    trace.enrichLastStep({ sql: consumeSqlDebug() ?? undefined });

    const formatted = await trace.step(
      "format_response",
      () => formatResponse(resolved.option!, sqlResults, context),
      { rowCounts: sqlResults.map((r) => ({ name: r.templateName, count: r.rowCount })) }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

    const processedWidgets = filterEmptyWidgets(
      attachItemActions(formatted.widgets, resolved.option, context)
    );

    const widgets: Widget[] = processedWidgets.map((w) => ({
      id: generateId(),
      type: w.type as WidgetType,
      data: w.data,
      actions: w.actions,
      bookmarkable: true,
    }));

    const resourceId = extractActivityIdFromParams(resolved.extractedParams ?? {}, resolved.option.id)
      ?? extractResourceId(sqlResults);
    const followUps = buildFollowUps(resolved.option, context, resourceId);

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
    return pipelineResponse;
  } catch (error) {
    logger.error("pipeline", "Pipeline error", { error: (error as Error).message });
    trace.emitLogs(logger.info.bind(logger));
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
    () => continueQASession(option, previousParams, newAnswers),
    { optionId: option.id }
  );

  if (qaResult.status === "need_more" && qaResult.nextQuestions) {
    const collectedSoFar = qaResult.collectedParams ?? previousParams;
    const entityCtx = await fetchEntityContext(collectedSoFar, context.tenantId);

    const widgets: Widget[] = qaResult.nextQuestions.map((q) => ({
      id: generateId(),
      type: "question_card" as WidgetType,
      data: {
        questionText: q.questionText,
        questionKey: q.questionKey,
        inlineWidget: q.inlineWidget,
        widgetConfig: q.widgetConfig ?? {},
        isRequired: q.isRequired ?? true,
        optionId: option.id,
        sessionParams: collectedSoFar,
        entityContext: entityCtx,
      },
      bookmarkable: false,
    }));

    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets,
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "awaiting_input",
    };
  }

  const skipRefinement = SKIP_REFINEMENT_OPTIONS.has(option.id);
  let confirmFields: { label: string; value: string; inferred?: boolean }[];
  let confirmParams: Record<string, unknown>;
  let suggestedTags: { name: string; confidence: number }[] = [];

  if (skipRefinement) {
    confirmParams = qaResult.collectedParams ?? {};
    confirmFields = buildSimpleDisplayFields(confirmParams, option.id);
  } else {
    const refined = await trace.step(
      "refine_input",
      () => refineInput(option, qaResult.collectedParams ?? {}, context.tenantId),
      { params: qaResult.collectedParams }
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

async function handleConfirmation(
  request: SendMessageRequest,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const option = context.availableOptions.find((o) => o.id === request.optionId);
  if (!option) {
    return buildErrorResponse("Option not found.", context, defaultOpts);
  }

  const params = request.params ?? {};

  const sqlResults = await trace.step(
    "execute_sql",
    () => executeSqlTemplates(option.id, params, { tenantId: context.tenantId, userId: context.userId }),
    { optionId: option.id, paramKeys: Object.keys(params) }
  );
  trace.enrichLastStep({ sql: consumeSqlDebug() ?? undefined });

  const resourceId = extractActivityIdFromParams(params, option.id)
    ?? extractResourceId(sqlResults);

  if (params.tags && Array.isArray(params.tags) && resourceId) {
    await trace.step(
      "save_tags",
      () => saveActivityTags(resourceId!, params.tags as string[], context.tenantId),
      { tagCount: (params.tags as string[]).length, activityId: resourceId }
    );
  }

  let savedMediaFiles: FileReference[] = [];
  if (params.media_keys && Array.isArray(params.media_keys) && resourceId) {
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

  if (resourceId && (option.id === "activity.create" || option.id === "activity.edit")) {
    await trace.step(
      "generate_ai_summary",
      () => generateAndStoreAiSummary(resourceId!, params, context.tenantId),
      { activityId: resourceId }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });
  }

  const formatted = await trace.step(
    "format_response",
    () => formatResponse(option, sqlResults, context),
    { rowCounts: sqlResults.map((r) => ({ name: r.templateName, count: r.rowCount })) }
  );
  trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

  // Merge saved media into activity_card widgets (write results don't include media)
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

  // Merge tags into activity_card if present
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
  const followUps = buildFollowUps(option, context, resourceId);

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

async function handleDynamicQuery(
  content: string,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  try {
    const analysis = await trace.step(
      "analyze_dynamic_query",
      () => analyzeDynamicQuery(content, context.recentMessages, context.tenantId),
      { query: content.slice(0, 100) }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

    const conversationStrs = context.recentMessages
      .filter((m) => m.content)
      .map((m) => `${m.role}: ${m.content}`);

    // Intelligence query with a resolved entity (e.g., "give me insights about this activity")
    if (analysis.queryMode === "intelligence" && analysis.resolvedEntity) {
      return await handleIntelligenceQuery(
        content, analysis.resolvedEntity, conversationStrs, context, defaultOpts, trace
      );
    }

    // Intelligence query without specific entity — auto-select best context and analyze
    if (analysis.queryMode === "intelligence") {
      const bestCtx = analysis.contexts[0];
      if (bestCtx) {
        // For intelligence, we always have a context to work with — use the best one
        return await handleIntelligenceOnDataset(
          content, bestCtx.contextId, conversationStrs, context, defaultOpts, trace
        );
      }
    }

    // Data query — auto-select context if high confidence single match
    const topCtx = analysis.contexts[0];
    if (topCtx && topCtx.relevance >= 0.85) {
      const autoResult = await handleContextualQueryExecution(
        {
          conversationId: context.conversationId,
          source: "qa_response",
          optionId: "dynamic_query",
          params: {
            selectedContextId: topCtx.contextId,
            originalQuery: content,
            queryMode: analysis.queryMode,
          },
        },
        context,
        defaultOpts,
        trace
      );
      return autoResult;
    }

    // Show context picker — pass queryMode so it routes correctly on selection
    const pickerWidget = buildContextPickerWidget(content, analysis.contexts, analysis.queryMode);
    const promptText = analysis.queryMode === "intelligence"
      ? "I'd like to analyze that for you. Which data should I look at?"
      : "I can look that up for you. Which data would you like me to search?";
    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [
        {
          id: generateId(),
          type: "text_response" as WidgetType,
          data: { text: promptText },
          bookmarkable: false,
        },
        pickerWidget,
      ],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "awaiting_input",
    };
  } catch (error) {
    logger.error("pipeline.dynamicQuery", "Dynamic query analysis failed", { error: (error as Error).message });
    return buildErrorResponse(
      "I couldn't understand that query. Could you try asking in a different way?",
      context,
      defaultOpts
    );
  }
}

async function handleIntelligenceQuery(
  userQuery: string,
  entity: import("./dynamic-sql").ResolvedEntity,
  conversationContext: string[],
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const analysis = await trace.step(
    "intelligence_analysis",
    () => executeIntelligenceQuery(userQuery, entity, conversationContext),
    { entityType: entity.type, entityId: entity.id, entityTitle: entity.title }
  );
  trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

  const widgets: Widget[] = [
    {
      id: generateId(),
      type: "text_response" as WidgetType,
      data: { text: analysis.response },
      bookmarkable: true,
    },
  ];

  if (analysis.followUpSuggestions && analysis.followUpSuggestions.length > 0) {
    widgets.push({
      id: generateId(),
      type: "text_response" as WidgetType,
      data: {
        text: "**You might also want to ask:**\n" +
          analysis.followUpSuggestions.map((s) => `- ${s}`).join("\n"),
      },
      bookmarkable: false,
    });
  }

  const followUps: import("@/types/api").OptionReference[] = [];
  if (entity.type === "activity") {
    const viewOpt = context.availableOptions.find((o) => o.id === "activity.view");
    if (viewOpt) {
      followUps.push({
        optionId: "activity.view",
        name: "View Activity Details",
        icon: "Eye",
        params: { activity_id: entity.id },
      });
    }
  }

  return {
    messageId: generateId(),
    conversationId: context.conversationId,
    widgets,
    followUps,
    defaultOptions: defaultOpts,
    conversationState: "active",
  };
}

async function handleIntelligenceOnDataset(
  userQuery: string,
  contextId: string,
  conversationContext: string[],
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const ctx = getContextById(contextId);
  if (!ctx) {
    return buildErrorResponse("Unknown data context.", context, defaultOpts);
  }

  const { sqlResult } = await trace.step(
    "fetch_dataset_for_intelligence",
    () => executeContextualQuery(
      userQuery, contextId, context.tenantId
    ),
    { contextId, query: userQuery.slice(0, 100) }
  );
  trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined, sql: consumeSqlDebug() ?? undefined });

  const analysis = await trace.step(
    "intelligence_analysis",
    () => executeIntelligenceQueryOnDataset(
      userQuery, sqlResult.rows, ctx.label, conversationContext
    ),
    { contextLabel: ctx.label, rowCount: sqlResult.rowCount }
  );
  trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

  const widgets: Widget[] = [
    {
      id: generateId(),
      type: "text_response" as WidgetType,
      data: { text: analysis.response },
      bookmarkable: true,
    },
  ];

  if (analysis.followUpSuggestions && analysis.followUpSuggestions.length > 0) {
    widgets.push({
      id: generateId(),
      type: "text_response" as WidgetType,
      data: {
        text: "**You might also want to ask:**\n" +
          analysis.followUpSuggestions.map((s) => `- ${s}`).join("\n"),
      },
      bookmarkable: false,
    });
  }

  return {
    messageId: generateId(),
    conversationId: context.conversationId,
    widgets,
    followUps: [],
    defaultOptions: defaultOpts,
    conversationState: "active",
  };
}

async function handleContextualQueryExecution(
  request: SendMessageRequest,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const contextId = request.params?.selectedContextId as string;
  const originalQuery = request.params?.originalQuery as string;
  const queryMode = (request.params?.queryMode as string) ?? "data";

  try {
    const { sqlResult, sqlInfo, context: queryCtx } = await trace.step(
      "contextual_dynamic_query",
      () => executeContextualQuery(originalQuery, contextId, context.tenantId),
      { contextId, query: originalQuery?.slice(0, 100), queryMode }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined, sql: consumeSqlDebug() ?? undefined });

    // Intelligence mode: fetch data then run AI analysis on it
    if (queryMode === "intelligence" && sqlResult.rowCount > 0) {
      const conversationStrs = context.recentMessages
        .filter((m) => m.content)
        .map((m) => `${m.role}: ${m.content}`);

      const analysis = await trace.step(
        "intelligence_analysis",
        () => executeIntelligenceQueryOnDataset(
          originalQuery, sqlResult.rows, queryCtx.label, conversationStrs
        ),
        { contextLabel: queryCtx.label, rowCount: sqlResult.rowCount }
      );
      trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

      const widgets: Widget[] = [
        {
          id: generateId(),
          type: "text_response" as WidgetType,
          data: { text: analysis.response },
          bookmarkable: true,
        },
      ];

      if (analysis.followUpSuggestions && analysis.followUpSuggestions.length > 0) {
        widgets.push({
          id: generateId(),
          type: "text_response" as WidgetType,
          data: {
            text: "**You might also want to ask:**\n" +
              analysis.followUpSuggestions.map((s) => `- ${s}`).join("\n"),
          },
          bookmarkable: false,
        });
      }

      return {
        messageId: generateId(),
        conversationId: context.conversationId,
        widgets,
        followUps: [],
        defaultOptions: defaultOpts,
        conversationState: "active",
      };
    }

    // Data mode: show results as widgets
    const widgets: Widget[] = [];

    widgets.push({
      id: generateId(),
      type: "text_response" as WidgetType,
      data: { text: sqlInfo.description },
      bookmarkable: false,
    });

    if (sqlResult.rowCount === 0) {
      widgets.push({
        id: generateId(),
        type: "text_response" as WidgetType,
        data: { text: `No results found in **${queryCtx.label}** for your query.` },
        bookmarkable: false,
      });
    } else if (sqlInfo.suggestedWidgetType === "stats_card") {
      widgets.push({
        id: generateId(),
        type: "stats_card" as WidgetType,
        data: { items: sqlResult.rows },
        bookmarkable: true,
      });
    } else if (sqlInfo.suggestedWidgetType === "chart") {
      const rows = sqlResult.rows;
      const cols = sqlInfo.outputColumns;
      const firstRow = rows[0] ?? {};
      const labelCol = cols.find((c) => typeof firstRow[c] === "string") ?? cols[0];
      const valueCols = cols.filter((c) => c !== labelCol && typeof firstRow[c] === "number");
      if (valueCols.length === 0) {
        const fallback = cols.find((c) => c !== labelCol) ?? cols[1];
        if (fallback) valueCols.push(fallback);
      }

      widgets.push({
        id: generateId(),
        type: "chart" as WidgetType,
        data: {
          chartType: sqlInfo.chartType ?? "bar",
          title: sqlInfo.description,
          labels: rows.map((r) => String(r[labelCol])),
          datasets: valueCols.map((col) => ({
            label: col.replace(/_/g, " "),
            data: rows.map((r) => Number(r[col]) || 0),
          })),
        },
        bookmarkable: true,
      });
    } else {
      widgets.push({
        id: generateId(),
        type: "data_list" as WidgetType,
        data: {
          items: sqlResult.rows,
          title: queryCtx.label,
          columns: sqlInfo.outputColumns,
        },
        bookmarkable: true,
      });
    }

    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets,
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  } catch (error) {
    logger.error("pipeline.contextualQuery", "Contextual query execution failed", { error: (error as Error).message });
    return buildErrorResponse(
      "The query didn't work out. Could you rephrase or try a different context?",
      context,
      defaultOpts,
      {
        source: "qa_response",
        optionId: "dynamic_query",
        params: { selectedContextId: contextId, originalQuery },
      }
    );
  }
}

function extractResourceId(sqlResults: import("@/types/pipeline").SqlResult[]): string | undefined {
  for (const result of sqlResults) {
    if (result.rows.length === 1 && result.rows[0]?.id) {
      return String(result.rows[0].id);
    }
  }
  return undefined;
}

function extractActivityIdFromParams(
  params: Record<string, unknown>,
  optionId: string
): string | undefined {
  const childOptions = [
    "activity.add_note", "activity.add_media",
    "activity.view", "activity.edit", "activity.delete",
  ];
  if (childOptions.includes(optionId) && params.activity_id) {
    return String(params.activity_id);
  }
  return undefined;
}

function buildFollowUps(
  option: import("@/types/options").OptionDefinition,
  context: UserContext,
  resourceId?: string
): import("@/types/api").OptionReference[] {
  const activityOptions = [
    "activity.view", "activity.edit", "activity.delete",
    "activity.add_note", "activity.add_media",
  ];

  return option.follow_up_option_ids
    .map((id) => context.availableOptions.find((o) => o.id === id))
    .filter(Boolean)
    .map((opt) => {
      const ref: import("@/types/api").OptionReference = {
        optionId: opt!.id,
        name: opt!.name,
        icon: opt!.icon ?? "Zap",
      };
      if (resourceId && activityOptions.includes(opt!.id)) {
        ref.params = { activity_id: resourceId };
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

  await db
    .from("activity_tags")
    .delete()
    .eq("activity_id", activityId);

  const rows = tags.map((tag: { id: string }) => ({
    activity_id: activityId,
    tag_id: tag.id,
  }));

  await db.from("activity_tags").insert(rows);
}

const SKIP_REFINEMENT_OPTIONS = new Set([
  "activity.add_note",
  "activity.add_media",
  "activity.delete",
  "tag.manage",
  "tag.create",
]);

const HIDDEN_DISPLAY_KEYS = new Set([
  "activity_id",
  "tenant_id",
  "user_id",
  "media_keys",
  "media_file_names",
]);

function buildSimpleDisplayFields(
  params: Record<string, unknown>,
  _optionId: string
): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  for (const [key, val] of Object.entries(params)) {
    if (HIDDEN_DISPLAY_KEYS.has(key) || val == null) continue;
    if (typeof val === "object") continue;
    const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    fields.push({ label, value: String(val) });
  }
  return fields;
}

const ITEM_LEVEL_OPTIONS = [
  "activity.view", "activity.edit",
  "activity.add_note", "activity.add_media", "activity.delete",
];

function attachItemActions(
  widgets: { type: string; data: Record<string, unknown>; actions?: import("@/types/api").WidgetAction[] }[],
  option: import("@/types/options").OptionDefinition | null,
  context: UserContext
): typeof widgets {
  if (!option || option.category !== "activity") return widgets;

  const itemActions: import("@/types/api").WidgetAction[] = option.follow_up_option_ids
    .filter((id) => ITEM_LEVEL_OPTIONS.includes(id))
    .map((id) => context.availableOptions.find((o) => o.id === id))
    .filter(Boolean)
    .map((opt) => ({
      label: opt!.name,
      icon: opt!.icon ?? "Zap",
      optionId: opt!.id,
    }));

  if (itemActions.length === 0) return widgets;

  return widgets.map((w) => {
    if (w.type === "data_list") return { ...w, actions: itemActions };
    if (w.type === "activity_card") {
      const activityId = w.data.id as string | undefined;
      const cardActions = activityId
        ? itemActions.map((a) => ({
            ...a,
            targetResourceId: activityId,
            params: { activity_id: activityId },
          }))
        : itemActions;
      return { ...w, actions: cardActions };
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

async function fetchEntityContext(
  params: Record<string, unknown>,
  tenantId: string
): Promise<EntityContext | null> {
  const activityId = params.activity_id as string | undefined;
  if (!activityId) return null;

  try {
    const db = createServiceSupabase();
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
    const subtitle = [data.status, dateStr].filter(Boolean).join(" · ");

    return {
      entityType: "activity",
      entityId: activityId,
      title,
      subtitle: subtitle || undefined,
    };
  } catch {
    return null;
  }
}

async function generateAndStoreAiSummary(
  activityId: string,
  params: Record<string, unknown>,
  tenantId: string
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
    });

    const db = createServiceSupabase();
    await db
      .from("activities")
      .update({
        ai_summary: {
          ...summary,
          generatedAt: new Date().toISOString(),
        },
      })
      .eq("id", activityId)
      .eq("tenant_id", tenantId);
  } catch {
    // Non-critical: if summary generation fails, the activity still works
  }
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
