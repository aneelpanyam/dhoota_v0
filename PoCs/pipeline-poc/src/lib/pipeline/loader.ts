import { createServiceSupabase } from "@/lib/supabase/server";
import type { OptionDefinition, SqlTemplate, OptionQuestion, UserTypeConfig } from "@/types/options";
import type { ReportDefinition, ReportTemplate } from "@/types/pipeline";

export async function loadOptionDefinitions(optionIds?: string[]): Promise<OptionDefinition[]> {
  const db = createServiceSupabase();
  let query = db.from("option_definitions").select("*").eq("is_active", true);

  if (optionIds && optionIds.length > 0) {
    query = query.in("id", optionIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function loadSqlTemplates(optionId: string): Promise<SqlTemplate[]> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("sql_templates")
    .select("*")
    .eq("option_id", optionId)
    .order("execution_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function loadOptionQuestions(
  optionId: string,
  tenantId?: string
): Promise<OptionQuestion[]> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("option_questions")
    .select("*")
    .eq("option_id", optionId)
    .order("question_order", { ascending: true });

  if (error) throw error;
  const questions = (data ?? []) as OptionQuestion[];

  if (!tenantId || questions.length === 0) return questions;

  const overrides = await loadTenantQuestionOverrides(tenantId, questions.map((q) => q.id));
  if (overrides.length === 0) return questions;

  const overrideMap = new Map(overrides.map((o) => [o.question_id, o]));

  return questions.map((q) => {
    const ov = overrideMap.get(q.id);
    if (!ov) return q;
    return {
      ...q,
      question_text: ov.question_text_override ?? q.question_text,
      widget_config: ov.widget_config_override ?? q.widget_config,
      is_required: ov.is_required_override ?? q.is_required,
    };
  });
}

interface TenantQuestionOverride {
  question_id: string;
  question_text_override: string | null;
  widget_config_override: Record<string, unknown> | null;
  is_required_override: boolean | null;
}

async function loadTenantQuestionOverrides(
  tenantId: string,
  questionIds: string[]
): Promise<TenantQuestionOverride[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("tenant_question_overrides")
    .select("question_id, question_text_override, widget_config_override, is_required_override")
    .eq("tenant_id", tenantId)
    .in("question_id", questionIds);

  return (data ?? []) as TenantQuestionOverride[];
}

export async function loadUserTypeConfig(userType: string): Promise<UserTypeConfig | null> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("user_type_configs")
    .select("*")
    .eq("user_type", userType)
    .single();

  if (error) return null;
  return data;
}

export async function loadUserConfig(userId: string): Promise<{
  init_option_ids?: string[];
  default_option_ids?: string[];
  available_option_ids?: string[];
  theme_config?: Record<string, unknown>;
} | null> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("user_configs")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) return null;
  return data;
}

export async function loadReportDefinitions(
  filterId?: string,
  userType?: string
): Promise<ReportDefinition[]> {
  const db = createServiceSupabase();
  let query = db.from("report_definitions").select("*").order("sort_order", { ascending: true });

  if (filterId) {
    query = query.eq("filter_id", filterId);
  }
  if (userType) {
    query = query.contains("user_types", [userType]);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ReportDefinition[];
}

export async function loadReportTemplates(reportId: string): Promise<ReportTemplate[]> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("report_templates")
    .select("*")
    .eq("report_id", reportId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ReportTemplate[];
}

export async function loadAvailableTags(tenantId: string): Promise<{ name: string; slug: string }[]> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("tags")
    .select("name, slug")
    .or(`tenant_id.eq.${tenantId},tenant_id.is.null`)
    .eq("is_hidden", false);

  if (error) return [];
  return data ?? [];
}
