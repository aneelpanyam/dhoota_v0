import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET() {
  try {
    const session = await requireSession();
    const db = createServiceSupabase();

    const { data, error } = await db
      .from("conversations")
      .select("id, title, context, updated_at, created_at")
      .eq("tenant_id", session.tenantId)
      .eq("user_id", session.id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error fetching conversations:", error);
      return NextResponse.json({ conversations: [] });
    }

    return NextResponse.json({ conversations: data ?? [] });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
    console.error("Conversations list error:", err);
    return NextResponse.json({ conversations: [] });
  }
}
