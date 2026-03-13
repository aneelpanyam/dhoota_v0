export type MessageSource =
  | "chat"
  | "follow_up"
  | "inline_action"
  | "default_option"
  | "qa_response"
  | "confirmation"
  | "insights";

export interface FileReference {
  s3Key: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
}

export interface SendMessageRequest {
  conversationId: string;
  source: MessageSource;
  content?: string;
  optionId?: string;
  params?: Record<string, unknown>;
  files?: FileReference[];
  targetResourceId?: string;
  targetResourceType?: string;
}

export interface OptionReference {
  optionId: string;
  name: string;
  icon: string;
  description?: string;
  params?: Record<string, unknown>;
}

export interface WidgetAction {
  label: string;
  icon: string;
  optionId: string;
  paramKey?: string;
  params?: Record<string, unknown>;
  targetResourceId?: string;
  targetResourceType?: string;
  requiresConfirmation?: boolean;
}

export interface Widget {
  id: string;
  type: WidgetType;
  data: Record<string, unknown>;
  actions?: WidgetAction[];
  bookmarkable: boolean;
}

export type ConversationState = "active" | "awaiting_input" | "awaiting_confirmation";

export interface ChatMessageResponse {
  messageId: string;
  conversationId: string;
  widgets: Widget[];
  followUps: OptionReference[];
  defaultOptions: OptionReference[];
  conversationState: ConversationState;
  traceId?: string;
  debugTrace?: import("@/lib/pipeline/trace").PipelineTraceData;
}

export interface InitRequest {
  conversationId?: string;
}

export interface InitResponse {
  conversationId: string;
  messages: ChatMessageResponse[];
  userConfig: {
    userType: string;
    theme: Record<string, unknown>;
    displayName: string;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export type WidgetType =
  | "text_response"
  | "activity_card"
  | "data_list"
  | "data_table"
  | "calendar"
  | "timeline"
  | "chart"
  | "stats_card"
  | "stats_grid"
  | "media_gallery"
  | "tag_cloud"
  | "summary"
  | "conversation_thread"
  | "code_list"
  | "website_preview"
  | "status_ticket"
  | "confirmation_card"
  | "question_card"
  | "question_stepper"
  | "default_options_menu"
  | "error_card"
  | "context_picker"
  | "report_view";
