import type { OptionDefinition, SqlTemplate } from "./options";

export interface UserContext {
  tenantId: string;
  userId: string;
  userType: string;
  displayName: string;
  scopedUserId?: string;
  availableOptions: OptionDefinition[];
  defaultOptions: OptionDefinition[];
  initOptionIds: string[];
  conversationId: string;
  recentMessages: ConversationMessage[];
}

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string | null;
  optionId?: string | null;
  inputParams?: Record<string, unknown>;
  createdAt: string;
}

export interface ResolvedOption {
  type: "predefined";
  option?: OptionDefinition;
  extractedParams?: Record<string, unknown>;
  confidence: number;
  needsMoreInput?: boolean;
}

export interface QASession {
  optionId: string;
  answeredParams: Record<string, unknown>;
  remainingKeys: string[];
  currentQuestionKeys: string[];
}

export interface QAResult {
  status: "need_more" | "complete";
  nextQuestions?: {
    questionText: string;
    questionKey: string;
    inlineWidget: string | null;
    widgetConfig: Record<string, unknown>;
    isRequired?: boolean;
  }[];
  collectedParams?: Record<string, unknown>;
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

export interface SqlResult {
  templateName: string;
  rows: Record<string, unknown>[];
  rowCount: number;
  queryType: "read" | "write";
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
      paramKey?: string;
      params?: Record<string, unknown>;
      targetResourceId?: string;
      targetResourceType?: string;
      requiresConfirmation?: boolean;
    }[];
  }[];
  followUpOptionIds: string[];
}

export interface PipelineResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ReportDefinition {
  id: string;
  filter_id: string;
  name: string;
  description: string | null;
  user_types: string[];
  required_toggles: string[];
  sort_order: number;
}

export interface ReportTemplate {
  id: string;
  report_id: string;
  name: string;
  sql: string;
  param_mapping: Record<string, string>;
  chart_type: string;
  chart_title: string;
  label_column: string | null;
  value_columns: string[];
  sort_order: number;
}
