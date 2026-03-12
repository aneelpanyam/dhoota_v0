import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { buildUserContext } from "@/lib/pipeline/context";
import { processMessage } from "@/lib/pipeline";
import { createServiceSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logging/logger";

const messageSchema = z.object({
  conversationId: z.string().uuid(),
  source: z.enum([
    "chat", "follow_up", "inline_action",
    "default_option", "qa_response", "confirmation",
  ]),
  content: z.string().max(5000).optional(),
  optionId: z.string().max(100).optional(),
  params: z.record(z.unknown()).optional(),
  files: z.array(z.object({
    s3Key: z.string(),
    originalFilename: z.string(),
    mimeType: z.string(),
    fileSizeBytes: z.number(),
  })).optional(),
  targetResourceId: z.string().uuid().optional(),
  targetResourceType: z.string().max(50).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json();
    const input = messageSchema.parse(body);

    // Ensure conversation exists
    await ensureConversation(input.conversationId, session.tenantId, session.id);

    // Save user message
    const db = createServiceSupabase();
    await db.from("messages").insert({
      conversation_id: input.conversationId,
      tenant_id: session.tenantId,
      role: "user",
      content: input.content ?? null,
      source: input.source,
      option_id: input.optionId ?? null,
      input_params: input.params ?? null,
    });

    // Build context and process
    const context = await buildUserContext(session, input.conversationId);
    const startTime = Date.now();
    const response = await processMessage(input, context);
    const executionMs = Date.now() - startTime;

    // Save assistant message
    await db.from("messages").insert({
      id: response.messageId,
      conversation_id: input.conversationId,
      tenant_id: session.tenantId,
      role: "assistant",
      content: response.widgets.find((w) => w.type === "text_response")?.data?.text as string ?? null,
      source: "pipeline",
      option_id: input.optionId ?? null,
      widgets: response.widgets,
      follow_ups: response.followUps,
      metadata: { executionMs },
    });

    // Update conversation timestamp and title
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Set title from first meaningful interaction
    const { data: conv } = await db
      .from("conversations")
      .select("title")
      .eq("id", input.conversationId)
      .single();

    if (!conv?.title) {
      if (input.content) {
        updateData.title = input.content.slice(0, 80);
      } else if (input.optionId) {
        const optionName = context.availableOptions.find(
          (o) => o.id === input.optionId
        )?.name;
        if (optionName && input.source !== "default_option") {
          updateData.title = optionName;
        }
      }
    }

    await db
      .from("conversations")
      .update(updateData)
      .eq("id", input.conversationId);

    const jsonResponse = NextResponse.json(response);

    // Flush structured logs to CloudWatch (non-blocking on Vercel via waitUntil)
    const flushPromise = logger.flush();
    if (typeof globalThis !== "undefined" && "waitUntil" in globalThis && typeof (globalThis as Record<string, unknown>).waitUntil === "function") {
      (globalThis as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(flushPromise);
    } else {
      await flushPromise;
    }

    return jsonResponse;
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
    logger.error("api.chatMessage", "Chat message error", { error: (err as Error).message });
    await logger.flush();
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

async function ensureConversation(
  conversationId: string,
  tenantId: string,
  userId: string
) {
  const db = createServiceSupabase();
  const { data } = await db
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .single();

  if (!data) {
    await db.from("conversations").insert({
      id: conversationId,
      tenant_id: tenantId,
      user_id: userId,
      context: "tracker",
      title: "New Conversation",
    });
  }
}
