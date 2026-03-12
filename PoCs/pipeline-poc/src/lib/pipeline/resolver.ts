import type { OptionDefinition } from "@/types/options";
import type { ResolvedOption } from "@/types/pipeline";
import type { SendMessageRequest } from "@/types/api";
import type { UserContext } from "@/types/pipeline";
import { loadOptionDefinitions } from "./loader";

export async function resolveOption(
  request: SendMessageRequest,
  context: UserContext
): Promise<ResolvedOption> {
  if (request.optionId) {
    return resolveDirectOption(request.optionId, context, request.params);
  }

  if (request.source === "chat" && request.content) {
    return resolveFromText(request.content, context);
  }

  return { type: "predefined", confidence: 0, needsMoreInput: false };
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

/**
 * Free text input now only resolves via keyword matching (no LLM).
 * If no match is found, returns an error (no dynamic query fallback).
 */
function resolveFromText(
  text: string,
  context: UserContext
): ResolvedOption {
  const normalized = text.toLowerCase().trim();

  let bestMatch: { option: OptionDefinition; score: number } | null = null;

  for (const option of context.availableOptions) {
    let score = 0;

    for (const kw of option.keywords) {
      if (normalized.includes(kw.toLowerCase())) {
        score += kw.length;
      }
    }

    if (normalized.includes(option.name.toLowerCase())) {
      score += option.name.length * 2;
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { option, score };
    }
  }

  if (bestMatch) {
    return {
      type: "predefined",
      option: bestMatch.option,
      extractedParams: {},
      confidence: Math.min(bestMatch.score / 20, 1.0),
      needsMoreInput: hasRequiredMissingParams(bestMatch.option, {}),
    };
  }

  return { type: "predefined", confidence: 0, needsMoreInput: false };
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
