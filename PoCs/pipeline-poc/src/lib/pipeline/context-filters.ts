import type { UserContext } from "@/types/pipeline";
import { createServiceSupabase } from "@/lib/supabase/server";

export interface InsightContextItem {
  entityType: string;
  entityId: string;
  label: string;
  summary: string;
  viewAction?: { optionId: string; params: Record<string, unknown> };
}

function mapFilterParams(
  paramMapping: Record<string, string>,
  context: { tenantId: string; userId: string }
): unknown[] {
  const maxParam = Math.max(
    ...Object.keys(paramMapping).map((k) => parseInt(k.replace("$", ""), 10)),
    0
  );
  const result: unknown[] = [];
  for (let i = 1; i <= maxParam; i++) {
    const path = paramMapping[`$${i}`];
    if (!path) {
      result.push(null);
      continue;
    }
    if (path.startsWith("context.")) {
      const key = path.replace("context.", "");
      result.push(key === "tenantId" ? context.tenantId : context.userId);
    } else {
      result.push(null);
    }
  }
  return result;
}

function rowToContextItem(
  row: Record<string, unknown>,
  filter: { entity_type: string; view_option_id: string | null; view_param_key: string | null }
): InsightContextItem {
  const id = row.id as string;
  const aiSummary = row.ai_summary as Record<string, unknown> | null;
  const label =
    (aiSummary?.enhancedTitle as string) ??
    (row.title as string) ??
    (row.name as string) ??
    (row.email as string) ??
    String(id).slice(0, 8);
  const summary =
    (aiSummary?.enhancedDescription as string) ??
    (row.description as string) ??
    (row.content as string) ??
    "";

  let viewAction: InsightContextItem["viewAction"];
  if (filter.view_option_id && filter.view_param_key) {
    const paramKey = filter.view_param_key;
    const paramVal = row[paramKey] ?? row.id;
    if (paramVal) {
      viewAction = { optionId: filter.view_option_id, params: { [paramKey]: paramVal } };
    }
  }

  return {
    entityType: filter.entity_type,
    entityId: id,
    label,
    summary: summary || label,
    viewAction,
  };
}

export async function runFilterAndGetContextItems(
  filterId: string,
  context: UserContext
): Promise<InsightContextItem[]> {
  const db = createServiceSupabase();
  const { data: filter, error: filterError } = await db
    .from("context_filters")
    .select("id, name, sql, param_mapping, entity_type, view_option_id, view_param_key")
    .eq("id", filterId)
    .contains("user_types", [context.userType])
    .single();

  if (filterError || !filter) {
    return [];
  }

  const paramMapping = (filter.param_mapping as Record<string, string>) ?? {};
  const sqlParams = mapFilterParams(paramMapping, {
    tenantId: context.tenantId,
    userId: context.userId,
  });

  const { data, error } = await db.rpc("exec_sql", {
    query_text: filter.sql,
    query_params: sqlParams,
  });

  if (error) {
    throw new Error(`Filter execution failed: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : data ? [data] : [];
  return rows.map((row: Record<string, unknown>) => rowToContextItem(row, filter));
}
