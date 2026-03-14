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
    tenantParam?: string;
    userScoped?: boolean;
    userParam?: string;
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
  tenant_users: {
    table: "users",
    select: "id, display_name, email",
    valueField: "id",
    labelField: "display_name",
    tenantScoped: true,
    filters: { deleted_at: null },
    tenantParam: "tenantId",
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
  tags: {
    table: "tags",
    select: "id, name, color",
    valueField: "name",
    labelField: "name",
    tenantScoped: true,
    filters: { is_hidden: false },
  },
  welcome_messages: {
    table: "public_site_welcome_messages",
    select: "id, message_text",
    valueField: "id",
    labelField: "message_text",
    tenantScoped: true,
    tenantParam: "tenantId",
    userScoped: true,
    userParam: "userId",
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

    const tenantIdParam = config.tenantParam
      ? request.nextUrl.searchParams.get(config.tenantParam)
      : null;
    const effectiveTenantId = tenantIdParam ?? session?.tenantId ?? null;
    const userIdParam = config.userParam
      ? request.nextUrl.searchParams.get(config.userParam)
      : null;
    const effectiveUserId = userIdParam ?? session?.id ?? null;

    let query = db.from(config.table).select(config.select);

    if (source === "tags" && effectiveTenantId) {
      query = query.or(`tenant_id.eq.${effectiveTenantId},tenant_id.is.null`);
    } else if (config.tenantScoped && effectiveTenantId) {
      query = query.eq("tenant_id", effectiveTenantId);
    }
    if (config.userScoped && effectiveUserId) {
      query = query.eq("user_id", effectiveUserId);
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

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const options = rows.map((row) => ({
      value: String(row[config.valueField] ?? ""),
      label: String(row[config.labelField] ?? ""),
    }));

    return NextResponse.json({ options });
  } catch {
    return NextResponse.json({ error: "Internal error", options: [] }, { status: 500 });
  }
}
