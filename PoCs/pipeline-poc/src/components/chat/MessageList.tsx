"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, PendingRequest } from "@/lib/hooks/use-chat";
import type { WidgetAction } from "@/types/api";
import { MessageBubble } from "./MessageBubble";
import { EyeOff, Eye } from "lucide-react";
import type { ContextItem } from "./ContextStrip";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  pendingRequest?: PendingRequest | null;
  optionLoadingMessages?: Record<string, string>;
  conversationId?: string | null;
  bookmarksEnabled?: boolean;
  representativeAvatarUrl?: string | null;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (
    optionId: string,
    params: Record<string, unknown>,
    content?: string
  ) => void;
  onCancel: () => void;
  onPinToContext?: (item: ContextItem) => void;
}

function getStorageKey(conversationId?: string | null): string {
  return `dhoota:hidden-msgs:${conversationId ?? "default"}`;
}

function getLoadingMessage(
  pendingRequest?: PendingRequest | null,
  optionLoadingMessages?: Record<string, string>
): string {
  if (!pendingRequest) return "Thinking...";
  if (pendingRequest.source === "insights") return "Loading insights...";
  const optId = pendingRequest.optionId ?? "";
  if (optionLoadingMessages?.[optId]) return optionLoadingMessages[optId];
  if (/\b(create|edit|add|delete|remove)\b/.test(optId)) return "Preparing confirmation...";
  return "Loading...";
}

export function MessageList({
  messages,
  isLoading,
  pendingRequest,
  optionLoadingMessages,
  conversationId,
  bookmarksEnabled,
  representativeAvatarUrl,
  onAction,
  onOptionSelect,
  onConfirm,
  onQAResponse,
  onCancel,
  onPinToContext,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const prevMessageCount = useRef(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(conversationId));
      if (stored) setHiddenIds(new Set(JSON.parse(stored)));
      else setHiddenIds(new Set());
    } catch {
      setHiddenIds(new Set());
    }
  }, [conversationId]);

  useEffect(() => {
    if (!bookmarksEnabled) return;
    fetch("/api/bookmarks?entityType=message")
      .then((res) => res.json())
      .then((data) => {
        if (data.bookmarks) {
          setBookmarkedIds(new Set(data.bookmarks.map((b: { entity_id: string }) => b.entity_id)));
        }
      })
      .catch(() => {});
  }, [conversationId, bookmarksEnabled]);

  const toggleBookmark = useCallback((messageId: string, label?: string) => {
    const isBookmarked = bookmarkedIds.has(messageId);

    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(messageId);
      else next.add(messageId);
      return next;
    });

    const req = isBookmarked
      ? fetch("/api/bookmarks", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "message", entityId: messageId }),
        })
      : fetch("/api/bookmarks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ entityType: "message", entityId: messageId, label }),
        });

    req.catch(() => {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) next.add(messageId);
        else next.delete(messageId);
        return next;
      });
    });
  }, [bookmarkedIds]);

  const persistHidden = useCallback((ids: Set<string>) => {
    try {
      localStorage.setItem(getStorageKey(conversationId), JSON.stringify([...ids]));
    } catch { /* ignore */ }
  }, [conversationId]);

  const hideMessage = useCallback((messageId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      persistHidden(next);
      return next;
    });
  }, [persistHidden]);

  const unhideMessage = useCallback((messageId: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(messageId);
      persistHidden(next);
      return next;
    });
  }, [persistHidden]);

  const unhideAll = useCallback(() => {
    setHiddenIds(new Set());
    persistHidden(new Set());
    setShowHidden(false);
  }, [persistHidden]);

  useEffect(() => {
    const count = messages.length;
    // Only scroll when new messages are added (not on initial load: 0 -> N)
    if (prevMessageCount.current > 0 && count > prevMessageCount.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCount.current = count;
  }, [messages]);

  const hiddenCount = messages.filter((m) => hiddenIds.has(m.id)).length;
  const visibleMessages = showHidden
    ? messages
    : messages.filter((m) => !hiddenIds.has(m.id));

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="mx-auto space-y-4">
        {hiddenCount > 0 && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setShowHidden((v) => !v)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition px-3 py-1 rounded-full border border-transparent hover:border-muted"
            >
              {showHidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {showHidden
                ? `Showing all (${hiddenCount} hidden)`
                : `${hiddenCount} message${hiddenCount !== 1 ? "s" : ""} hidden`}
            </button>
            {showHidden && (
              <button
                onClick={unhideAll}
                className="text-[11px] text-primary/60 hover:text-primary transition"
              >
                Unhide all
              </button>
            )}
          </div>
        )}

        {visibleMessages.map((message, idx) => {
          const isHidden = hiddenIds.has(message.id);
          return (
            <div key={message.id} className={isHidden ? "opacity-40" : ""}>
              <MessageBubble
                message={message}
                representativeAvatarUrl={representativeAvatarUrl}
                isLastMessage={!showHidden && idx === visibleMessages.length - 1}
                isHidden={isHidden}
                isBookmarked={bookmarksEnabled ? bookmarkedIds.has(message.id) : undefined}
                onAction={onAction}
                onOptionSelect={onOptionSelect}
                onConfirm={onConfirm}
                onQAResponse={onQAResponse}
                onCancel={onCancel}
                onHide={() => hideMessage(message.id)}
                onUnhide={() => unhideMessage(message.id)}
                onPinToContext={onPinToContext}
                onToggleBookmark={bookmarksEnabled ? () => {
                  const summary = message.response?.widgets
                    .find((w) => w.type === "text_response")
                    ?.data?.text as string | undefined;
                  toggleBookmark(message.id, summary?.slice(0, 200));
                } : undefined}
              />
            </div>
          );
        })}

        {isLoading && messages.length > 0 && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" />
            </div>
            <span>{getLoadingMessage(pendingRequest, optionLoadingMessages)}</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
