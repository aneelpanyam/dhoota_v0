"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@/lib/hooks/use-chat";
import { useSessionTimeout } from "@/lib/hooks/use-session-timeout";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { MobileBottomNav } from "./MobileBottomNav";
import { ConversationSidebar } from "./ConversationSidebar";
import { DebugPanel } from "./DebugPanel";
import { isDebugPanelEnabled } from "@/lib/auth/public-mode";
import { SidePanel } from "./SidePanel";
import { Loader2, Info, AlertTriangle } from "lucide-react";
import type { ContextItem } from "./ContextStrip";

export function ChatContainer() {
  const router = useRouter();
  const chat = useChat();
  const initialized = useRef(false);

  const [sessionContext, setSessionContext] = useState<{
    publicMode: boolean;
    tenantName?: string | null;
    publicSiteConfig?: {
      welcomeMessage: string;
      sidePanelContent: unknown;
      themeOverrides: unknown;
      enabledOptionIds: string[];
      siteTitle?: string | null;
      infoCards?: { id: string; title: string; content: unknown; card_type: string; icon?: string; display_order: number }[];
      representativeAvatarUrl?: string | null;
    };
    conversationContext: string;
    user: { userType: string; displayName: string } | null;
    featureFlags?: string[];
  } | null>(null);
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [inputExpanded, setInputExpanded] = useState(false);
  const [contextItems, setContextItems] = useState<ContextItem[]>([]);
  const [contextFilters, setContextFilters] = useState<{ id: string; name: string }[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<{ id: string; name: string } | null>(null);

  const handleSessionTimeout = useCallback(async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const sessionLoaded = sessionContext !== null;
  const isPublic = sessionContext?.publicMode ?? false;
  const { recordActivity } = useSessionTimeout({
    onTimeout: handleSessionTimeout,
    enabled: sessionLoaded && !isPublic,
  });

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      chat.initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("/api/session")
      .then((res) => res.json())
      .then(setSessionContext)
      .catch(() => {
        setSessionContext({
          publicMode: false,
          conversationContext: "tracker",
          user: null,
          featureFlags: [],
        });
      });
  }, []);

  useEffect(() => {
    fetch("/api/context-filters")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          console.warn("[context-filters] Request failed:", res.status, data?.error ?? res.statusText);
        }
        setContextFilters(data.filters ?? []);
      })
      .catch((err) => {
        console.warn("[context-filters] Fetch error:", err);
        setContextFilters([]);
      });
  }, []);

  const bookmarksEnabled = sessionContext?.featureFlags?.includes("bookmarks_enabled") ?? false;

  const handlePinToContext = useCallback((item: ContextItem) => {
    setContextItems((prev) => {
      if (prev.some((c) => c.entityId === item.entityId)) return prev;
      return [...prev, item];
    });
  }, []);

  const handleRemoveContext = useCallback((entityId: string) => {
    setContextItems((prev) => prev.filter((c) => c.entityId !== entityId));
  }, []);

  const handleClearContext = useCallback(() => {
    setContextItems([]);
  }, []);

  const handleFilterSelect = useCallback((filterId: string) => {
    const filter = contextFilters.find((f) => f.id === filterId);
    if (filter) setSelectedFilter({ id: filter.id, name: filter.name });
  }, [contextFilters]);

  const handleClearFilter = useCallback(() => {
    setSelectedFilter(null);
  }, []);

  const optionLoadingMessages = useMemo(() => {
    const map: Record<string, string> = {};
    for (const msg of chat.messages) {
      const res = msg.response;
      if (!res) continue;
      for (const opt of res.defaultOptions ?? []) {
        if (opt.loadingMessage) map[opt.optionId] = opt.loadingMessage;
      }
      for (const fu of res.followUps ?? []) {
        if (fu.loadingMessage) map[fu.optionId] = fu.loadingMessage;
      }
    }
    return map;
  }, [chat.messages]);

  const showSidebar = sessionLoaded && !isPublic;

  return (
    <div className="flex h-screen w-full max-w-full overflow-x-hidden bg-background">
      {showSidebar && (
        <ConversationSidebar
          userDisplayName={chat.userDisplayName}
          conversations={chat.conversations}
          activeConversationId={chat.conversationId}
          onNewConversation={chat.startNewConversation}
          onSelectConversation={chat.loadConversation}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        {/* Header */}
        <header
          className={`h-14 border-b flex items-center shrink-0 gap-3 ${
            showSidebar ? "px-6 pl-14 md:pl-6" : "px-6"
          }`}
        >
          <div className="w-10 h-10 shrink-0 rounded overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon.png"
              alt=""
              className="w-10 h-10 object-cover"
            />
          </div>
          <h1 className="text-lg font-semibold">
            {isPublic
              ? (sessionContext?.publicSiteConfig?.siteTitle ?? sessionContext?.user?.displayName ?? "Dhoota")
              : sessionContext?.tenantName
                ? `Dhoota For ${sessionContext.tenantName}`
                : "Dhoota"}
          </h1>
          {isPublic && (
            <button
              onClick={() => setSidePanelOpen((o) => !o)}
              className="ml-3 p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition lg:hidden"
              aria-label="Toggle info panel"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          {chat.isLoading && (
            <Loader2 className="ml-3 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </header>

        {/* System admin warning banner */}
        {showSidebar && sessionContext?.user?.userType === "system_admin" && (
          <div className="px-6 pl-14 md:pl-6 pt-2 shrink-0">
            <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>You are logged in as a system administrator. Please be careful about your actions—changes may affect tenants and system configuration.</span>
            </div>
          </div>
        )}

        {/* Error banner (public mode) */}
        {isPublic && chat.error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/15 border border-destructive/30 text-destructive text-sm shrink-0">
            {chat.error}
          </div>
        )}

        {/* Messages */}
        {chat.messages.length === 0 && chat.isLoading ? (
          <div className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-2xl space-y-4">
              <div className="flex gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="flex-1 max-w-xs" />
                <div className="space-y-2 w-48">
                  <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                </div>
              </div>
              <div className="flex gap-3">
                <div className="h-8 w-8 shrink-0 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-56 rounded bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  <div className="h-4 w-full rounded bg-muted animate-pulse" />
                  <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        ) : (
        <MessageList
          messages={chat.messages}
          isLoading={chat.isLoading}
          pendingRequest={chat.pendingRequest}
          optionLoadingMessages={optionLoadingMessages}
          conversationId={chat.conversationId}
          bookmarksEnabled={bookmarksEnabled}
          representativeAvatarUrl={isPublic ? sessionContext?.publicSiteConfig?.representativeAvatarUrl ?? undefined : undefined}
          onAction={(action) => {
            recordActivity();
            if (action.optionId === "_load_conversation" && action.params?.conversationId) {
              chat.loadConversation(action.params.conversationId as string);
              return;
            }
            chat.sendMessage({
              source: "inline_action",
              optionId: action.optionId,
              params: action.params,
              targetResourceId: action.targetResourceId,
              targetResourceType: action.targetResourceType,
            });
          }}
          onOptionSelect={(optionId, params) => {
            recordActivity();
            chat.sendMessage({
              source: "default_option",
              optionId,
              params,
            });
          }}
          onConfirm={(optionId, params) => {
            recordActivity();
            chat.sendMessage({
              source: "confirmation",
              optionId,
              params,
            });
          }}
          onQAResponse={(optionId, params, content) => {
            recordActivity();
            chat.sendMessage({
              source: "qa_response",
              optionId,
              params,
              content,
            });
          }}
          onCancel={() => chat.cancelAction()}
          onPinToContext={handlePinToContext}
        />
        )}

        {/* Input */}
        <ChatInput
          expanded={inputExpanded}
          onExpandChange={setInputExpanded}
          onSendReport={(filter) => {
            recordActivity();
            chat.sendMessage({
              source: "insights",
              params: { filterId: filter.id, filterName: filter.name, reportRequest: true },
            });
            setSelectedFilter(null);
          }}
          onSend={(content, files) => {
            recordActivity();
            chat.sendMessage({
              source: "chat",
              content,
              files,
            });
          }}
          onSendInsights={(content, items, filter) => {
            recordActivity();
            chat.sendMessage({
              source: "insights",
              content,
              params: filter ? { filterId: filter.id, filterName: filter.name } : { contextItems: items },
            });
            if (filter) {
              setSelectedFilter(null);
            } else {
              handleClearContext();
            }
          }}
          isLoading={chat.isLoading}
          conversationState={chat.conversationState}
          isPublicMode={isPublic}
          contextItems={contextItems}
          onRemoveContext={handleRemoveContext}
          onClearContext={handleClearContext}
          contextFilters={contextFilters}
          selectedFilter={selectedFilter ?? undefined}
          onFilterSelect={handleFilterSelect}
          onClearFilter={handleClearFilter}
          onContextItemClick={(item) => {
            if (!item.viewAction) return;
            recordActivity();
            chat.sendMessage({
              source: "inline_action",
              optionId: item.viewAction.optionId,
              params: item.viewAction.params,
            });
          }}
          defaultOptions={sessionLoaded ? chat.defaultOptions : []}
          onOptionSelect={(optionId, params) => {
            recordActivity();
            chat.sendMessage({
              source: "default_option",
              optionId,
              params,
            });
          }}
          featureFlags={sessionContext?.featureFlags ?? []}
        />
      </div>

      {sessionLoaded && (
        <MobileBottomNav
          defaultOptions={chat.defaultOptions}
          isPublicMode={isPublic}
          featureFlags={sessionContext?.featureFlags ?? []}
          onOptionSelect={(optionId, params) => {
            recordActivity();
            chat.sendMessage({
              source: "default_option",
              optionId,
              params,
            });
          }}
          onExplore={() => setInputExpanded(true)}
        />
      )}

      {isPublic && (
        <SidePanel
          cards={sessionContext?.publicSiteConfig?.infoCards ?? []}
          isOpen={sidePanelOpen}
          onClose={() => setSidePanelOpen(false)}
        />
      )}
      {isDebugPanelEnabled() && (
        <DebugPanel conversationId={chat.conversationId} />
      )}
    </div>
  );
}
