import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { isPublicMode, getPublicTenantId, getPublicUserId } from "@/lib/auth/public-mode";
import { buildUserContext, optionsToReferences } from "@/lib/pipeline/context";
import { logger } from "@/lib/logging/logger";
import { processMessage } from "@/lib/pipeline";
import { generateId } from "@/lib/utils";
import { createServiceSupabase } from "@/lib/supabase/server";
import type { ChatMessageResponse, Widget } from "@/types/api";

export async function POST(request: Request) {
  const initTraceId = crypto.randomUUID();
  logger.setTraceId(initTraceId);

  try {
    if (isPublicMode()) {
      const session = await requireSession();
      const conversationId = generateId();
      const context = await buildUserContext(session, conversationId);
      const defaultOpts = optionsToReferences(context.defaultOptions);

      const db = createServiceSupabase();
      const tenantId = getPublicTenantId();
      const userId = getPublicUserId();
      const welcomeWidgets: Widget[] = [];

      if (tenantId && userId) {
        const { data: welcomeRows } = await db
          .from("public_site_welcome_messages")
          .select("message_text, banner_url")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: true });

        if (welcomeRows && welcomeRows.length > 0) {
          for (const row of welcomeRows) {
            const text = (row.message_text as string) ?? "";
            const bannerUrl = row.banner_url as string | null | undefined;
            const bannerImageUrl =
              bannerUrl && bannerUrl.trim()
                ? bannerUrl.startsWith("http")
                  ? bannerUrl
                  : `/api/media/serve?key=${encodeURIComponent(bannerUrl)}`
                : undefined;
            welcomeWidgets.push({
              id: generateId(),
              type: "welcome_message",
              data: { text, bannerImageUrl },
              bookmarkable: false,
            });
          }
        } else {
          const { data: config } = await db
            .from("public_site_configs")
            .select("welcome_message")
            .eq("tenant_id", tenantId)
            .eq("user_id", userId)
            .single();
          const fallbackText = config?.welcome_message ?? "Welcome! Ask me about activities, announcements, and more.";
          welcomeWidgets.push({
            id: generateId(),
            type: "text_response",
            data: { text: fallbackText },
            bookmarkable: false,
          });
        }
      } else {
        welcomeWidgets.push({
          id: generateId(),
          type: "text_response",
          data: { text: "Welcome! Ask me about activities, announcements, and more." },
          bookmarkable: false,
        });
      }

      const menuWidget: Widget = {
        id: generateId(),
        type: "default_options_menu",
        data: { title: "How can I help you?", options: defaultOpts },
        bookmarkable: false,
      };

      const welcomeMsg: ChatMessageResponse = {
        messageId: generateId(),
        conversationId,
        widgets: welcomeWidgets.length > 0 ? welcomeWidgets : [{
          id: generateId(),
          type: "text_response",
          data: { text: "Welcome! Ask me about activities, announcements, and more." },
          bookmarkable: false,
        }],
        followUps: [],
        defaultOptions: defaultOpts,
        conversationState: "active",
      };

      const initResults: ChatMessageResponse[] = [];
      const availableIds = new Set(context.availableOptions.map((o) => o.id));
      const initIdsToRun = context.initOptionIds.filter((id) => availableIds.has(id));

      if (initIdsToRun.length > 0) {
        const promises = initIdsToRun.map((optionId) =>
          processMessage(
            {
              conversationId,
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
          if (result.status === "rejected") {
            logger.warn("api.chatInit", "Init option failed", { error: result.reason?.message ?? String(result.reason) });
          }
        }
      }

      const menuMsg: ChatMessageResponse = {
        messageId: generateId(),
        conversationId,
        widgets: [menuWidget],
        followUps: [],
        defaultOptions: defaultOpts,
        conversationState: "active",
      };

      logger.clearTraceId();
      return NextResponse.json({
        conversationId,
        messages: [welcomeMsg, ...initResults, menuMsg],
        userConfig: {
          userType: "citizen",
          theme: {},
          displayName: "Citizen",
        },
      });
    }

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
        if (result.status === "rejected") {
          logger.warn("api.chatInit", "Init option failed", { error: result.reason?.message ?? String(result.reason) });
        }
      }
    }

    const defaultOpts = optionsToReferences(context.defaultOptions);

    // Load announcements and info cards only for citizen views (not worker/representative/candidate/admin)
    const skipAnnouncementsAndInfoCards = ["worker", "representative", "candidate", "system_admin"].includes(session.userType ?? "");

    let announcements: unknown[] = [];
    let infoCards: unknown[] = [];

    if (!skipAnnouncementsAndInfoCards) {
      const [announcementsRes, infoCardsRes] = await Promise.all([
        db
          .from("announcements")
          .select("id, title, content, pinned, published_at")
          .eq("tenant_id", session.tenantId)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order("pinned", { ascending: false })
          .order("published_at", { ascending: false, nullsFirst: false })
          .limit(5),
        db
          .from("info_cards")
          .select("id, title, content, card_type, icon, display_order")
          .eq("tenant_id", session.tenantId)
          .eq("visibility", "public")
          .is("deleted_at", null)
          .order("display_order", { ascending: true })
          .limit(10),
      ]);
      announcements = announcementsRes.data ?? [];
      infoCards = infoCardsRes.data ?? [];
    }

    const initWidgets: Widget[] = [];

    if (!skipAnnouncementsAndInfoCards && announcements.length > 0) {
      initWidgets.push({
        id: generateId(),
        type: "text_response",
        data: {
          text: "### Announcements\n\n" + announcements
            .map((a: { title: string; content: string; pinned?: boolean }) =>
              (a.pinned ? "**📌 " : "") + `**${a.title}**\n\n${(a.content as string).slice(0, 500)}${(a.content as string).length > 500 ? "..." : ""}`
            )
            .join("\n\n---\n\n"),
        },
        bookmarkable: false,
      });
    }

    if (!skipAnnouncementsAndInfoCards && infoCards.length > 0) {
      for (const card of infoCards) {
        const content = card.content as Record<string, unknown>;
        const text = typeof content?.content_raw === "string" ? content.content_raw : (content?.text as string) ?? "";
        initWidgets.push({
          id: generateId(),
          type: "text_response",
          data: {
            text: `### ${card.title}\n\n${text}`,
          },
          bookmarkable: false,
        });
      }
    }

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

    initWidgets.push(welcomeWidget);

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
      widgets: initWidgets,
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
    const messageRows = allInitMessages.map((msg) => {
      const textWidgets = msg.widgets.filter((w) => w.type === "text_response");
      const content = (textWidgets.length > 0 ? textWidgets[textWidgets.length - 1]?.data?.text : null) as string | null;
      return {
        id: msg.messageId,
        conversation_id: conversationId,
        tenant_id: session.tenantId,
        role: "assistant",
        content: content ?? null,
        source: "init",
        widgets: msg.widgets,
        follow_ups: msg.followUps,
      };
    });

    // Only save init messages for brand new conversations (not returning visits)
    if (!hasExistingMessages) {
      await db.from("messages").insert(messageRows);
    }

    // Update timestamp
    await db
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    logger.clearTraceId();
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
    logger.error("api.chatInit", "Chat init error", { error: (err as Error).message });
    await logger.flush();
    logger.clearTraceId();
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
