import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/server";

const addSchema = z.object({
  entityType: z.string().max(50),
  entityId: z.string().uuid(),
  label: z.string().max(200).optional(),
});

const removeSchema = z.object({
  entityType: z.string().max(50),
  entityId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const entityType = request.nextUrl.searchParams.get("entityType");
    const db = createServiceSupabase();

    let query = db
      .from("bookmarks")
      .select("id, entity_type, entity_id, label, created_at")
      .eq("user_id", session.id)
      .eq("tenant_id", session.tenantId)
      .order("created_at", { ascending: false });

    if (entityType) {
      query = query.eq("entity_type", entityType);
    }

    const { data, error } = await query.limit(200);

    if (error) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookmarks: data ?? [] });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const input = addSchema.parse(body);
    const db = createServiceSupabase();

    const { data, error } = await db
      .from("bookmarks")
      .upsert(
        {
          tenant_id: session.tenantId,
          user_id: session.id,
          entity_type: input.entityType,
          entity_id: input.entityId,
          label: input.label ?? null,
        },
        { onConflict: "user_id,entity_type,entity_id" }
      )
      .select("id")
      .single();

    if (error) {
      return NextResponse.json(
        { error: { code: "DB_ERROR", message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookmarkId: data.id });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.errors } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const input = removeSchema.parse(body);
    const db = createServiceSupabase();

    await db
      .from("bookmarks")
      .delete()
      .eq("user_id", session.id)
      .eq("entity_type", input.entityType)
      .eq("entity_id", input.entityId);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.errors } },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
