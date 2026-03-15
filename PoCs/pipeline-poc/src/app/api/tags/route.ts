import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

const DEFAULT_TAG_COLORS = [
  "#3B82F6", "#F59E0B", "#EF4444", "#8B5CF6", "#10B981",
  "#F97316", "#6366F1", "#EC4899", "#14B8A6", "#84CC16",
];

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    const color =
      typeof body?.color === "string" && body.color.trim()
        ? body.color.trim()
        : DEFAULT_TAG_COLORS[Math.floor(Math.random() * DEFAULT_TAG_COLORS.length)];

    const baseSlug = slugify(name) || "tag";
    let slug = baseSlug;
    let suffix = 1;

    const db = createServiceSupabase();

    // Ensure unique slug within tenant (tenant_id or NULL for system)
    while (true) {
      const { data: existing } = await db
        .from("tags")
        .select("id")
        .eq("tenant_id", session.tenantId)
        .eq("slug", slug)
        .maybeSingle();

      if (!existing) break;
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const { data: tag, error } = await db
      .from("tags")
      .insert({
        tenant_id: session.tenantId,
        name,
        slug,
        color,
        source: "custom",
      })
      .select("id, name, slug, color")
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message, tag: null },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tag: { id: tag.id, name: tag.name, slug: tag.slug, color: tag.color },
      option: { value: tag.name, label: tag.name },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal error", tag: null },
      { status: 500 }
    );
  }
}
