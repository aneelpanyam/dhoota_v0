import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/session";
import { buildUserContext } from "@/lib/pipeline/context";
import { processMessage } from "@/lib/pipeline";
import { createServiceSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logging/logger";
import { setLlmLogContext, clearLlmLogContext } from "@/lib/llm/cost";
import { isPublicMode } from "@/lib/auth/public-mode";

const messageSchema = z.object({
  conversationId: z.string().uuid(),
  source: z.enum([
    "chat", "follow_up", "inline_action",
    "default_option", "qa_response", "confirmation",
    "insights",
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
  const traceId = crypto.randomUUID();

  try {
    const session = await requireSession();
    const body = await request.json();
    const input = messageSchema.parse(body);
    const isCitizen = session.userType === "citizen";

    setLlmLogContext({
      tenantId: session.tenantId,
      userId: session.id,
      conversationId: input.conversationId,
      optionId: input.optionId,
    });

    if (!isCitizen) {
      await ensureConversation(input.conversationId, session.tenantId, session.id);

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
    }

    const context = await buildUserContext(session, input.conversationId);
    const startTime = Date.now();
    const response = await processMessage(input, context, traceId);
    const executionMs = Date.now() - startTime;

    if (!isCitizen) {
      const db = createServiceSupabase();
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
        trace_id: traceId,
        metadata: {
          executionMs,
          debugTrace: response.debugTrace,
        },
      });

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

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
    }

    clearLlmLogContext();

    const jsonResponse = NextResponse.json({ ...response, traceId });
    jsonResponse.headers.set("x-trace-id", traceId);

    const flushPromise = logger.flush();
    if (typeof globalThis !== "undefined" && "waitUntil" in globalThis && typeof (globalThis as Record<string, unknown>).waitUntil === "function") {
      (globalThis as unknown as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(flushPromise);
    } else {
      await flushPromise;
    }

    return jsonResponse;
  } catch (err) {
    clearLlmLogContext();

    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" }, traceId },
        { status: 401 }
      );
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Invalid input", details: err.errors }, traceId },
        { status: 400 }
      );
    }
    logger.error("api.chatMessage", "Chat message error", { error: (err as Error).message, traceId });
    await logger.flush();
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" }, traceId },
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
