import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPublicMode } from "@/lib/auth/public-mode";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const userType = isPublicMode() ? "citizen" : (await getSession())?.userType;
    if (!userType) {
      return NextResponse.json({ error: "Unauthorized", filters: [] }, { status: 401 });
    }

    const db = createServiceSupabase();
    const { data: filters, error } = await db
      .from("context_filters")
      .select("id, name, description, icon, entity_type, sort_order")
      .contains("user_types", [userType])
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, filters: [] }, { status: 500 });
    }

    return NextResponse.json({ filters: filters ?? [] });
  } catch {
    return NextResponse.json({ error: "Internal error", filters: [] }, { status: 500 });
  }
}
