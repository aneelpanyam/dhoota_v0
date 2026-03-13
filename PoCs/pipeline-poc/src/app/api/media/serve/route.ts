import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { isPublicMode } from "@/lib/auth/public-mode";
import { generatePresignedReadUrl } from "@/lib/media/s3";
import { createServiceSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    if (isPublicMode()) {
      const db = createServiceSupabase();
      const { data: media } = await db
        .from("activity_media")
        .select("activity_id")
        .eq("s3_key", key)
        .single();

      if (media?.activity_id) {
        const { data: activity } = await db
          .from("activities")
          .select("id")
          .eq("id", media.activity_id)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .single();

        if (activity) {
          const url = await generatePresignedReadUrl(key);
          return NextResponse.redirect(url, 302);
        }
      }
    }

    await requireSession();
    const url = await generatePresignedReadUrl(key);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 });
  }
}
