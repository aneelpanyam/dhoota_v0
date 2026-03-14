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

export interface PendingRequest {
  optionId?: string;
  source?: string;
}

export interface UseChatReturn {
  messages: ChatMessage[];
  conversationId: string | null;
  conversationState: ConversationState;
  defaultOptions: OptionReference[];
  isLoading: boolean;
  pendingRequest: PendingRequest | null;
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
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
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
      const userContent = deriveOptionSummary(request) ?? request.content ?? deriveUserContent(request);
      if (userContent) {
        let insightContext: ChatMessage["contextItems"];
        if (request.source === "insights") {
          if (Array.isArray(request.params?.contextItems) && request.params.contextItems.length > 0) {
            insightContext = request.params.contextItems as ChatMessage["contextItems"];
          } else if (request.params?.filterId && request.params?.filterName) {
            insightContext = [{
              entityType: "Filter",
              entityId: request.params.filterId as string,
              label: request.params.filterName as string,
              summary: "",
            }];
          } else {
            insightContext = undefined;
          }
        } else if ((request.source === "default_option" || request.source === "inline_action") && Array.isArray(request.params?.__contextItems) && request.params.__contextItems.length > 0) {
          insightContext = request.params.__contextItems as ChatMessage["contextItems"];
        } else {
          insightContext = undefined;
        }
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
        const { __contextItems: _strip, ...paramsForApi } = (request.params ?? {}) as Record<string, unknown> & { __contextItems?: unknown };
        const apiRequest = request.params ? { ...request, params: paramsForApi } : request;

        const res = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...apiRequest,
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

          // When response contains entityContext (e.g. edit flow), show it above the user's message (like pinned context)
          const widgetWithContext = data.widgets?.find(
            (w) =>
              (w.type === "question_stepper" || w.type === "confirmation_card") &&
              w.data?.entityContext
          );
          const entityCtx = widgetWithContext?.data?.entityContext as
            | { entityType: string; entityId: string; title: string; subtitle?: string }
            | undefined;
          if (entityCtx && updated.length > 0) {
            const lastIdx = updated.length - 1;
            const lastMsg = updated[lastIdx];
            if (lastMsg.role === "user" && !lastMsg.contextItems?.length) {
              updated[lastIdx] = {
                ...lastMsg,
                contextItems: [
                  {
                    entityType: entityCtx.entityType,
                    entityId: entityCtx.entityId,
                    label: entityCtx.title,
                    summary: entityCtx.subtitle ?? "",
                    viewAction:
                      entityCtx.entityType === "activity"
                        ? {
                            optionId: "activity.view",
                            params: { activity_id: entityCtx.entityId },
                          }
                        : undefined,
                  },
                ],
              };
            }
          }

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
                  (w) => w.type === "confirmation_card" || w.type === "question_card" || w.type === "question_stepper" || w.type === "context_picker"
                );
                if (hasInteractive) {
                  updated[i] = {
                    ...msg,
                    response: {
                      ...msg.response,
                      widgets: msg.response.widgets.map((w) =>
                        freezeInteractiveWidget(w, request.params as Record<string, unknown> | undefined)
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
        setPendingRequest(null);
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
            (w) => w.type === "confirmation_card" || w.type === "question_card" || w.type === "question_stepper" || w.type === "context_picker"
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
    pendingRequest,
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

function formatParamForDisplay(val: unknown, key: string): string {
  if (val == null || val === "") return "";
  if (key === "amount") {
    const n = typeof val === "number" ? val : Number(String(val).replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? String(val) : `$${n.toFixed(2)}`;
  }
  if (key === "cost_type") {
    const s = String(val);
    return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
  return String(val);
}

function freezeInteractiveWidget(
  w: import("@/types/api").Widget,
  submittedParams?: Record<string, unknown>
): import("@/types/api").Widget {
  if (w.type === "question_stepper") {
    const questions = (w.data.questions as { questionText: string; questionKey: string }[]) ?? [];
    const params = submittedParams ?? (w.data.sessionParams as Record<string, unknown>) ?? {};
    const lines = questions.map((q) => {
      const val = params[q.questionKey];
      const display = formatParamForDisplay(val, q.questionKey);
      return display ? `**${q.questionText}** ${display}` : q.questionText;
    });
    return {
      ...w,
      type: "text_response",
      data: { text: lines.join("\n\n") },
    };
  }
  if (w.type === "question_card") {
    const questionText = w.data.questionText as string | string[];
    const questionKey = w.data.questionKey as string | undefined;
    const params = submittedParams ?? (w.data.sessionParams as Record<string, unknown>) ?? {};
    const questions = Array.isArray(questionText) ? questionText : [questionText];
    const lines = questions.map((q, i) => {
      const key = Array.isArray(questionKey) ? questionKey[i] : questionKey;
      const val = key ? params[key] : undefined;
      const display = key && val != null && val !== "" ? formatParamForDisplay(val, key) : null;
      return typeof q === "string" ? (display ? `**${q}** ${display}` : q) : String(q);
    });
    return {
      ...w,
      type: "text_response",
      data: { text: lines.join("\n\n") },
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

/** Sensitive param keys to exclude from user message display */
const SENSITIVE_PARAM_KEYS = new Set(["access_code", "password", "accessCode", "passwordConfirm"]);

/**
 * Option-aware summary for Q&A completion messages.
 * Returns a human-readable summary (e.g. "Go ahead and add user <email>") instead of
 * echoing the last answer (e.g. access code). Falls back to null to use content or deriveUserContent.
 */
function deriveOptionSummary(
  request: Omit<import("@/types/api").SendMessageRequest, "conversationId">
): string | null {
  if (request.source !== "qa_response" || !request.optionId || !request.params) return null;

  const p = request.params as Record<string, unknown>;
  const opt = request.optionId;

  if (opt === "admin.user.provision") {
    const email = p.email as string | undefined;
    return email ? `Go ahead and add user ${email}` : "Go ahead and provision user";
  }
  if (opt === "admin.user.provision_bulk") {
    const count = Array.isArray(p.users) ? (p.users as unknown[]).length : 0;
    return count > 0 ? `Go ahead and add ${count} user${count !== 1 ? "s" : ""}` : "Go ahead and add users";
  }
  if (opt === "admin.tenant.create") {
    const name = p.name as string | undefined;
    return name ? `Go ahead and create tenant ${name}` : "Go ahead and create tenant";
  }
  if (opt === "admin.costs.record") {
    const amount = p.amount;
    const costType = p.cost_type as string | undefined;
    const periodStart = p.period_start as string | undefined;
    const periodEnd = p.period_end as string | undefined;
    const notes = p.notes as string | undefined;
    const parts: string[] = [];
    if (costType) parts.push(`Cost type: ${String(costType).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`);
    if (amount != null && amount !== "") {
      const n = typeof amount === "number" ? amount : Number(String(amount).replace(/[^0-9.-]/g, ""));
      parts.push(`Amount: $${Number.isNaN(n) ? amount : n.toFixed(2)}`);
    }
    if (periodStart || periodEnd) parts.push(`Period: ${periodStart ?? "?"} to ${periodEnd ?? "?"}`);
    if (notes?.trim()) parts.push(`Notes: ${notes.trim()}`);
    return parts.length > 0 ? parts.join(" · ") : "Go ahead and record system cost";
  }
  if (opt === "activity.create" || opt === "activity.create_bulk") {
    const title = p.title as string | undefined;
    return title ? `Go ahead and add activity: ${title}` : "Go ahead and add activity";
  }
  if (opt === "announcement.create") {
    const title = p.title as string | undefined;
    return title ? `Go ahead and create announcement: ${title}` : "Go ahead and create announcement";
  }
  if (opt === "info_card.create") {
    const title = p.title as string | undefined;
    return title ? `Go ahead and create info card: ${title}` : "Go ahead and create info card";
  }
  if (opt.startsWith("activity.") && opt.endsWith(".edit")) {
    return "Go ahead and save changes";
  }
  if (opt.startsWith("profile.")) {
    return "Go ahead and update profile";
  }
  if (opt.startsWith("admin.")) {
    return "Go ahead and proceed";
  }

  // Fallback: join non-sensitive params (exclude access_code, password, etc.)
  const parts: string[] = [];
  for (const [key, val] of Object.entries(p)) {
    if (key.startsWith("__") || key === "optionId" || key === "sessionParams" || val == null) continue;
    if (SENSITIVE_PARAM_KEYS.has(key)) continue;
    if (Array.isArray(val)) {
      const names = val
        .filter((f): f is Record<string, unknown> => f != null && typeof f === "object")
        .map((f) => (f.originalFilename ?? f.original_filename ?? "file") as string);
      if (names.length > 0) parts.push(`📎 ${names.join(", ")}`);
      else if (val.length > 0) parts.push(val.join(", "));
    } else if (typeof val === "string" && val.trim()) {
      parts.push(val);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
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
      if (SENSITIVE_PARAM_KEYS.has(key)) continue;
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
