import type { OptionDefinition } from "@/types/options";
import type { RefinedInput } from "@/types/pipeline";
import { getLLMProvider } from "@/lib/llm/factory";
import { loadAvailableTags } from "./loader";
import { sanitizeUserInput } from "@/lib/llm/guardrails";

export async function refineInput(
  option: OptionDefinition,
  rawParams: Record<string, unknown>,
  tenantId: string
): Promise<RefinedInput> {
  const availableTags = await loadAvailableTags(tenantId);
  const llm = getLLMProvider();
  const schema = option.input_schema ?? {};

  const originalMediaKeys = rawParams.media_keys;
  const originalAvatarKeys = rawParams.avatar_keys;
  const sanitized = sanitizeParams(rawParams);
  const guardrailed = applyGuardrailsToParams(sanitized);

  const refined = await llm.refineInput(guardrailed, schema, {
    tenantId,
    availableTags,
    refinementPrompt: option.refinement_prompt ?? undefined,
  });

  if (originalMediaKeys && Array.isArray(originalMediaKeys) && originalMediaKeys.length > 0) {
    refined.params.media_keys = originalMediaKeys;
  }
  if (originalAvatarKeys && Array.isArray(originalAvatarKeys) && originalAvatarKeys.length > 0) {
    refined.params.avatar_keys = originalAvatarKeys;
  }
  const originalBannerKeys = rawParams.banner_keys;
  if (originalBannerKeys && Array.isArray(originalBannerKeys) && originalBannerKeys.length > 0) {
    refined.params.banner_keys = originalBannerKeys;
  }

  // Preserve user-provided tags in params alongside LLM suggestions
  const userTags = rawParams.tags;
  if (userTags && Array.isArray(userTags) && userTags.length > 0) {
    refined.params.tags = userTags;
  }

  // Preserve table/list outputs (participants, users, activities array, etc.) - they come from structured widgets
  for (const key of ["users", "participants", "activities"] as const) {
    const arr = rawParams[key];
    if (arr && Array.isArray(arr) && arr.length > 0) {
      refined.params[key] = arr;
    }
  }

  // Add suggested tags to displaySummary if present
  const sugTags = refined.suggestions?.tags;
  if (sugTags && Array.isArray(sugTags) && sugTags.length > 0) {
    const tagNames = sugTags
      .map((t) => (typeof t === "string" ? t : t?.name))
      .filter(Boolean);
    if (tagNames.length > 0 && !refined.displaySummary.Tags) {
      refined.displaySummary.Tags = tagNames.join(", ");
    }
  }

  sanitizeDisplaySummary(refined.displaySummary);

  return refined;
}

function applyGuardrailsToParams(params: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...params };
  const TEXT_KEYS = ["description_raw", "title", "description", "content", "edit_description"];
  for (const key of TEXT_KEYS) {
    const val = cleaned[key];
    if (typeof val === "string") {
      cleaned[key] = sanitizeUserInput(val) || val;
    }
  }
  return cleaned;
}

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...params };

  if (Array.isArray(cleaned.media_keys)) {
    const files = cleaned.media_keys;
    cleaned.media_file_names = files
      .filter((f): f is Record<string, unknown> => f != null && typeof f === "object")
      .map((f) => (f as { originalFilename?: string }).originalFilename ?? "file")
      .join(", ");
    delete cleaned.media_keys;
  }
  if (Array.isArray(cleaned.avatar_keys)) {
    delete cleaned.avatar_keys;
  }
  if (Array.isArray(cleaned.banner_keys)) {
    delete cleaned.banner_keys;
  }

  // Remove table/list outputs before LLM - they are preserved and restored after
  if (Array.isArray(cleaned.participants)) delete cleaned.participants;
  if (Array.isArray(cleaned.users)) delete cleaned.users;
  if (Array.isArray(cleaned.activities)) delete cleaned.activities;

  return cleaned;
}

function sanitizeDisplaySummary(summary: Record<string, string>) {
  for (const [key, val] of Object.entries(summary)) {
    if (typeof val !== "string") {
      summary[key] = String(val);
    }
    if ((summary[key] ?? "").includes("[object Object]")) {
      delete summary[key];
    }
  }
}
