import type { OptionDefinition } from "@/types/options";
import type { UserContext, ResolvedOption } from "@/types/pipeline";
import type { SendMessageRequest } from "@/types/api";
import { getLLMProvider } from "@/lib/llm/factory";
import { loadOptionDefinitions } from "./loader";

export async function resolveOption(
  request: SendMessageRequest,
  context: UserContext
): Promise<ResolvedOption> {
  if (
    request.source === "default_option" ||
    request.source === "follow_up" ||
    request.source === "inline_action"
  ) {
    return resolveDirectOption(request.optionId!, context, request.params);
  }

  if (request.source === "chat" && request.content) {
    return resolveFromText(request.content, context);
  }

  throw new Error("Cannot resolve option: no optionId or content provided");
}

async function resolveDirectOption(
  optionId: string,
  context: UserContext,
  prefilledParams?: Record<string, unknown>
): Promise<ResolvedOption> {
  const option = context.availableOptions.find((o) => o.id === optionId);
  if (!option) {
    const [loaded] = await loadOptionDefinitions([optionId]);
    if (!loaded) {
      return { type: "predefined", confidence: 0, needsMoreInput: false };
    }
    return {
      type: "predefined",
      option: loaded,
      extractedParams: prefilledParams ?? {},
      confidence: 1.0,
      needsMoreInput: hasRequiredMissingParams(loaded, prefilledParams ?? {}),
    };
  }

  return {
    type: "predefined",
    option,
    extractedParams: prefilledParams ?? {},
    confidence: 1.0,
    needsMoreInput: hasRequiredMissingParams(option, prefilledParams ?? {}),
  };
}

async function resolveFromText(
  text: string,
  context: UserContext
): Promise<ResolvedOption> {
  const llm = getLLMProvider();

  const optionSummaries = context.availableOptions.map((o) => ({
    id: o.id,
    name: o.name,
    description: o.description,
    keywords: o.keywords,
    category: o.category,
  }));

  const conversationContext = context.recentMessages
    .filter((m) => m.content)
    .map((m) => `${m.role}: ${m.content}`);

  const classification = await llm.classifyIntent(
    text,
    optionSummaries,
    conversationContext
  );

  if (classification.optionId && classification.confidence >= 0.5) {
    const option = context.availableOptions.find(
      (o) => o.id === classification.optionId
    );
    if (option) {
      const allParams = { ...classification.extractedParams };
      return {
        type: "predefined",
        option,
        extractedParams: allParams,
        confidence: classification.confidence,
        needsMoreInput: hasRequiredMissingParams(option, allParams),
      };
    }
  }

  // No predefined option matched — generate dynamic SQL
  return { type: "dynamic", confidence: 0, dynamicSql: undefined };
}

function hasRequiredMissingParams(
  option: OptionDefinition,
  params: Record<string, unknown>
): boolean {
  if (!option.input_schema) return false;
  const schema = option.input_schema as { required?: string[] };
  const required = schema.required ?? [];

  const contextKeys = ["context.tenantId", "context.userId"];
  const missingNonContext = required.filter(
    (key) =>
      !contextKeys.some((ck) => ck.endsWith(key)) &&
      params[key] === undefined &&
      params[key] !== null
  );

  return missingNonContext.length > 0;
}
