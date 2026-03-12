import { getLLMProvider } from "@/lib/llm/factory";
import { executeDynamicQuery } from "./executor";
import { createServiceSupabase } from "@/lib/supabase/server";
import { QUERY_CONTEXTS, getContextById } from "./query-contexts";
import type { SqlResult, ConversationMessage } from "@/types/pipeline";
import type { ContextualSQLResult, IntelligenceAnalysis } from "@/lib/llm/provider";
import type { Widget } from "@/types/api";
import type { QueryContext, ContextSuggestion } from "./query-contexts";
import { logger } from "@/lib/logging/logger";

export interface DynamicQueryAnalysis {
  queryMode: "data" | "intelligence";
  contexts: ContextSuggestion[];
  allContexts: QueryContext[];
  resolvedEntity?: ResolvedEntity;
}

export interface ResolvedEntity {
  type: "activity";
  id: string;
  title: string;
  data?: Record<string, unknown>;
}

export async function analyzeDynamicQuery(
  userQuery: string,
  recentMessages: ConversationMessage[],
  tenantId: string
): Promise<DynamicQueryAnalysis> {
  const llm = getLLMProvider();
  const allIds = QUERY_CONTEXTS.map((c) => c.id);

  const [contextResult, resolvedEntity] = await Promise.all([
    llm.analyzeQueryContexts(userQuery, allIds),
    resolveEntityFromConversation(userQuery, recentMessages, tenantId),
  ]);

  const contexts: ContextSuggestion[] = contextResult.suggestions
    .filter((s) => getContextById(s.contextId))
    .map((s) => ({
      contextId: s.contextId,
      relevance: s.relevance,
      reason: s.reason,
    }));

  if (contexts.length === 0) {
    contexts.push({
      contextId: "my_activities",
      relevance: 0.5,
      reason: "Default: search across all activities",
    });
  }

  return {
    queryMode: contextResult.queryMode ?? "data",
    contexts,
    allContexts: QUERY_CONTEXTS,
    resolvedEntity: resolvedEntity ?? undefined,
  };
}

async function resolveEntityFromConversation(
  userQuery: string,
  recentMessages: ConversationMessage[],
  tenantId: string
): Promise<ResolvedEntity | null> {
  const hasEntityRef = /\b(this|that|the|it|its|current)\b/i.test(userQuery);
  if (!hasEntityRef) return null;

  for (let i = recentMessages.length - 1; i >= 0; i--) {
    const msg = recentMessages[i];
    const activityId = msg.inputParams?.activity_id as string | undefined;
    const isActivityOption = msg.optionId && [
      "activity.view", "activity.edit", "activity.add_note",
      "activity.add_media", "activity.create",
    ].includes(msg.optionId);

    if (activityId && isActivityOption) {
      return fetchActivityEntity(activityId, tenantId);
    }
  }

  return null;
}

async function fetchActivityEntity(
  activityId: string,
  tenantId: string
): Promise<ResolvedEntity | null> {
  try {
    const db = createServiceSupabase();

    const [activityRes, notesRes, tagsRes, mediaRes] = await Promise.all([
      db.from("activities").select("*").eq("id", activityId).eq("tenant_id", tenantId).single(),
      db.from("activity_notes").select("content, created_at").eq("activity_id", activityId).eq("tenant_id", tenantId).is("deleted_at", null).order("created_at", { ascending: false }).limit(10),
      db.from("activity_tags").select("tags(name, color, source)").eq("activity_id", activityId),
      db.from("activity_media").select("original_filename, mime_type, media_type, created_at").eq("activity_id", activityId).limit(20),
    ]);

    if (!activityRes.data) return null;

    const activity = activityRes.data;
    const summary = activity.ai_summary as Record<string, unknown> | null;
    const title = (summary?.enhancedTitle as string) ?? activity.title ?? "Activity";

    return {
      type: "activity",
      id: activityId,
      title,
      data: {
        ...activity,
        title,
        enhancedDescription: summary?.enhancedDescription ?? activity.description,
        highlights: summary?.highlights ?? [],
        notes: notesRes.data ?? [],
        tags: tagsRes.data?.map((t: Record<string, unknown>) => t.tags) ?? [],
        media: mediaRes.data ?? [],
        noteCount: notesRes.data?.length ?? 0,
        mediaCount: mediaRes.data?.length ?? 0,
      },
    };
  } catch (err) {
    logger.error("pipeline.fetchActivityEntity", "Failed to fetch activity entity", { error: (err as Error).message });
    return null;
  }
}

export async function executeIntelligenceQuery(
  userQuery: string,
  entity: ResolvedEntity,
  conversationContext: string[]
): Promise<IntelligenceAnalysis> {
  const llm = getLLMProvider();
  return llm.analyzeDataWithContext(
    userQuery,
    entity.data ?? { id: entity.id, title: entity.title },
    entity.type,
    conversationContext
  );
}

export async function executeIntelligenceQueryOnDataset(
  userQuery: string,
  rows: Record<string, unknown>[],
  contextLabel: string,
  conversationContext: string[]
): Promise<IntelligenceAnalysis> {
  const llm = getLLMProvider();
  return llm.analyzeDataWithContext(
    userQuery,
    { contextLabel, totalRows: rows.length, data: rows.slice(0, 30) },
    contextLabel,
    conversationContext
  );
}

export function buildContextPickerWidget(
  userQuery: string,
  suggestions: ContextSuggestion[],
  queryMode: "data" | "intelligence" = "data"
): Widget {
  const pickerContexts = suggestions.map((s) => {
    const ctx = getContextById(s.contextId)!;
    return {
      contextId: s.contextId,
      label: ctx.label,
      icon: ctx.icon,
      description: ctx.description,
      relevance: s.relevance,
      reason: s.reason,
    };
  });

  return {
    id: `ctx_picker_${Date.now()}`,
    type: "context_picker",
    data: {
      originalQuery: userQuery,
      contexts: pickerContexts,
      optionId: "dynamic_query",
      queryMode,
    },
    bookmarkable: false,
  };
}

export async function executeContextualQuery(
  userQuery: string,
  contextId: string,
  tenantId: string
): Promise<{
  sqlResult: SqlResult;
  sqlInfo: ContextualSQLResult;
  context: QueryContext;
}> {
  const ctx = getContextById(contextId);
  if (!ctx) {
    throw new Error(`Unknown query context: ${contextId}`);
  }

  const llm = getLLMProvider();
  const sqlInfo = await llm.generateContextualDynamicSQL(
    userQuery,
    ctx.baseSQL,
    ctx.availableColumns,
    ctx.paramNotes,
    ctx.allowedOperations
  );

  const sqlResult = await executeDynamicQuery(sqlInfo.sql, tenantId);
  return { sqlResult, sqlInfo, context: ctx };
}
