"use client";

import { useState, useCallback, useRef } from "react";
import type {
  ChatMessageResponse,
  SendMessageRequest,
  InitResponse,
  OptionReference,
  ConversationState,
} from "@/types/api";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content?: string;
  response?: ChatMessageResponse;
  timestamp: Date;
  flowId?: string;
  collapsedMessages?: ChatMessage[];
  contextItems?: { entityType: string; entityId: string; label: string; summary: string; viewAction?: { optionId: string; params: Record<string, unknown> } }[];
}

export interface ConversationSummary {
  id: string;
  title: string | null;
  context: string;
  updated_at: string;
  created_at: string;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  conversationId: string | null;
  conversationState: ConversationState;
  defaultOptions: OptionReference[];
  isLoading: boolean;
  error: string | null;
  userDisplayName: string;
  conversations: ConversationSummary[];
  initialize: () => Promise<void>;
  sendMessage: (request: Omit<SendMessageRequest, "conversationId">) => Promise<void>;
  cancelAction: () => void;
  startNewConversation: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationState, setConversationState] = useState<ConversationState>("active");
  const [defaultOptions, setDefaultOptions] = useState<OptionReference[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState("");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const activeFlowIdRef = useRef<string | null>(null);
  const flowStartIndexRef = useRef<number>(-1);

  const refreshConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // non-critical
    }
  }, []);

  const initialize = useCallback(async (forceNew = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const [initRes] = await Promise.all([
        fetch("/api/chat/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceNew }),
        }),
        refreshConversations(),
      ]);

      if (!initRes.ok) throw new Error("Failed to initialize");

      const data: InitResponse = await initRes.json();
      setConversationId(data.conversationId);
      conversationIdRef.current = data.conversationId;
      setUserDisplayName(data.userConfig.displayName);

      const chatMessages: ChatMessage[] = data.messages.map((msg) => ({
        id: msg.messageId,
        role: "assistant" as const,
        content: undefined,
        response: msg,
        timestamp: new Date(),
      }));

      for (const msg of data.messages) {
        if (msg.debugTrace) {
          storeDebugTrace(data.conversationId, msg.messageId, msg.debugTrace);
        }
      }

      setMessages(chatMessages);

      if (data.messages.length > 0) {
        const lastMsg = data.messages[data.messages.length - 1];
        setDefaultOptions(lastMsg.defaultOptions);
        setConversationState(lastMsg.conversationState);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize");
    } finally {
      setIsLoading(false);
    }
  }, [refreshConversations]);

  const loadConversation = useCallback(async (id: string) => {
    if (id === conversationIdRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      if (!res.ok) throw new Error("Failed to load conversation");

      const data = await res.json();
      setConversationId(data.conversationId);
      conversationIdRef.current = data.conversationId;
      if (data.userConfig?.displayName) {
        setUserDisplayName(data.userConfig.displayName);
      }

      const chatMessages: ChatMessage[] = data.messages.map(
        (m: Record<string, unknown>) => {
          if (m.role === "user") {
            return {
              id: m.messageId as string,
              role: "user" as const,
              content: (m.content as string) ?? undefined,
              timestamp: m.createdAt ? new Date(m.createdAt as string) : new Date(),
            };
          }
          return {
            id: m.messageId as string,
            role: "assistant" as const,
            response: {
              messageId: m.messageId as string,
              conversationId: id,
              widgets: (m.widgets ?? []) as import("@/types/api").Widget[],
              followUps: ((m.followUps ?? m.follow_ups ?? []) as OptionReference[]),
              defaultOptions: data.defaultOptions ?? [],
              conversationState: "active" as const,
            },
            timestamp: m.createdAt ? new Date(m.createdAt as string) : new Date(),
          };
        }
      );

      if (data.menuWidget) {
        chatMessages.push({
          id: crypto.randomUUID(),
          role: "assistant",
          response: {
            messageId: crypto.randomUUID(),
            conversationId: id,
            widgets: [data.menuWidget],
            followUps: [],
            defaultOptions: data.defaultOptions ?? [],
            conversationState: "active",
          },
          timestamp: new Date(),
        });
      }

      setMessages(chatMessages);
      setDefaultOptions(data.defaultOptions ?? []);
      setConversationState("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (request: Omit<SendMessageRequest, "conversationId">) => {
      const convId = conversationIdRef.current;
      if (!convId) return;

      setIsLoading(true);
      setError(null);

      // Start a new flow when the user picks an option or types free text
      const isFlowStart =
        request.source === "default_option" ||
        request.source === "inline_action" ||
        request.source === "chat" ||
        request.source === "insights";

      if (isFlowStart) {
        activeFlowIdRef.current = crypto.randomUUID();
      }

      // All messages within an active flow (Q&A, confirmation, etc.) share the same flowId
      const currentFlowId = activeFlowIdRef.current ?? undefined;

      // Add user message to the list and record flow start index
      const userContent = request.content || deriveUserContent(request);
      if (userContent) {
        const insightContext =
          request.source === "insights" && Array.isArray(request.params?.contextItems)
            ? (request.params!.contextItems as ChatMessage["contextItems"])
            : undefined;
        const userMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "user",
          content: userContent,
          timestamp: new Date(),
          flowId: currentFlowId,
          contextItems: insightContext,
        };
        setMessages((prev) => {
          if (isFlowStart) flowStartIndexRef.current = prev.length;
          return [...prev, userMsg];
        });
      } else if (isFlowStart) {
        // Even without a user message, record where this flow starts
        setMessages((prev) => {
          flowStartIndexRef.current = prev.length;
          return prev;
        });
      }

      try {
        const res = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...request,
            conversationId: convId,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message ?? "Failed to send message");
        }

        const data: ChatMessageResponse = await res.json();

        if (data.debugTrace) {
          storeDebugTrace(convId, data.messageId, data.debugTrace);
        }

        const assistantMsg: ChatMessage = {
          id: data.messageId,
          role: "assistant",
          response: data,
          timestamp: new Date(),
          flowId: currentFlowId,
        };

        setMessages((prev) => {
          let updated = [...prev];

          if (request.source === "confirmation" && currentFlowId) {
            // Collapse all messages belonging to this flow using flowId + start index
            const startIdx = flowStartIndexRef.current;
            const kept: ChatMessage[] = [];
            const collapsed: ChatMessage[] = [];
            for (let i = 0; i < updated.length; i++) {
              const m = updated[i];
              if (m.flowId === currentFlowId || (startIdx >= 0 && i >= startIdx)) {
                collapsed.push(m);
              } else {
                kept.push(m);
              }
            }
            assistantMsg.collapsedMessages = collapsed.length > 0 ? collapsed : undefined;
            assistantMsg.flowId = undefined;
            updated = kept;
            activeFlowIdRef.current = null;
            flowStartIndexRef.current = -1;
          } else if (request.source === "qa_response") {
            // Freeze the previous interactive widget so the conversation reads naturally
            for (let i = updated.length - 1; i >= 0; i--) {
              const msg = updated[i];
              if (msg.role === "assistant" && msg.response) {
                const hasInteractive = msg.response.widgets.some(
                  (w) => w.type === "confirmation_card" || w.type === "question_card" || w.type === "context_picker"
                );
                if (hasInteractive) {
                  updated[i] = {
                    ...msg,
                    response: {
                      ...msg.response,
                      widgets: msg.response.widgets.map((w) =>
                        freezeInteractiveWidget(w)
                      ),
                    },
                  };
                  break;
                }
              }
            }
          }

          updated.push(assistantMsg);
          return updated;
        });
        setDefaultOptions(data.defaultOptions);
        setConversationState(data.conversationState);
        refreshConversations();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message");
      } finally {
        setIsLoading(false);
      }
    },
    [refreshConversations]
  );

  const cancelAction = useCallback(() => {
    const cancelledFlowId = activeFlowIdRef.current;
    const startIdx = flowStartIndexRef.current;
    activeFlowIdRef.current = null;
    flowStartIndexRef.current = -1;
    setConversationState("active");
    setMessages((prev) => {
      let updated = [...prev];

      // Freeze interactive widgets from the cancelled flow
      for (let i = updated.length - 1; i >= 0; i--) {
        const msg = updated[i];
        if (msg.role === "assistant" && msg.response) {
          const hasInteractive = msg.response.widgets.some(
            (w) => w.type === "confirmation_card" || w.type === "question_card" || w.type === "context_picker"
          );
          if (hasInteractive) {
            updated[i] = {
              ...msg,
              response: {
                ...msg.response,
                widgets: msg.response.widgets.map((w) =>
                  freezeInteractiveWidget(w)
                ),
              },
            };
            break;
          }
        }
      }

      // Collapse messages using flowId + start index
      const kept: ChatMessage[] = [];
      const collapsed: ChatMessage[] = [];
      for (let i = 0; i < updated.length; i++) {
        const m = updated[i];
        if (
          (cancelledFlowId && m.flowId === cancelledFlowId) ||
          (startIdx >= 0 && i >= startIdx)
        ) {
          collapsed.push(m);
        } else {
          kept.push(m);
        }
      }
      updated = kept;

      const cancelMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        collapsedMessages: collapsed.length > 0 ? collapsed : undefined,
        response: {
          messageId: crypto.randomUUID(),
          conversationId: conversationIdRef.current ?? "",
          widgets: [
            { id: crypto.randomUUID(), type: "text_response", data: { text: "Action cancelled." }, bookmarkable: false },
            {
              id: crypto.randomUUID(),
              type: "default_options_menu",
              data: { title: "What would you like to do?", options: defaultOptions },
              bookmarkable: false,
            },
          ],
          followUps: [],
          defaultOptions,
          conversationState: "active",
        },
        timestamp: new Date(),
      };
      updated.push(cancelMsg);

      return updated;
    });
  }, [defaultOptions]);

  const startNewConversation = useCallback(async () => {
    setMessages([]);
    setConversationId(null);
    conversationIdRef.current = null;
    setConversationState("active");
    await initialize(true);
  }, [initialize]);

  return {
    messages,
    conversationId,
    conversationState,
    defaultOptions,
    isLoading,
    error,
    userDisplayName,
    conversations,
    initialize,
    sendMessage,
    cancelAction,
    startNewConversation,
    loadConversation,
    refreshConversations,
  };
}

function freezeInteractiveWidget(
  w: import("@/types/api").Widget
): import("@/types/api").Widget {
  if (w.type === "question_card") {
    const questions = Array.isArray(w.data.questionText)
      ? (w.data.questionText as string[])
      : [w.data.questionText as string];
    return {
      ...w,
      type: "text_response",
      data: { text: questions.join("\n\n") },
    };
  }
  if (w.type === "confirmation_card") {
    const title = (w.data.title as string) ?? "Confirmation";
    const fields = (w.data.fields as { label: string; value: string }[]) ?? [];
    const lines = fields.map((f) => `**${f.label}:** ${f.value}`);
    return {
      ...w,
      type: "text_response",
      data: { text: `*${title}*\n${lines.join("\n")}` },
    };
  }
  if (w.type === "context_picker") {
    const query = (w.data.originalQuery as string) ?? "";
    return {
      ...w,
      type: "text_response",
      data: { text: `*Query:* ${query}` },
    };
  }
  return w;
}

function deriveUserContent(
  request: Omit<import("@/types/api").SendMessageRequest, "conversationId">
): string | null {
  if (request.source === "default_option" && request.optionId) {
    const label = request.optionId
      .replace(/^activity\./, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return label;
  }
  if (request.source === "inline_action" && request.optionId) {
    const label = request.optionId
      .replace(/^activity\./, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return label;
  }
  if (request.source === "qa_response" && request.params) {
    const parts: string[] = [];
    for (const [key, val] of Object.entries(request.params)) {
      if (key.startsWith("__") || key === "optionId" || key === "sessionParams" || val == null) continue;
      if (Array.isArray(val)) {
        const names = val
          .filter((f): f is Record<string, unknown> => f != null && typeof f === "object")
          .map((f) => (f.originalFilename ?? f.original_filename ?? "file") as string);
        if (names.length > 0) {
          parts.push(`📎 ${names.join(", ")}`);
        } else if (val.length > 0) {
          parts.push(val.join(", "));
        }
      } else if (typeof val === "string" && val.trim()) {
        parts.push(val);
      }
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  }
  if (request.source === "confirmation") {
    return "Confirmed ✓";
  }
  return null;
}

const MAX_STORED_TRACES = 50;

function storeDebugTrace(
  conversationId: string,
  messageId: string,
  trace: NonNullable<ChatMessageResponse["debugTrace"]>
) {
  try {
    const key = `dhoota_debug_${conversationId}`;
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
    existing.push({ messageId, timestamp: new Date().toISOString(), trace });
    if (existing.length > MAX_STORED_TRACES) {
      existing.splice(0, existing.length - MAX_STORED_TRACES);
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch {
    // localStorage may be unavailable or full
  }
}
