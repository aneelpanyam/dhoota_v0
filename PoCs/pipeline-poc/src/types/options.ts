export interface OptionDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string | null;
  keywords: string[];
  user_types: string[];
  required_toggles: string[];
  show_in_defaults: boolean;
  default_priority: number;
  accepts_files: boolean;
  input_schema: Record<string, unknown> | null;
  summary_prompt: string;
  refinement_prompt: string | null;
  follow_up_option_ids: string[];
  child_item_option_ids?: string[];  // options that operate on each displayed item; empty = none
  is_active: boolean;
  metadata: Record<string, unknown>;
  tenant_id?: string | null;
  target_widget: string | null;
  requires_confirmation: boolean;
  skip_refinement: boolean;
  entity_type: string | null;
  has_writes?: boolean;
  loading_message?: string | null;
  list_summary_template?: string | null;
  pinnable_items?: boolean;
  pinnable_collection?: boolean;
  handler_id?: string | null;
}

export interface SqlTemplate {
  id: string;
  option_id: string;
  name: string;
  sql: string;
  param_mapping: Record<string, string>;
  execution_order: number;
  query_type: "read" | "write";
  metadata: Record<string, unknown>;
}

export type InlineWidgetType =
  | "date_picker"
  | "file_upload"
  | "tag_select"
  | "location_picker"
  | "status_select"
  | "visibility_select"
  | "color_picker"
  | "select"
  | "multi_select"
  | "table"
  | "list"
  | "markdown_editor"
  | "theme_editor";

export interface OptionQuestion {
  id: string;
  option_id: string;
  question_text: string;
  question_key: string;
  question_order: number;
  is_required: boolean;
  inline_widget: InlineWidgetType | null;
  widget_config: Record<string, unknown>;
  groupable: boolean;
  metadata: Record<string, unknown>;
}

export interface UserTypeConfig {
  id: string;
  user_type: string;
  init_option_ids: string[];
  default_option_ids: string[];
  available_option_ids: string[];
  theme_config: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface OptionSummary {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  category: string;
}
