import type { SendMessageRequest, ChatMessageResponse, Widget, WidgetType } from "@/types/api";
import type { UserContext } from "@/types/pipeline";
import { generateId } from "@/lib/utils";
import { getLLMProvider } from "@/lib/llm/factory";
import { consumeLlmDebug } from "@/lib/llm/openai";
import { optionsToReferences } from "./context";
import { PipelineTrace } from "./trace";
import { logger } from "@/lib/logging/logger";
import { runFilterAndGetContextItems, type InsightContextItem } from "./context-filters";
import { loadReportDefinitions } from "./loader";
import { executeReportTemplates } from "./report-executor";

export type { InsightContextItem };

function reportRowsToChartData(
  rows: Record<string, unknown>[],
  labelColumn: string | null,
  valueColumns: string[]
): { labels: string[]; datasets: { label: string; data: number[] }[] } {
  const labelKey = labelColumn ?? "name";
  const labels = rows.map((r) => String(r[labelKey] ?? ""));
  const datasets = valueColumns.map((col) => ({
    label: col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    data: rows.map((r) => Number(r[col] ?? 0)),
  }));
  return { labels, datasets };
}

export async function handleInsightsQuery(
  request: SendMessageRequest,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const question = request.content ?? "";
  const filterId = request.params?.filterId as string | undefined;
  let contextItems = (request.params?.contextItems ?? []) as InsightContextItem[];

  if (filterId && contextItems.length === 0) {
    try {
      contextItems = await trace.step(
        "run_filter",
        () => runFilterAndGetContextItems(filterId, context),
        { filterId }
      );
    } catch (err) {
      logger.error("pipeline.insights", "Filter execution failed", { filterId, error: (err as Error).message });
      return {
        messageId: generateId(),
        conversationId: context.conversationId,
        widgets: [{
          id: generateId(),
          type: "error_card" as WidgetType,
          data: { message: "Failed to load filter data. Please try again.", retryable: true },
          bookmarkable: false,
        }],
        followUps: [],
        defaultOptions: defaultOpts,
        conversationState: "active",
      };
    }
  }

  if (contextItems.length === 0) {
    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [{
        id: generateId(),
        type: "error_card" as WidgetType,
        data: {
          message: filterId
            ? "No records found for this filter. Try a different filter or pin items from results."
            : "Please select a filter or pin items to context before asking a question.",
          retryable: false,
        },
        bookmarkable: false,
      }],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  }

  const contextBlock = contextItems.map((item, i) =>
    `[${i + 1}] ${item.entityType}: "${item.label}"\n${item.summary}`
  ).join("\n\n");

  const systemPrompt = `You are an analytical assistant. The user is asking about ${contextItems.length} item(s) from their data.

Here is the context data:

${contextBlock}

Answer the user's question based on this context. Be specific, reference the items by name when relevant, and provide actionable insights. Keep the response concise and well-structured with markdown formatting.

IMPORTANT: The user selects from predefined filters—they cannot change what data is included. If the context does not contain the information needed to answer the question, briefly state that the available data does not include that information. Do NOT suggest metrics to collect, timeframes to add, or how to improve the query. Do NOT give guidance about what data would be needed.`;

  try {
    const llm = getLLMProvider();
    const response = await trace.step(
      "insights_llm_call",
      async () => {
        const result = await llm.chat(systemPrompt, question);
        return result;
      },
      { contextItemCount: contextItems.length, question: question.slice(0, 100) }
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

    const widgets: Widget[] = [{
      id: generateId(),
      type: "text_response" as WidgetType,
      data: {
        text: response,
        relatedItems: contextItems.map((item) => ({
          entityType: item.entityType,
          entityId: item.entityId,
          label: item.label,
          summary: item.summary,
          viewAction: item.viewAction,
        })),
      },
      bookmarkable: true,
    }];

    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets,
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  } catch (error) {
    logger.error("pipeline.insights", "Insights query failed", { error: (error as Error).message });
    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [{
        id: generateId(),
        type: "error_card" as WidgetType,
        data: { message: "Failed to generate insights. Please try again.", retryable: true },
        bookmarkable: false,
      }],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  }
}

export async function handleReportQuery(
  request: SendMessageRequest,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const filterId = request.params?.filterId as string | undefined;
  const question = (request.content as string) || "Summarize the key insights and trends from this report data.";

  if (!filterId) {
    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [{
        id: generateId(),
        type: "error_card" as WidgetType,
        data: { message: "A filter is required to generate a report.", retryable: false },
        bookmarkable: false,
      }],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  }

  try {
    const [contextItems, reportDefs] = await Promise.all([
      trace.step("run_filter", () => runFilterAndGetContextItems(filterId, context), { filterId }),
      trace.step("load_report_definitions", () => loadReportDefinitions(filterId, context.userType)),
    ]);

    const report = reportDefs[0];
    if (!report) {
      return {
        messageId: generateId(),
        conversationId: context.conversationId,
        widgets: [{
          id: generateId(),
          type: "error_card" as WidgetType,
          data: { message: "No report is available for this filter.", retryable: false },
          bookmarkable: false,
        }],
        followUps: [],
        defaultOptions: defaultOpts,
        conversationState: "active",
      };
    }

    const chartResults = await trace.step(
      "execute_report_templates",
      () => executeReportTemplates(report.id, { tenantId: context.tenantId, userId: context.userId })
    );

    const charts = chartResults.map((c) => {
      const { labels, datasets } = reportRowsToChartData(
        c.rows,
        c.labelColumn,
        c.valueColumns.length > 0 ? c.valueColumns : ["count"]
      );
      return {
        chartType: c.chartType,
        title: c.chartTitle,
        labels,
        datasets,
      };
    });

    const contextBlock = contextItems.map((item, i) =>
      `[${i + 1}] ${item.entityType}: "${item.label}"\n${item.summary}`
    ).join("\n\n");

    const chartSummary = chartResults.map((c) => {
      const topRows = c.rows.slice(0, 5);
      const lines = topRows.map((r) => {
        const label = c.labelColumn ? String(r[c.labelColumn] ?? "") : "";
        const val = c.valueColumns[0] ? String(r[c.valueColumns[0]] ?? "") : "";
        return `${label}: ${val}`;
      });
      return `**${c.chartTitle}**: ${lines.join("; ")}`;
    }).join("\n\n");

    const systemPrompt = `You are an analytical assistant. The user is asking about a report with ${contextItems.length} item(s) and ${charts.length} chart(s).

Context data:
${contextBlock}

Chart summaries:
${chartSummary}

Answer the user's question based on this data. Be specific and provide actionable insights. Use markdown formatting.`;

    const llm = getLLMProvider();
    const insights = await trace.step(
      "report_insights_llm",
      () => llm.chat(systemPrompt, question)
    );
    trace.enrichLastStep({ llm: consumeLlmDebug() ?? undefined });

    const reportWidget: Widget = {
      id: generateId(),
      type: "report_view" as WidgetType,
      data: {
        charts,
        insights,
        filterId,
      },
      bookmarkable: true,
    };

    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [reportWidget],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  } catch (error) {
    logger.error("pipeline.report", "Report generation failed", { error: (error as Error).message });
    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [{
        id: generateId(),
        type: "error_card" as WidgetType,
        data: { message: "Failed to generate report. Please try again.", retryable: true },
        bookmarkable: false,
      }],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };
  }
}
