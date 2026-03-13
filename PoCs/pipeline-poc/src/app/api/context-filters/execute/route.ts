import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/server";

interface ContextItem {
  entityType: string;
  entityId: string;
  label: string;
  summary: string;
  viewAction?: { optionId: string; params: Record<string, unknown> };
}

function mapFilterParams(
  paramMapping: Record<string, string>,
  context: { tenantId: string; userId: string },
  params?: Record<string, unknown>
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
    } else if (path.startsWith("params.") && params) {
      const key = path.replace("params.", "");
      result.push(params[key] ?? null);
    } else {
      result.push(null);
    }
  }
  return result;
}

function rowToContextItem(
  row: Record<string, unknown>,
  filter: { entity_type: string; view_option_id: string | null; view_param_key: string | null }
): ContextItem {
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

  let viewAction: ContextItem["viewAction"];
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

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const filterId = body.filterId as string | undefined;
    const params = body.params as Record<string, unknown> | undefined;

    if (!filterId) {
      return NextResponse.json({ error: "filterId required", items: [] }, { status: 400 });
    }

    const db = createServiceSupabase();
    const { data: filter, error: filterError } = await db
      .from("context_filters")
      .select("id, name, sql, param_mapping, entity_type, view_option_id, view_param_key")
      .eq("id", filterId)
      .contains("user_types", [session.userType])
      .single();

    if (filterError || !filter) {
      return NextResponse.json({ error: "Filter not found", items: [] }, { status: 404 });
    }

    const paramMapping = (filter.param_mapping as Record<string, string>) ?? {};
    const sqlParams = mapFilterParams(
      paramMapping,
      { tenantId: session.tenantId, userId: session.id },
      params
    );

    const { data, error } = await db.rpc("exec_sql", {
      query_text: filter.sql,
      query_params: sqlParams,
    });

    if (error) {
      return NextResponse.json({ error: error.message, items: [] }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : data ? [data] : [];
    const items: ContextItem[] = rows.map((row: Record<string, unknown>) =>
      rowToContextItem(row, filter)
    );

    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message ?? "Internal error", items: [] },
      { status: 500 }
    );
  }
}
