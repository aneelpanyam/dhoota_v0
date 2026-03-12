import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { buildUserContext, optionsToReferences } from "@/lib/pipeline/context";
import { processMessage } from "@/lib/pipeline";
import { generateId } from "@/lib/utils";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { ChatMessageResponse, Widget } from "@/types/api";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const body = await request.json().catch(() => ({}));
    const forceNew = body.forceNew === true;
    let conversationId = body.conversationId as string | undefined;

    const db = createServiceSupabase();

    // Reuse the most recent conversation unless forceNew or explicit ID
    if (!conversationId && !forceNew) {
      const { data: recent } = await db
        .from("conversations")
        .select("id")
        .eq("tenant_id", session.tenantId)
        .eq("user_id", session.id)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (recent) {
        conversationId = recent.id;
      }
    }

    // Create new conversation if none found or forceNew
    if (!conversationId) {
      conversationId = generateId();
      await db.from("conversations").insert({
        id: conversationId,
        tenant_id: session.tenantId,
        user_id: session.id,
        context: "tracker",
        title: null,
      });
    }

    const context = await buildUserContext(session, conversationId);

    // Check if conversation already has messages (returning user)
    const { count: msgCount } = await db
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);

    const hasExistingMessages = (msgCount ?? 0) > 0;

    // Execute init options in parallel (fresh data each time)
    const initResults: ChatMessageResponse[] = [];

    if (context.initOptionIds.length > 0) {
      const promises = context.initOptionIds.map((optionId) =>
        processMessage(
          {
            conversationId: conversationId!,
            source: "default_option",
            optionId,
            params: { page: 1, pageSize: 5 },
          },
          context
        )
      );

      const results = await Promise.allSettled(promises);
      for (const result of results) {
        if (result.status === "fulfilled") {
          initResults.push(result.value);
        }
      }
    }

    const defaultOpts = optionsToReferences(context.defaultOptions);

    const welcomeWidget: Widget = {
      id: generateId(),
      type: "text_response",
      data: {
        text: hasExistingMessages
          ? `Welcome back, ${session.displayName}! Here's your latest overview.`
          : `Welcome to Dhoota, ${session.displayName}! Let's get started tracking your activities.`,
      },
      bookmarkable: false,
    };

    const defaultMenuWidget: Widget = {
      id: generateId(),
      type: "default_options_menu",
      data: {
        title: "What would you like to do?",
        options: defaultOpts,
      },
      bookmarkable: false,
    };

    const welcomeMessage: ChatMessageResponse = {
      messageId: generateId(),
      conversationId,
      widgets: [welcomeWidget],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };

    const menuMessage: ChatMessageResponse = {
      messageId: generateId(),
      conversationId,
      widgets: [defaultMenuWidget],
      followUps: [],
      defaultOptions: defaultOpts,
      conversationState: "active",
    };

    // Save init messages to DB so they persist when loading later
    const allInitMessages = [welcomeMessage, ...initResults, menuMessage];
    const messageRows = allInitMessages.map((msg) => ({
      id: msg.messageId,
      conversation_id: conversationId,
      tenant_id: session.tenantId,
      role: "assistant",
      content: msg.widgets.find((w) => w.type === "text_response")?.data?.text as string ?? null,
      source: "init",
      widgets: msg.widgets,
      follow_ups: msg.followUps,
    }));

    // Only save init messages for brand new conversations (not returning visits)
    if (!hasExistingMessages) {
      await db.from("messages").insert(messageRows);
    }

    // Update timestamp
    await db
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return NextResponse.json({
      conversationId,
      messages: allInitMessages,
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
    console.error("Chat init error:", err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
