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

export interface FormatContext {
  userDisplayName: string;
  responsePrompt: string;
  followUpOptionIds: string[];
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

export interface DynamicSQLResult {
  sql: string;
  description: string;
}

export interface ContextAnalysisResult {
  queryMode: "data" | "intelligence";
  suggestions: {
    contextId: string;
    relevance: number;
    reason: string;
  }[];
}

export interface IntelligenceAnalysis {
  response: string;
  followUpSuggestions?: string[];
}

export interface ContextualSQLResult {
  sql: string;
  description: string;
  outputColumns: string[];
  suggestedWidgetType: "data_list" | "chart" | "stats_card" | "text_response";
  chartType?: "bar" | "line" | "area" | "pie" | "donut";
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

export interface LLMProvider {
  classifyIntent(
    userText: string,
    availableOptions: OptionSummary[],
    conversationContext: string[]
  ): Promise<IntentClassification>;

  extractParams(
    userText: string,
    targetSchema: Record<string, unknown>
  ): Promise<Record<string, unknown>>;

  refineInput(
    rawParams: Record<string, unknown>,
    targetSchema: Record<string, unknown>,
    context: RefinementContext
  ): Promise<RefinedInput>;

  formatResponse(
    results: unknown,
    context: FormatContext
  ): Promise<FormattedResponse>;

  generateDynamicSQL(
    userIntent: string,
    tableSchemas: string
  ): Promise<DynamicSQLResult>;

  groupQuestions(
    questions: QuestionItem[],
    knownParams: Record<string, unknown>
  ): Promise<QuestionGroup[]>;

  generateActivitySummary(
    activityData: Record<string, unknown>
  ): Promise<ActivitySummary>;

  analyzeQueryContexts(
    userQuery: string,
    availableContextIds: string[]
  ): Promise<ContextAnalysisResult>;

  generateContextualDynamicSQL(
    userQuery: string,
    contextBaseSQL: string,
    contextColumns: string[],
    contextParamNotes: string,
    allowedOps: string[]
  ): Promise<ContextualSQLResult>;

  analyzeDataWithContext(
    userQuery: string,
    entityData: Record<string, unknown>,
    entityType: string,
    conversationContext: string[]
  ): Promise<IntelligenceAnalysis>;
}

export interface ActivitySummary {
  enhancedTitle: string;
  enhancedDescription: string;
  highlights: string[];
}
