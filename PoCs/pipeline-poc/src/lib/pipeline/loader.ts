import { createServiceSupabase } from "@/lib/supabase/server";
import type { OptionDefinition, SqlTemplate, OptionQuestion, UserTypeConfig } from "@/types/options";

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

export async function loadOptionQuestions(optionId: string): Promise<OptionQuestion[]> {
  const db = createServiceSupabase();
  const { data, error } = await db
    .from("option_questions")
    .select("*")
    .eq("option_id", optionId)
    .order("question_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
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
