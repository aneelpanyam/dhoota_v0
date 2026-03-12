import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { generatePresignedReadUrl } from "@/lib/media/s3";
import { logger } from "@/lib/logging/logger";

export async function GET(request: NextRequest) {
  try {
    await requireSession();

    const key = request.nextUrl.searchParams.get("key");
    if (!key) {
      return NextResponse.json({ error: "Missing key parameter" }, { status: 400 });
    }

    const url = await generatePresignedReadUrl(key);
    return NextResponse.redirect(url, 302);
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to serve media" }, { status: 500 });
  }
}
