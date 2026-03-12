import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/server";

const SOURCE_QUERIES: Record<
  string,
  {
    table: string;
    select: string;
    valueField: string;
    labelField: string;
    tenantScoped?: boolean;
    filters?: Record<string, unknown>;
  }
> = {
  tenants: {
    table: "tenants",
    select: "id, name",
    valueField: "id",
    labelField: "name",
  },
  users: {
    table: "users",
    select: "id, display_name, email",
    valueField: "id",
    labelField: "display_name",
    filters: { deleted_at: null },
  },
  citizen_groups: {
    table: "citizen_groups",
    select: "id, name",
    valueField: "id",
    labelField: "name",
    tenantScoped: true,
    filters: { deleted_at: null },
  },
  suggestion_boxes: {
    table: "suggestion_boxes",
    select: "id, title",
    valueField: "id",
    labelField: "title",
    tenantScoped: true,
    filters: { deleted_at: null },
  },
  option_definitions: {
    table: "option_definitions",
    select: "id, name, category",
    valueField: "id",
    labelField: "name",
  },
  programs: {
    table: "programs",
    select: "id, name",
    valueField: "id",
    labelField: "name",
    tenantScoped: true,
  },
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const source = request.nextUrl.searchParams.get("source");
    if (!source || !SOURCE_QUERIES[source]) {
      return NextResponse.json(
        { error: `Unknown source: ${source}`, options: [] },
        { status: 400 }
      );
    }

    const config = SOURCE_QUERIES[source];
    const db = createServiceSupabase();

    let query = db.from(config.table).select(config.select);

    if (config.tenantScoped && session.tenantId) {
      query = query.eq("tenant_id", session.tenantId);
    }
    if (config.filters) {
      for (const [key, val] of Object.entries(config.filters)) {
        if (val === null) {
          query = query.is(key, null);
        } else {
          query = query.eq(key, val);
        }
      }
    }

    query = query.order(config.labelField, { ascending: true }).limit(200);
    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message, options: [] }, { status: 500 });
    }

    const options = (data ?? []).map((row: Record<string, unknown>) => ({
      value: String(row[config.valueField] ?? ""),
      label: String(row[config.labelField] ?? ""),
    }));

    return NextResponse.json({ options });
  } catch {
    return NextResponse.json({ error: "Internal error", options: [] }, { status: 500 });
  }
}
