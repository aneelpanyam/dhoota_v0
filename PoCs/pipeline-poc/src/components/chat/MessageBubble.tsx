"use client";

import { useState, useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/hooks/use-chat";
import type { WidgetAction, ChatMessageResponse, OptionReference, Widget } from "@/types/api";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { User, Bot, ChevronDown, ChevronUp, MessageSquare, Copy, Check, X, Eye, Bookmark, Sparkles } from "lucide-react";
import type { ContextItem } from "./ContextStrip";

function splitIntoWidgetGroups(widgets: Widget[]): { type: "welcome_messages" | "single"; widgets: Widget[] }[] {
  const groups: { type: "welcome_messages" | "single"; widgets: Widget[] }[] = [];
  let i = 0;
  while (i < widgets.length) {
    if (widgets[i].type === "welcome_message") {
      const batch: Widget[] = [];
      while (i < widgets.length && widgets[i].type === "welcome_message") {
        batch.push(widgets[i]);
        i++;
      }
      groups.push({ type: "welcome_messages", widgets: batch });
    } else {
      groups.push({ type: "single", widgets: [widgets[i]] });
      i++;
    }
  }
  return groups;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLastMessage?: boolean;
  isHidden?: boolean;
  isBookmarked?: boolean;
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
  onHide?: () => void;
  onUnhide?: () => void;
  onPinToContext?: (item: ContextItem) => void;
  onToggleBookmark?: () => void;
}

export function MessageBubble({
  message,
  isLastMessage,
  isHidden,
  isBookmarked,
  representativeAvatarUrl,
  onAction,
  onOptionSelect,
  onConfirm,
  onQAResponse,
  onCancel,
  onHide,
  onUnhide,
  onPinToContext,
  onToggleBookmark,
}: MessageBubbleProps) {
  const [showCollapsed, setShowCollapsed] = useState(false);

  const hideToggle = isHidden ? (
    <button
      onClick={onUnhide}
      className="opacity-0 group-hover/msg:opacity-100 transition p-1 rounded hover:bg-muted"
      title="Unhide message"
    >
      <Eye className="h-3 w-3 text-muted-foreground" />
    </button>
  ) : (
    <button
      onClick={onHide}
      className="opacity-0 group-hover/msg:opacity-100 transition p-1 rounded hover:bg-muted"
      title="Hide message"
    >
      <X className="h-3 w-3 text-muted-foreground" />
    </button>
  );

  if (message.role === "user") {
    const hasContext = message.contextItems && message.contextItems.length > 0;
    return (
      <div className="group/msg flex items-start gap-3 justify-end">
        <div className="flex items-start gap-1 shrink-0 pt-1">
          {hideToggle}
        </div>
        <div className="max-w-[80%] space-y-0">
          {hasContext && (
            <div className="flex items-center gap-1.5 justify-end mb-1.5 flex-wrap">
              <Sparkles className="h-3 w-3 text-primary/60 shrink-0" />
              {message.contextItems!.map((item) => {
                const clickable = !!item.viewAction;
                const Tag = clickable ? "button" : "span";
                return (
                  <Tag
                    key={item.entityId}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] whitespace-nowrap ${
                      clickable ? "hover:bg-primary/20 cursor-pointer transition" : ""
                    }`}
                    title={item.summary}
                    onClick={clickable ? () => onAction({
                      label: `View ${item.label}`,
                      icon: "Eye",
                      optionId: item.viewAction!.optionId,
                      params: item.viewAction!.params,
                    }) : undefined}
                  >
                    <span className="font-medium">{item.entityType}:</span>
                    <span className="max-w-28 truncate">{item.label}</span>
                  </Tag>
                );
              })}
            </div>
          )}
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5">
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        </div>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-primary" />
        </div>
      </div>
    );
  }

  const response = message.response;
  if (!response) return null;

  const collapsed = message.collapsedMessages;
  const hasCollapsed = collapsed && collapsed.length > 0;

  const avatarEl =
    representativeAvatarUrl ? (
      <img
        src={representativeAvatarUrl}
        alt=""
        className="w-8 h-8 rounded-full object-cover shrink-0 bg-secondary"
      />
    ) : (
      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
        <Bot className="h-4 w-4 text-secondary-foreground" />
      </div>
    );

  return (
    <div className="group/msg flex items-start gap-3">
      {avatarEl}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Collapsed conversation toggle */}
        {hasCollapsed && (
          <button
            onClick={() => setShowCollapsed((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition px-2 py-1 rounded-md hover:bg-muted"
          >
            <MessageSquare className="h-3 w-3" />
            {showCollapsed ? "Hide" : "Show"} conversation ({collapsed.length} message{collapsed.length !== 1 ? "s" : ""})
            {showCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        )}

        {/* Collapsed messages (expanded view) */}
        {hasCollapsed && showCollapsed && (
          <div className="border-l-2 border-muted pl-3 space-y-2 py-1">
            {collapsed.map((cm) => (
              <CollapsedMessage key={cm.id} message={cm} />
            ))}
          </div>
        )}

        {/* Main widgets */}
        {(() => {
          const widgets = response.widgets;
          const groups = splitIntoWidgetGroups(widgets);
          const injectAvatar = (w: Widget) =>
            w.type === "welcome_message"
              ? { ...w, data: { ...w.data, representativeAvatarUrl: representativeAvatarUrl ?? undefined } }
              : w;
          return groups.map((group, i) =>
            group.type === "welcome_messages" && group.widgets.length > 1 ? (
              <div key={`welcome-group-${i}`} className="">
                {group.widgets.map((widget) => (
                  <WidgetRenderer
                    key={widget.id}
                    widget={injectAvatar(widget)}
                    onAction={onAction}
                    onOptionSelect={onOptionSelect}
                    onConfirm={onConfirm}
                    onQAResponse={onQAResponse}
                    onCancel={onCancel}
                    onPinToContext={onPinToContext}
                  />
                ))}
              </div>
            ) : (
              group.widgets.map((widget) => (
                <WidgetRenderer
                  key={widget.id}
                  widget={injectAvatar(widget)}
                  onAction={onAction}
                  onOptionSelect={onOptionSelect}
                  onConfirm={onConfirm}
                  onQAResponse={onQAResponse}
                  onCancel={onCancel}
                  onPinToContext={onPinToContext}
                />
              ))
            )
          );
        })()}

        <NextActionsSection
          response={response}
          isLastMessage={!!isLastMessage}
          onOptionSelect={onOptionSelect}
        />

        {response.traceId && <TraceIdBadge traceId={response.traceId} />}
      </div>
      <div className="flex items-start gap-0.5 pt-1 shrink-0">
        {onToggleBookmark && (
          <button
            onClick={onToggleBookmark}
            className={`transition p-1 rounded hover:bg-muted ${
              isBookmarked
                ? "text-primary"
                : "opacity-0 group-hover/msg:opacity-100 text-muted-foreground"
            }`}
            title={isBookmarked ? "Remove bookmark" : "Bookmark message"}
          >
            <Bookmark className={`h-3 w-3 ${isBookmarked ? "fill-current" : ""}`} />
          </button>
        )}
        {hideToggle}
      </div>
    </div>
  );
}

function NextActionsSection({
  response,
  isLastMessage,
  onOptionSelect,
}: {
  response: ChatMessageResponse;
  isLastMessage: boolean;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showOtherOptions, setShowOtherOptions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const canShowDefaultOptions =
    isLastMessage &&
    response.conversationState === "active" &&
    response.defaultOptions.length > 0 &&
    !response.widgets.some((w) => w.type === "default_options_menu");

  const hasFollowUps = response.followUps.length > 0;
  const hasDefaultOpts = canShowDefaultOptions;
  // When no follow-ups: show default options inline. When follow-ups exist: show them + expandable "Other options"
  const showDefaultOptionsInline = hasDefaultOpts && !hasFollowUps;
  const showOtherOptionsTrigger = hasFollowUps && hasDefaultOpts;
  const hasAny = hasFollowUps || showDefaultOptionsInline || showOtherOptionsTrigger;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  if (!hasAny) return null;

  const renderFollowUp = (fu: OptionReference) => {
    const activityId = fu.params?.activity_id as string | undefined;
    const activityCard = activityId
      ? response.widgets?.find(
          (w) => w.type === "activity_card" && (w.data?.id as string) === activityId
        )?.data
      : undefined;
    const activityDate = activityCard?.activity_date ?? activityCard?.activityDate;
    const contextItems = activityCard?.title
      ? [
          {
            entityType: "activity",
            entityId: (activityCard.id as string) ?? activityId!,
            label: (activityCard.title as string) ?? "Activity",
            summary:
              [activityCard.status, activityDate].filter(Boolean).length > 0
                ? [
                    activityCard.status,
                    activityDate
                      ? new Date(activityDate as string).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : "",
            viewAction: {
              optionId: "activity.view",
              params: { activity_id: (activityCard.id as string) ?? activityId! },
            },
          },
        ]
      : undefined;
    return (
      <button
        key={fu.optionId}
        onClick={() => {
          setDropdownOpen(false);
          onOptionSelect(fu.optionId, {
            ...fu.params,
            ...(contextItems && { __contextItems: contextItems }),
          });
        }}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted transition"
      >
        {fu.name}
      </button>
    );
  };

  const renderDefaultOpt = (opt: OptionReference) => (
    <button
      key={opt.optionId}
      onClick={() => {
        setDropdownOpen(false);
        onOptionSelect(opt.optionId, opt.params);
      }}
      className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted transition"
    >
      {opt.name}
    </button>
  );

  return (
    <div className="pt-1 space-y-2">
      {/* Desktop: inline buttons */}
      <div className="hidden md:flex flex-wrap gap-2 items-center">
        {hasFollowUps &&
          response.followUps.map((fu) => {
            const activityId = fu.params?.activity_id as string | undefined;
            const activityCard = activityId
              ? response.widgets?.find(
                  (w) => w.type === "activity_card" && (w.data?.id as string) === activityId
                )?.data
              : undefined;
            const activityDate = activityCard?.activity_date ?? activityCard?.activityDate;
            const contextItems = activityCard?.title
              ? [
                  {
                    entityType: "activity",
                    entityId: (activityCard.id as string) ?? activityId!,
                    label: (activityCard.title as string) ?? "Activity",
                    summary:
                      [activityCard.status, activityDate].filter(Boolean).length > 0
                        ? [
                            activityCard.status,
                            activityDate
                              ? new Date(activityDate as string).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "",
                    viewAction: {
                      optionId: "activity.view",
                      params: { activity_id: (activityCard.id as string) ?? activityId! },
                    },
                  },
                ]
              : undefined;
            return (
              <button
                key={fu.optionId}
                onClick={() =>
                  onOptionSelect(fu.optionId, {
                    ...fu.params,
                    ...(contextItems && { __contextItems: contextItems }),
                  })
                }
                className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition"
              >
                {fu.name}
              </button>
            );
          })}
        {showDefaultOptionsInline &&
          response.defaultOptions.map((opt) => (
            <button
              key={opt.optionId}
              onClick={() => onOptionSelect(opt.optionId, opt.params)}
              className="text-xs px-3 py-1.5 rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition"
            >
              {opt.name}
            </button>
          ))}
        {showOtherOptionsTrigger && (
          <>
            {!showOtherOptions ? (
              <button
                onClick={() => setShowOtherOptions(true)}
                className="text-xs px-3 py-1.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition"
              >
                More options
              </button>
            ) : (
              <>
                <span className="text-[10px] text-muted-foreground/60 px-1">— or —</span>
                {response.defaultOptions.map((opt) => (
                  <button
                    key={opt.optionId}
                    onClick={() => onOptionSelect(opt.optionId, opt.params)}
                    className="text-xs px-3 py-1.5 rounded-full border border-muted-foreground/30 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition"
                  >
                    {opt.name}
                  </button>
                ))}
                <button
                  onClick={() => setShowOtherOptions(false)}
                  className="text-xs px-3 py-1.5 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition"
                >
                  Show less
                </button>
              </>
            )}
          </>
        )}
      </div>
      {/* Mobile: dropdown */}
      <div ref={dropdownRef} className="md:hidden relative">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition text-sm"
        >
          Next actions
          <ChevronDown className={`h-3 w-3 transition ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute left-0 top-full mt-1 py-1 rounded-lg border bg-card shadow-lg z-50 min-w-[200px] overflow-hidden">
            {hasFollowUps && response.followUps.map((fu) => renderFollowUp(fu))}
            {hasDefaultOpts && response.defaultOptions.map((opt) => renderDefaultOpt(opt))}
          </div>
        )}
      </div>
    </div>
  );
}

function TraceIdBadge({ traceId }: { traceId: string }) {
  const [copied, setCopied] = useState(false);
  const shortId = traceId.slice(0, 8);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="group flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition mt-1"
      title={`Trace: ${traceId} (click to copy)`}
    >
      {copied ? (
        <Check className="h-2.5 w-2.5" />
      ) : (
        <Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition" />
      )}
      <span className="font-mono">{copied ? "Copied!" : shortId}</span>
    </button>
  );
}

function CollapsedMessage({ message }: { message: ChatMessage }) {
  if (message.role === "user" && message.content) {
    return (
      <div className="flex items-start gap-2">
        <User className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">{message.content}</p>
      </div>
    );
  }

  if (message.response) {
    const textWidgets = message.response.widgets.filter((w) => w.type === "text_response");
    const text = textWidgets.map((w) => (w.data.text as string) ?? "").filter(Boolean).join(" ");
    if (text) {
      return (
        <div className="flex items-start gap-2">
          <Bot className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground line-clamp-2">{text}</p>
        </div>
      );
    }

    const otherTypes = message.response.widgets
      .filter((w) => w.type !== "text_response")
      .map((w) => w.type.replace(/_/g, " "));
    if (otherTypes.length > 0) {
      return (
        <div className="flex items-start gap-2">
          <Bot className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground italic">[{otherTypes.join(", ")}]</p>
        </div>
      );
    }
  }

  return null;
}
