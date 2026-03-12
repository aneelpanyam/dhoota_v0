import OpenAI from "openai";
import type { OptionSummary } from "@/types/options";
import type { LlmCallDebug } from "@/lib/pipeline/trace";
import { logger } from "@/lib/logging/logger";
import { logLlmCall } from "./cost";
import type {
  LLMProvider,
  IntentClassification,
  RefinedInput,
  RefinementContext,
  FormattedResponse,
  FormatContext,
  QuestionGroup,
  ActivitySummary,
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

function trackCost(
  model: string,
  operation: string,
  response: { usage?: { input_tokens?: number; output_tokens?: number } },
  startMs: number,
  success: boolean,
  errorMessage?: string
) {
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  logLlmCall({
    model,
    operation,
    inputTokens,
    outputTokens,
    latencyMs: Date.now() - startMs,
    success,
    errorMessage,
  });
}

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async chat(systemPrompt: string, userMessage: string): Promise<string> {
    const startMs = Date.now();
    try {
      const response = await this.client.responses.create({
        model: "gpt-5-mini",
        instructions: systemPrompt,
        input: userMessage,
        max_output_tokens: 2000,
        store: false,
      });
      const content = response.output_text ?? "";
      captureLlmDebug("gpt-5-mini", systemPrompt, userMessage, content, response.status);
      trackCost("gpt-5-mini", "chat", response, startMs, true);
      return content;
    } catch (error) {
      trackCost("gpt-5-mini", "chat", {}, startMs, false, (error as Error).message);
      logger.error("llm.chat", "Chat call failed", { error: (error as Error).message });
      throw error;
    }
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
    const startMs = Date.now();
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
      trackCost("gpt-5-nano", "classifyIntent", response, startMs, true);
      return JSON.parse(content) as IntentClassification;
    } catch (err) {
      trackCost("gpt-5-nano", "classifyIntent", {}, startMs, false, (err as Error).message);
      return { optionId: null, confidence: 0, extractedParams: {} };
    }
  }

  async extractParams(
    userText: string,
    targetSchema: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const sysPrompt = `Extract structured parameters from the user text based on this schema:\n${JSON.stringify(targetSchema, null, 2)}\n\nReturn JSON with the extracted parameters. Infer values where reasonable (e.g. "today morning" = today's date at 9am, "yesterday" = yesterday). If a field cannot be inferred, omit it.`;
    const startMs = Date.now();
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
      trackCost("gpt-5-nano", "extractParams", response, startMs, true);
      return JSON.parse(content);
    } catch (err) {
      trackCost("gpt-5-nano", "extractParams", {}, startMs, false, (err as Error).message);
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
      const startMs = Date.now();
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
          trackCost("gpt-5-mini", "refineInput", response, startMs, false, "incomplete");
          logger.warn("llm.refineInput", `Attempt ${attempt + 1}/${MAX_ATTEMPTS}: empty/incomplete`, {
            status, details: detail as Record<string, unknown> ?? {},
          });
          if (attempt < MAX_ATTEMPTS - 1) continue;
          return this.buildRefineFallback(rawParams);
        }

        trackCost("gpt-5-mini", "refineInput", response, startMs, true);
        const parsed = JSON.parse(content) as RefinedInput;
        parsed.params = { ...rawParams, ...parsed.params };
        logger.info("llm.refineInput", "LLM success", { title: parsed.params?.title as string });
        return parsed;
      } catch (err) {
        const errObj = err as Record<string, unknown>;
        trackCost("gpt-5-mini", "refineInput", {}, startMs, false, (errObj?.message ?? String(err)) as string);
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
    const startMs = Date.now();
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
      trackCost("gpt-5-nano", "formatResponse", response, startMs, true);
      return JSON.parse(content) as FormattedResponse;
    } catch (err) {
      trackCost("gpt-5-nano", "formatResponse", {}, startMs, false, (err as Error).message);
      return {
        summary: "Here are the results.",
        widgets: [{ type: "text_response", data: { text: JSON.stringify(results, null, 2) } }],
        followUpOptionIds: context.followUpOptionIds,
      };
    }
  }

  async generateActivitySummary(
    activityData: Record<string, unknown>
  ): Promise<ActivitySummary> {
    const sysPrompt = `Generate a display-ready summary for an activity record. Return JSON: {"enhancedTitle":"Professional 5-10 word title","enhancedDescription":"Well-written 1-3 sentence description","highlights":["key point 1"]}. Keep it concise and professional.`;
    const userInput = JSON.stringify(activityData);
    const startMs = Date.now();
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
      trackCost("gpt-5-nano", "generateActivitySummary", response, startMs, true);
      return JSON.parse(content) as ActivitySummary;
    } catch (err) {
      trackCost("gpt-5-nano", "generateActivitySummary", {}, startMs, false, (err as Error).message);
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
