import type { SendMessageRequest, ChatMessageResponse, Widget, WidgetType } from "@/types/api";
import type { UserContext } from "@/types/pipeline";
import { generateId } from "@/lib/utils";
import { getLLMProvider } from "@/lib/llm/factory";
import { consumeLlmDebug } from "@/lib/llm/openai";
import { optionsToReferences } from "./context";
import { PipelineTrace } from "./trace";
import { logger } from "@/lib/logging/logger";

export interface InsightContextItem {
  entityType: string;
  entityId: string;
  label: string;
  summary: string;
}

export async function handleInsightsQuery(
  request: SendMessageRequest,
  context: UserContext,
  defaultOpts: ReturnType<typeof optionsToReferences>,
  trace: PipelineTrace
): Promise<ChatMessageResponse> {
  const question = request.content ?? "";
  const contextItems = (request.params?.contextItems ?? []) as InsightContextItem[];

  if (contextItems.length === 0) {
    return {
      messageId: generateId(),
      conversationId: context.conversationId,
      widgets: [{
        id: generateId(),
        type: "error_card" as WidgetType,
        data: { message: "Please pin some items to context before asking a question.", retryable: false },
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

  const systemPrompt = `You are an analytical assistant. The user has pinned ${contextItems.length} item(s) from their data and is asking a question about them.

Here is the context data:

${contextBlock}

Answer the user's question based on this context. Be specific, reference the items by name when relevant, and provide actionable insights. Keep the response concise and well-structured with markdown formatting.`;

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
      data: { text: response },
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
