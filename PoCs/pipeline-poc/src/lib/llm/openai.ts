import OpenAI from "openai";
import type { OptionSummary } from "@/types/options";
import type { LlmCallDebug } from "@/lib/pipeline/trace";
import { logger } from "@/lib/logging/logger";
import type {
  LLMProvider,
  IntentClassification,
  RefinedInput,
  RefinementContext,
  FormattedResponse,
  FormatContext,
  DynamicSQLResult,
  QuestionGroup,
  ActivitySummary,
  ContextAnalysisResult,
  ContextualSQLResult,
  IntelligenceAnalysis,
} from "./provider";

let _llmCallDebug: LlmCallDebug | null = null;

export function consumeLlmDebug(): LlmCallDebug | null {
  const d = _llmCallDebug;
  _llmCallDebug = null;
  return d;
}

function captureLlmDebug(
  model: string,
  systemPrompt: string,
  userInput: string,
  response: string,
  finishReason?: string
) {
  _llmCallDebug = {
    model,
    systemPrompt: systemPrompt.length > 2000 ? systemPrompt.slice(0, 2000) + "..." : systemPrompt,
    userInput: userInput.length > 1000 ? userInput.slice(0, 1000) + "..." : userInput,
    response: response.length > 2000 ? response.slice(0, 2000) + "..." : response,
    finishReason,
  };
}

const AVAILABLE_TABLES_SCHEMA = `
Tables (all tenant-scoped with tenant_id):
- activities: id, tenant_id, created_by, title, description, status(planned/in_progress/completed/cancelled), visibility(private/team/public), activity_date, location, is_pinned, created_at, deleted_at
- activity_notes: id, tenant_id, activity_id, created_by, content, created_at
- activity_media: id, tenant_id, activity_id, media_type, original_filename, s3_key, mime_type, created_at
- tags: id, tenant_id(NULL for system), name, slug, color, source(system/custom/ai)
- activity_tags: id, activity_id, tag_id, confidence
`.trim();

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async classifyIntent(
    userText: string,
    availableOptions: OptionSummary[],
    conversationContext: string[]
  ): Promise<IntentClassification> {
    const optionList = availableOptions
      .map((o) => `- ${o.id}: ${o.description} [keywords: ${o.keywords.join(", ")}]`)
      .join("\n");

    const contextStr = conversationContext.length > 0
      ? `\nRecent conversation:\n${conversationContext.slice(-4).join("\n")}`
      : "";

    const sysPrompt = `You classify user messages into predefined options. Available options:\n${optionList}${contextStr}\n\nRespond with JSON: {"optionId": "option.id or null if no match", "confidence": 0.0-1.0, "extractedParams": {extracted parameters from the text}}`;
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-nano",
        instructions: sysPrompt,
        input: `${userText}\n\nRespond in json.`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 500,
        store: false,
      });
      const content = response.output_text ?? "";
      captureLlmDebug("gpt-5-nano", sysPrompt, userText, content, response.status);
      return JSON.parse(content) as IntentClassification;
    } catch {
      return { optionId: null, confidence: 0, extractedParams: {} };
    }
  }

  async extractParams(
    userText: string,
    targetSchema: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const sysPrompt = `Extract structured parameters from the user text based on this schema:\n${JSON.stringify(targetSchema, null, 2)}\n\nReturn JSON with the extracted parameters. Infer values where reasonable (e.g. "today morning" = today's date at 9am, "yesterday" = yesterday). If a field cannot be inferred, omit it.`;
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-nano",
        instructions: sysPrompt,
        input: `${userText}\n\nRespond in json.`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 1000,
        store: false,
      });
      const content = response.output_text ?? "";
      captureLlmDebug("gpt-5-nano", sysPrompt, userText, content, response.status);
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  async refineInput(
    rawParams: Record<string, unknown>,
    targetSchema: Record<string, unknown>,
    context: RefinementContext
  ): Promise<RefinedInput> {
    const tagList = context.availableTags
      ? context.availableTags.map((t) => t.name).join(", ")
      : "";

    const llmInput: Record<string, unknown> = {};
    const STRIP_KEYS = new Set(["media_keys", "media_file_names", "tenant_id", "user_id", "activity_id"]);
    for (const [k, v] of Object.entries(rawParams)) {
      if (STRIP_KEYS.has(k)) continue;
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object") continue;
      llmInput[k] = v;
    }

    const sysPrompt = `Refine raw user input into well-formed activity data. Return JSON with exactly these keys:
{"params":{"title":"...","description":"...","status":"...","visibility":"...","activity_date":"...","location":"..."},"suggestions":{"tags":[{"name":"...","confidence":0.8}]},"refinementNotes":[],"displaySummary":{"Title":"...","Description":"..."}}`
      + (tagList ? `\nAvailable tags: ${tagList}` : "")
      + `\nRules: title=short 5-10 words, description=1-2 full sentences (different from title), omit empty fields from displaySummary, dates in "Mon DD, YYYY" format in displaySummary, infer status from tense (past=completed, future=planned).`;
    const userInput = JSON.stringify(llmInput);

    const MAX_ATTEMPTS = 2;
    const TOKEN_LIMITS = [5000, 8000, 10000];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const response = await this.client.responses.create({
          model: "gpt-5-mini",
          instructions: sysPrompt,
          input: `${userInput}\n\nRespond in json.`,
          text: { format: { type: "json_object" } },
          max_output_tokens: TOKEN_LIMITS[attempt],
          store: false,
        });

        const content = response.output_text;
        const status = response.status;
        captureLlmDebug("gpt-5-mini", sysPrompt, userInput, content ?? "", status);

        if (!content || status === "incomplete") {
          const detail = (response as unknown as Record<string, unknown>).incomplete_details;
          logger.warn("llm.refineInput", `Attempt ${attempt + 1}/${MAX_ATTEMPTS}: empty/incomplete`, {
            status, details: detail as Record<string, unknown> ?? {},
          });
          if (attempt < MAX_ATTEMPTS - 1) continue;
          return this.buildRefineFallback(rawParams);
        }

        const parsed = JSON.parse(content) as RefinedInput;
        parsed.params = { ...rawParams, ...parsed.params };
        logger.info("llm.refineInput", "LLM success", { title: parsed.params?.title as string });
        return parsed;
      } catch (err) {
        const errObj = err as Record<string, unknown>;
        logger.error("llm.refineInput", `Attempt ${attempt + 1}/${MAX_ATTEMPTS} failed`, {
          code: errObj?.code as string, error: (errObj?.message ?? String(err)) as string,
        });
        if (attempt < MAX_ATTEMPTS - 1) continue;
        return this.buildRefineFallback(rawParams);
      }
    }

    return this.buildRefineFallback(rawParams);
  }

  private buildRefineFallback(rawParams: Record<string, unknown>): RefinedInput {
    const raw = (rawParams.description_raw as string) || "";
    const title =
      (rawParams.title as string) ||
      deriveShortTitle(raw) ||
      "Untitled Activity";
    const description =
      (rawParams.description as string) ||
      raw ||
      title;

    const HIDDEN_KEYS = new Set([
      "description_raw", "media_keys", "media_file_names",
      "activity_id", "tenant_id", "user_id",
    ]);

    const displayEntries: Record<string, string> = {};
    for (const [k, v] of Object.entries({ title, description, ...rawParams })) {
      if (HIDDEN_KEYS.has(k) || v == null || typeof v === "object") continue;
      const label = k
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const strVal = k.includes("date") ? formatFallbackDate(String(v)) : String(v);
      displayEntries[label] = strVal;
    }

    return {
      params: { ...rawParams, title, description },
      suggestions: {},
      refinementNotes: ["LLM refinement unavailable — using raw input"],
      displaySummary: displayEntries,
    };
  }

  async formatResponse(
    results: unknown,
    context: FormatContext
  ): Promise<FormattedResponse> {
    const sysPrompt = `Format database results into a structured chat response. ${context.responsePrompt}

Return JSON:
{
  "summary": "Brief friendly summary",
  "widgets": [{"type": "widget_type", "data": { widget-specific data }}],
  "followUpOptionIds": ${JSON.stringify(context.followUpOptionIds)}
}

Widget types: text_response, activity_card, data_list, chart, stats_card.
For data_list: pass DB rows directly as items. Do NOT add actions to widgets.
For activity_card: use snake_case field names matching DB columns.`;
    const userInput = JSON.stringify(results);
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-nano",
        instructions: sysPrompt,
        input: `${userInput}\n\nRespond in json.`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 2000,
        store: false,
      });
      const content = response.output_text ?? "";
      captureLlmDebug("gpt-5-nano", sysPrompt, userInput, content, response.status);
      return JSON.parse(content) as FormattedResponse;
    } catch {
      return {
        summary: "Here are the results.",
        widgets: [{ type: "text_response", data: { text: JSON.stringify(results, null, 2) } }],
        followUpOptionIds: context.followUpOptionIds,
      };
    }
  }

  async generateDynamicSQL(
    userIntent: string,
    _tableSchemas?: string
  ): Promise<DynamicSQLResult> {
    const sysPrompt = `Generate a PostgreSQL SELECT query for the user's request.\n\n${AVAILABLE_TABLES_SCHEMA}\n\nRules:\n- ONLY SELECT statements. Never INSERT/UPDATE/DELETE/DROP/ALTER/CREATE/TRUNCATE.\n- ALWAYS include WHERE tenant_id = $1\n- Use proper JOINs, aggregations when needed\n- LIMIT 100 max\n- Return JSON: {"sql": "SELECT ...", "description": "What this query shows"}`;
    const response = await this.client.responses.create({
      model: "gpt-5-mini",
      instructions: sysPrompt,
      input: `${userIntent}\n\nRespond in json.`,
      text: { format: { type: "json_object" } },
      max_output_tokens: 1000,
      store: false,
    });
    const content = response.output_text ?? "";
    captureLlmDebug("gpt-5-mini", sysPrompt, userIntent, content, response.status);
    return JSON.parse(content) as DynamicSQLResult;
  }

  async generateActivitySummary(
    activityData: Record<string, unknown>
  ): Promise<ActivitySummary> {
    const sysPrompt = `Generate a display-ready summary for an activity record. Return JSON: {"enhancedTitle":"Professional 5-10 word title","enhancedDescription":"Well-written 1-3 sentence description","highlights":["key point 1"]}. Keep it concise and professional.`;
    const userInput = JSON.stringify(activityData);
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-nano",
        instructions: sysPrompt,
        input: `${userInput}\n\nRespond in json.`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 400,
        store: false,
      });
      const content = response.output_text ?? "";
      captureLlmDebug("gpt-5-nano", sysPrompt, userInput, content, response.status);
      return JSON.parse(content) as ActivitySummary;
    } catch {
      return {
        enhancedTitle: (activityData.title as string) ?? "Activity",
        enhancedDescription: (activityData.description as string) ?? "",
        highlights: [],
      };
    }
  }

  async groupQuestions(
    questions: import("./provider").QuestionItem[],
    knownParams: Record<string, unknown>
  ): Promise<QuestionGroup[]> {
    const remaining = questions.filter((q) => !(q.questionKey in knownParams));
    if (remaining.length === 0) return [];

    if (remaining.length <= 2) {
      return [{ keys: remaining.map((q) => q.questionKey), questions: remaining }];
    }

    const firstQ = remaining[0];
    const rest = remaining.slice(1);
    const groups: QuestionGroup[] = [
      { keys: [firstQ.questionKey], questions: [firstQ] },
    ];

    const groupableRest = rest.filter((q) => q.inlineWidget);
    const ungroupableRest = rest.filter((q) => !q.inlineWidget);

    if (groupableRest.length > 0) {
      groups.push({ keys: groupableRest.map((q) => q.questionKey), questions: groupableRest });
    }
    for (const q of ungroupableRest) {
      groups.push({ keys: [q.questionKey], questions: [q] });
    }

    return groups;
  }

  async analyzeQueryContexts(
    userQuery: string,
    availableContextIds: string[]
  ): Promise<ContextAnalysisResult> {
    const sysPrompt = `Classify a user query and determine relevant data contexts.

Step 1 — Classify queryMode:
- "data": User wants factual data (counts, lists, filters, search, aggregations). SQL can answer it directly.
- "intelligence": User wants AI reasoning, insights, ideas, suggestions, analysis, recommendations, or creative output based on their data.

Step 2 — Pick relevant data contexts:
- my_activities: Activities list — search, filter, count, analyze activities
- specific_activity: Single activity — details, notes, media for one activity
- tags_breakdown: Tags — tag usage, distribution, counts per tag
- activity_timeline: Timeline — trends, patterns, time-based analysis
- notes_search: Notes — search across activity notes

Return JSON: {"queryMode":"data|intelligence","suggestions":[{"contextId":"...","relevance":0.0-1.0,"reason":"Short explanation"}]}
Only include contexts from: ${JSON.stringify(availableContextIds)}
Order by relevance descending. Include 1-3 most relevant.`;

    try {
      const response = await this.client.responses.create({
        model: "gpt-5-mini",
        instructions: sysPrompt,
        input: `${userQuery}\n\nRespond in json.`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 1000,
        store: false,
      });
      const content = response.output_text ?? "";
      captureLlmDebug("gpt-5-mini", sysPrompt, userQuery, content, response.status);
      if (!content.trim()) throw new Error("Empty LLM response");
      const parsed = JSON.parse(content) as ContextAnalysisResult;
      if (!parsed.queryMode) parsed.queryMode = "data";
      return parsed;
    } catch {
      return {
        queryMode: "data",
        suggestions: availableContextIds.map((id) => ({
          contextId: id,
          relevance: 0.5,
          reason: "Default suggestion",
        })),
      };
    }
  }

  async generateContextualDynamicSQL(
    userQuery: string,
    contextBaseSQL: string,
    contextColumns: string[],
    contextParamNotes: string,
    allowedOps: string[]
  ): Promise<ContextualSQLResult> {
    const sysPrompt = `Generate a PostgreSQL SELECT query by modifying the base query below to answer the user's question.

BASE QUERY (use as starting point — you may add WHERE, ORDER BY, HAVING, aggregate, LIMIT):
${contextBaseSQL}

Available columns: ${contextColumns.join(", ")}
Allowed operations: ${allowedOps.join(", ")}
Parameter notes: ${contextParamNotes}

Rules:
- ONLY SELECT. Never INSERT/UPDATE/DELETE/DROP/ALTER.
- Keep the $1 tenant_id parameter.
- You may wrap the base query in a CTE or add clauses to it.
- LIMIT 100 max.
- Return JSON: {"sql":"SELECT ...","description":"What this shows","outputColumns":["col1","col2"],"suggestedWidgetType":"data_list|chart|stats_card|text_response","chartType":"bar|line|area|pie|donut"}
- Use "chart" for time-series / aggregates, "stats_card" for single-value counts, "data_list" for row listings, "text_response" for simple answers.
- If suggestedWidgetType is "chart", also include "chartType": use "line" for time-series, "bar" for categorical comparisons, "pie" for proportions/distributions, "area" for cumulative trends. Omit chartType for non-chart widgets.`;

    try {
      const response = await this.client.responses.create({
        model: "gpt-5-mini",
        instructions: sysPrompt,
        input: `${userQuery}\n\nRespond in json.`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 1000,
        store: false,
      });
      const raw = response.output_text ?? "";
      captureLlmDebug("gpt-5-mini", sysPrompt, userQuery, raw, response.status);
      try {
        return JSON.parse(raw) as ContextualSQLResult;
      } catch {
        return JSON.parse(raw.replace(/\n/g, " ").replace(/\r/g, "")) as ContextualSQLResult;
      }
    } catch (err) {
      logger.error("llm.generateContextualDynamicSQL", "LLM failed", { error: (err as Error).message });
      return {
        sql: contextBaseSQL + " LIMIT 20",
        description: "Showing data from the selected context",
        outputColumns: contextColumns,
        suggestedWidgetType: "data_list",
      };
    }
  }

  async analyzeDataWithContext(
    userQuery: string,
    entityData: Record<string, unknown>,
    entityType: string,
    conversationContext: string[]
  ): Promise<IntelligenceAnalysis> {
    const contextStr = conversationContext.length > 0
      ? `\nRecent conversation:\n${conversationContext.slice(-6).join("\n")}`
      : "";

    const sysPrompt = `You are an intelligent assistant helping a user with their ${entityType} data. The user is asking for insights, analysis, ideas, or recommendations.

Respond in rich markdown. Be specific, actionable, and reference the actual data provided. Use bullet points, bold for emphasis, and headers for sections when appropriate.

At the end, suggest 2-3 natural follow-up questions the user might want to ask.${contextStr}

Return JSON: {"response":"Your markdown response here","followUpSuggestions":["question 1","question 2"]}`;

    const dataStr = JSON.stringify(entityData, null, 2);
    const userInput = `User question: ${userQuery}\n\nData:\n${dataStr.length > 3000 ? dataStr.slice(0, 3000) + "\n..." : dataStr}`;

    try {
      const response = await this.client.responses.create({
        model: "gpt-5-mini",
        instructions: sysPrompt,
        input: `${userInput}\n\nRespond in json.`,
        text: { format: { type: "json_object" } },
        max_output_tokens: 2000,
        store: false,
      });
      const content = response.output_text ?? "";
      captureLlmDebug("gpt-5-mini", sysPrompt, userInput, content, response.status);
      return JSON.parse(content) as IntelligenceAnalysis;
    } catch (err) {
      logger.error("llm.analyzeDataWithContext", "LLM failed", { error: (err as Error).message });
      return {
        response: "I wasn't able to analyze this data right now. Please try again.",
        followUpSuggestions: [],
      };
    }
  }
}

function deriveShortTitle(raw: string): string {
  if (!raw) return "";
  const firstSentence = raw.split(/[.!?]/)[0]?.trim() ?? raw;
  if (firstSentence.split(/\s+/).length <= 10) return firstSentence;
  const words = firstSentence.split(/\s+/).slice(0, 8);
  return words.join(" ");
}

function formatFallbackDate(val: string): string {
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return val;
  }
}
