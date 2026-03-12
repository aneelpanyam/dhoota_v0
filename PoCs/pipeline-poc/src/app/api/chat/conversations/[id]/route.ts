import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { createServiceSupabase } from "@/lib/supabase/server";
import { logger } from "@/lib/logging/logger";
import { buildUserContext, optionsToReferences } from "@/lib/pipeline/context";
import type { Widget } from "@/types/api";
import { generateId } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireSession();
    const { id: conversationId } = await params;
    const db = createServiceSupabase();

    const { data: conv } = await db
      .from("conversations")
      .select("id, title")
      .eq("id", conversationId)
      .eq("tenant_id", session.tenantId)
      .single();

    if (!conv) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        { status: 404 }
      );
    }

    const { data: messages } = await db
      .from("messages")
      .select("id, role, content, source, option_id, widgets, follow_ups, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);

    const context = await buildUserContext(session, conversationId);
    const defaultOpts = optionsToReferences(context.defaultOptions);

    // Filter out user messages with no content (Q&A params, confirmations)
    // and init messages that are just menus (they'll be re-added at the end)
    const allMessages = (messages ?? [])
      .filter((m: Record<string, unknown>) => {
        if (m.role === "user" && !m.content) return false;
        return true;
      })
      .map((m: Record<string, unknown>) => {
        if (m.role === "user") {
          return {
            messageId: m.id as string,
            role: "user" as const,
            content: m.content as string,
            createdAt: m.created_at as string,
          };
        }
        return {
          messageId: m.id as string,
          role: "assistant" as const,
          conversationId,
          widgets: (m.widgets as Widget[]) ?? [],
          followUps: (m.follow_ups as unknown[]) ?? [],
          defaultOptions: defaultOpts,
          conversationState: "active" as const,
          createdAt: m.created_at as string,
        };
      });

    const defaultMenuWidget: Widget = {
      id: generateId(),
      type: "default_options_menu",
      data: {
        title: "What would you like to do?",
        options: defaultOpts,
      },
      bookmarkable: false,
    };

    return NextResponse.json({
      conversationId,
      title: conv.title,
      messages: allMessages,
      defaultOptions: defaultOpts,
      menuWidget: defaultMenuWidget,
      userConfig: {
        userType: session.userType,
        theme: {},
        displayName: session.displayName,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
        { status: 401 }
      );
    }
    logger.error("api.conversations", "Load conversation error", { error: (err as Error).message });
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Failed to load conversation" } },
      { status: 500 }
    );
  }
}
