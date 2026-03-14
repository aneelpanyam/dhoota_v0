import type { OptionDefinition } from "@/types/options";
import type { QASession, QAResult } from "@/types/pipeline";
import { loadOptionQuestions } from "./loader";

export async function startQASession(
  option: OptionDefinition,
  knownParams: Record<string, unknown>,
  tenantId?: string
): Promise<QAResult> {
  const questions = await loadOptionQuestions(option.id, tenantId);
  if (questions.length === 0) {
    return { status: "complete", collectedParams: knownParams };
  }

  const remaining = questions.filter(
    (q) => !(q.question_key in knownParams) || knownParams[q.question_key] === undefined
  );

  if (remaining.length === 0) {
    return { status: "complete", collectedParams: knownParams };
  }

  const hasPrefilledParams = Object.keys(knownParams).some(
    (k) => knownParams[k] !== undefined && knownParams[k] !== null
  );
  const allRemainingOptional = remaining.every((q) => !q.is_required);
  // Don't skip when remaining includes tag_select - user needs to see the tag selector (e.g. activity.manage_tags)
  const hasTagSelectRemaining = remaining.some((q) => q.inline_widget === "tag_select");
  if (hasPrefilledParams && allRemainingOptional && !hasTagSelectRemaining) {
    return { status: "complete", collectedParams: knownParams };
  }

  const questionData = remaining.map((q) => ({
    questionText: q.question_text,
    questionKey: q.question_key,
    inlineWidget: q.inline_widget,
    widgetConfig: q.widget_config,
    isRequired: q.is_required,
  }));

  return {
    status: "need_more",
    nextQuestions: questionData,
  };
}

export async function continueQASession(
  option: OptionDefinition,
  previousParams: Record<string, unknown>,
  newAnswers: Record<string, unknown>,
  tenantId?: string
): Promise<QAResult> {
  const merged = { ...previousParams, ...newAnswers };

  if (merged.__skip_optional) {
    return { status: "complete", collectedParams: merged };
  }

  const questions = await loadOptionQuestions(option.id, tenantId);

  const isAnswered = (key: string) =>
    key in merged && merged[key] !== undefined;

  const remaining = questions.filter((q) => !isAnswered(q.question_key));

  if (remaining.length === 0) {
    return { status: "complete", collectedParams: merged };
  }

  const questionData = remaining.map((q) => ({
    questionText: q.question_text,
    questionKey: q.question_key,
    inlineWidget: q.inline_widget,
    widgetConfig: q.widget_config,
    isRequired: q.is_required,
  }));

  return {
    status: "need_more",
    nextQuestions: questionData,
    collectedParams: merged,
  };
}

export function buildQASessionState(
  optionId: string,
  answeredParams: Record<string, unknown>,
  currentQuestionKeys: string[]
): QASession {
  return {
    optionId,
    answeredParams,
    remainingKeys: [],
    currentQuestionKeys,
  };
}
