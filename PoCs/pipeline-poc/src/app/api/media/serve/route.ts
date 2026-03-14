import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { isPublicMode } from "@/lib/auth/public-mode";
import { generatePresignedReadUrl, getObjectStream } from "@/lib/media/s3";
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
        .select("activity_id, mime_type")
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
          const stream = await getObjectStream(key);
          if (stream) {
            const headers: Record<string, string> = {
              "Content-Type": (media.mime_type as string) ?? stream.contentType,
              "Cache-Control": "public, max-age=3600",
            };
            if (stream.contentLength != null) {
              headers["Content-Length"] = String(stream.contentLength);
            }
            return new NextResponse(stream.body, { status: 200, headers });
          }
          const url = await generatePresignedReadUrl(key);
          return NextResponse.redirect(url, 302);
        }
      }

      // Avatar: allow serving if key matches users.avatar_url for a representative with public site
      const { data: avatarUser } = await db
        .from("users")
        .select("id")
        .eq("avatar_url", key)
        .not("avatar_url", "is", null)
        .single();

      if (avatarUser) {
        const { data: hasPublicSite } = await db
          .from("public_site_configs")
          .select("user_id")
          .eq("user_id", avatarUser.id)
          .limit(1)
          .single();

        if (hasPublicSite) {
          const stream = await getObjectStream(key);
          if (stream) {
            const headers: Record<string, string> = {
              "Content-Type": (stream.contentType as string) ?? "image/jpeg",
              "Cache-Control": "public, max-age=3600",
            };
            if (stream.contentLength != null) {
              headers["Content-Length"] = String(stream.contentLength);
            }
            return new NextResponse(stream.body, { status: 200, headers });
          }
          const url = await generatePresignedReadUrl(key);
          return NextResponse.redirect(url, 302);
        }
      }

      // Banner: allow serving if key matches public_site_welcome_messages.banner_url
      const { data: bannerRow } = await db
        .from("public_site_welcome_messages")
        .select("id")
        .eq("banner_url", key)
        .not("banner_url", "is", null)
        .limit(1)
        .single();

      if (bannerRow) {
        const stream = await getObjectStream(key);
        if (stream) {
          const headers: Record<string, string> = {
            "Content-Type": (stream.contentType as string) ?? "image/jpeg",
            "Cache-Control": "public, max-age=3600",
          };
          if (stream.contentLength != null) {
            headers["Content-Length"] = String(stream.contentLength);
          }
          return new NextResponse(stream.body, { status: 200, headers });
        }
        const url = await generatePresignedReadUrl(key);
        return NextResponse.redirect(url, 302);
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
