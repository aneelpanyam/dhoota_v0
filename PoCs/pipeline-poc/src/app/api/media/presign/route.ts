import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { generatePresignedUploadUrl } from "@/lib/media/s3";

const presignSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().positive().max(50 * 1024 * 1024),
  context: z.enum(["activity", "note", "profile"]),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const input = presignSchema.parse(body);

    const { uploadUrl, s3Key } = await generatePresignedUploadUrl(
      session.tenantId,
      input.context,
      input.filename,
      input.mimeType
    );

    return NextResponse.json({
      uploadUrl,
      s3Key,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.errors } }, { status: 400 });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to generate upload URL" } }, { status: 500 });
  }
}
