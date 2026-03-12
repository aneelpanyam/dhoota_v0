import type { OptionSummary } from "@/types/options";

export interface IntentClassification {
  optionId: string | null;
  confidence: number;
  extractedParams: Record<string, unknown>;
}

export interface RefinementContext {
  tenantId: string;
  recentActivityTitles?: string[];
  availableTags?: { name: string; slug: string }[];
  refinementPrompt?: string;
}

export interface RefinedInput {
  params: Record<string, unknown>;
  suggestions: {
    tags?: { name: string; confidence: number }[];
    inferred?: Record<string, unknown>;
  };
  refinementNotes: string[];
  displaySummary: Record<string, string>;
}

export interface QuestionItem {
  questionText: string;
  questionKey: string;
  inlineWidget: string | null;
  widgetConfig: Record<string, unknown>;
  isRequired?: boolean;
}

export interface QuestionGroup {
  keys: string[];
  questions: QuestionItem[];
}

export interface ActivitySummary {
  enhancedTitle: string;
  enhancedDescription: string;
  highlights: string[];
}

// Kept for backward compatibility but no longer used in main pipeline
export interface FormatContext {
  userDisplayName: string;
  responsePrompt: string;
  followUpOptionIds: string[];
}

export interface FormattedResponse {
  summary: string;
  widgets: {
    type: string;
    data: Record<string, unknown>;
    actions?: {
      label: string;
      icon: string;
      optionId: string;
      params?: Record<string, unknown>;
      targetResourceId?: string;
      targetResourceType?: string;
    }[];
  }[];
  followUpOptionIds: string[];
}

export interface LLMProvider {
  /** Simple chat: system prompt + user message -> text response. Used by insights path. */
  chat(
    systemPrompt: string,
    userMessage: string
  ): Promise<string>;

  extractParams(
    userText: string,
    targetSchema: Record<string, unknown>
  ): Promise<Record<string, unknown>>;

  refineInput(
    rawParams: Record<string, unknown>,
    targetSchema: Record<string, unknown>,
    context: RefinementContext
  ): Promise<RefinedInput>;

  groupQuestions(
    questions: QuestionItem[],
    knownParams: Record<string, unknown>
  ): Promise<QuestionGroup[]>;

  generateActivitySummary(
    activityData: Record<string, unknown>
  ): Promise<ActivitySummary>;

  // -- Deprecated methods kept for backward compat during transition --

  classifyIntent(
    userText: string,
    availableOptions: OptionSummary[],
    conversationContext: string[]
  ): Promise<IntentClassification>;

  formatResponse(
    results: unknown,
    context: FormatContext
  ): Promise<FormattedResponse>;
}
