import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createServiceSupabase();
    const { data: filters, error } = await db
      .from("context_filters")
      .select("id, name, description, icon, entity_type, sort_order")
      .contains("user_types", [session.userType])
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, filters: [] }, { status: 500 });
    }

    // Filter by required_toggles (feature flags) - would need tenant_feature_flags join
    // For now return all; can add toggle check when tenant context is available
    return NextResponse.json({ filters: filters ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal error", filters: [] }, { status: 500 });
  }
}
