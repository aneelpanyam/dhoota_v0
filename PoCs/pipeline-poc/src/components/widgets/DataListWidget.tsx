"use client";

import { useState } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import type { ContextItem } from "@/components/chat/ContextStrip";
import {
  Eye, Pencil, MessageSquare, ChevronLeft, ChevronRight,
  Calendar, MapPin, Image as ImageIcon, ChevronDown, ChevronUp, Pin,
  PlusCircle, MinusCircle, Trash2, CalendarDays, CalendarPlus,
  UserPlus, UserCog, Users, Reply, Key, ShieldOff, RefreshCw,
  ToggleLeft, List, FileText, MessageSquarePlus, MessageCircle,
  Smartphone, Zap, Clock, BarChart3, Bookmark, ExternalLink,
} from "lucide-react";
import { EditActivityFormWidget } from "./EditActivityFormWidget";
import { ActivityCalendarView } from "./ActivityCalendarView";
import { ActivityTimelineView } from "./ActivityTimelineView";
import { ActivityStatsBar } from "./ActivityStatsBar";

type ActivityViewMode = "list" | "calendar" | "timeline" | "stats";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
  onPinToContext?: (item: ContextItem) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye, Pencil, MessageSquare, Image: ImageIcon,
  PlusCircle, MinusCircle, Trash2, CalendarDays, CalendarPlus,
  UserPlus, UserCog, Users, Reply, Key, ShieldOff, RefreshCw,
  ToggleLeft, List, FileText, MessageSquarePlus, MessageCircle,
  Smartphone, Zap, Calendar, Pin,
};

const statusColors: Record<string, string> = {
  planned: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-100 text-gray-500",
  archived: "bg-gray-100 text-gray-500",
  requested: "bg-blue-100 text-blue-700",
  processing: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
  new: "bg-blue-100 text-blue-700",
  reviewed: "bg-green-100 text-green-700",
  resolved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  revoked: "bg-red-100 text-red-700",
  open: "bg-blue-100 text-blue-700",
  closed: "bg-gray-100 text-gray-500",
};

const subscriptionColors: Record<string, string> = {
  free: "bg-gray-100 text-gray-600",
  basic: "bg-blue-100 text-blue-700",
  standard: "bg-indigo-100 text-indigo-700",
  premium: "bg-purple-100 text-purple-700",
};

const userTypeColors: Record<string, string> = {
  worker: "bg-emerald-100 text-emerald-700",
  candidate: "bg-sky-100 text-sky-700",
  representative: "bg-amber-100 text-amber-700",
  team_worker: "bg-teal-100 text-teal-700",
  citizen: "bg-orange-100 text-orange-700",
  anonymous: "bg-gray-100 text-gray-500",
  system_admin: "bg-red-100 text-red-700",
};

function getBadgeColor(key: string, value: string): string {
  const normalized = value.toLowerCase().replace(/ /g, "_");
  if (key === "subscription") return subscriptionColors[normalized] ?? "bg-primary/10 text-primary";
  if (key === "user_type") return userTypeColors[normalized] ?? "bg-primary/10 text-primary";
  return statusColors[normalized] ?? "bg-primary/10 text-primary";
}

const COUNT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  user_count: Users,
  message_count: MessageCircle,
  suggestion_count: MessageSquarePlus,
  new_count: Zap,
  note_count: FileText,
  member_count: Users,
  media_count: ImageIcon,
  activity_count: Calendar,
  execution_count: Zap,
  error_count: ShieldOff,
  call_count: Zap,
};

function buildContextItem(
  item: Record<string, unknown>,
  columns: { key: string; label: string }[],
  viewAction?: ContextItem["viewAction"],
): ContextItem {
  const label = (item.title ?? item.name ?? item.display_name ?? item.email ?? item.slug ?? item.id ?? "Item") as string;
  const summaryParts = columns.map((c) => `${c.label}: ${item[c.key] ?? "-"}`);
  return {
    entityType: "list-item",
    entityId: String(item.id ?? label),
    label,
    summary: summaryParts.join("; "),
    viewAction,
  };
}

const VIEW_MODES: { id: ActivityViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "stats", label: "Summary", icon: BarChart3 },
];

export function DataListWidget({ widget, onAction, onOptionSelect, onConfirm, onPinToContext }: Props) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ActivityViewMode>("list");
  const d = widget.data;
  const items = (d.items as Record<string, unknown>[]) ?? [];
  const columns = (d.columns as { key: string; label: string }[]) ?? [];
  const totalItems = (d.totalItems as number) ?? items.length;
  const page = (d.page as number) ?? 1;
  const pageSize = (d.pageSize as number) ?? 10;

  const viewOptionId = d.viewOptionId as string | undefined;
  const viewParamKey = d.viewParamKey as string | undefined;
  const editOptionId = d.editOptionId as string | undefined;
  const editParamKey = d.editParamKey as string | undefined;
  const paginationOptionId = d.paginationOptionId as string | undefined;
  const noPin = !!d._noPin;
  const effectiveOnPinToContext = noPin ? undefined : onPinToContext;

  const hasActivityFields = items.length > 0 && "activity_date" in items[0] && "title" in items[0];
  const hasTagFields = items.length > 0 && ("color" in items[0] && "source" in items[0]);
  const hasBookmarkFields = items.length > 0 && "_entity_type_raw" in items[0];
  const hasNoteFields = items.length > 0 && "_is_note" in items[0] && "content" in items[0];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
        No items to display.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* View mode tabs for activity lists */}
      {hasActivityFields && items.length > 0 && (
        <div className="flex items-center gap-0.5 px-3 pt-3 pb-1">
          {VIEW_MODES.map((mode) => {
            const Icon = mode.icon;
            const isActive = viewMode === mode.id;
            return (
              <button
                key={mode.id}
                onClick={() => setViewMode(mode.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }
                `}
              >
                <Icon className="h-3.5 w-3.5" />
                {mode.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Alternative views for activities */}
      {hasActivityFields && viewMode === "calendar" && (
        <div className="p-3">
          <ActivityCalendarView
            items={items as Parameters<typeof ActivityCalendarView>[0]["items"]}
            actions={widget.actions}
            onAction={onAction}
          />
        </div>
      )}

      {hasActivityFields && viewMode === "timeline" && (
        <div className="p-3">
          <ActivityTimelineView
            items={items as Parameters<typeof ActivityTimelineView>[0]["items"]}
            actions={widget.actions}
            onAction={onAction}
          />
        </div>
      )}

      {hasActivityFields && viewMode === "stats" && (
        <div className="p-3">
          <ActivityStatsBar
            items={items as Parameters<typeof ActivityStatsBar>[0]["items"]}
          />
        </div>
      )}

      {/* Default list view (or non-activity lists) */}
      {(viewMode === "list" || !hasActivityFields) && (
        <>
          <div className="divide-y">
            {items.map((item, idx) => (
              <div key={item.id as string ?? idx} className="px-4 py-3 hover:bg-muted/30 transition">
                {editingItemId === item.id ? (
                  <EditActivityFormWidget
                    activity={{
                      id: item.id as string,
                      title: (item.title as string) ?? "",
                      description: item.description as string | null,
                      activity_date: item.activity_date as string | null,
                      location: item.location as string | null,
                      status: (item.status as string) ?? "completed",
                      visibility: (item.visibility as string) ?? "private",
                    }}
                    onSave={(optionId, params) => {
                      setEditingItemId(null);
                      onConfirm(optionId, params);
                    }}
                    onCancel={() => setEditingItemId(null)}
                  />
                ) : hasNoteFields ? (
                  <NoteListItem
                    item={item}
                    onAction={onAction}
                    onPinToContext={effectiveOnPinToContext}
                    columns={columns}
                  />
                ) : hasBookmarkFields ? (
                  <BookmarkListItem
                    item={item}
                    actions={widget.actions}
                    onAction={onAction}
                  />
                ) : hasTagFields ? (
                  <TagListItem item={item} onOptionSelect={onOptionSelect} onPinToContext={effectiveOnPinToContext} columns={columns} />
                ) : hasActivityFields ? (
                  <ActivityListItem
                    item={item}
                    actions={widget.actions}
                    onAction={onAction}
                    onEdit={() => setEditingItemId(item.id as string)}
                    onPinToContext={effectiveOnPinToContext}
                    columns={columns}
                  />
                ) : (
                  <GenericListItem
                    item={item}
                    columns={columns}
                    actions={widget.actions}
                    onAction={onAction}
                    onOptionSelect={onOptionSelect}
                    onEdit={() => setEditingItemId(item.id as string)}
                    viewOptionId={viewOptionId}
                    viewParamKey={viewParamKey}
                    editOptionId={editOptionId}
                    editParamKey={editParamKey}
                    onPinToContext={effectiveOnPinToContext}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
            {totalItems > pageSize ? (
              <>
                <span>
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalItems)} of {totalItems}
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={page <= 1}
                    onClick={() => paginationOptionId && onOptionSelect(paginationOptionId, { page: page - 1, pageSize })}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={page * pageSize >= totalItems}
                    onClick={() => paginationOptionId && onOptionSelect(paginationOptionId, { page: page + 1, pageSize })}
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <span>{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
            )}
            {effectiveOnPinToContext && items.length > 0 && (
              <button
                onClick={() => {
                  for (const item of items) {
                    const activityId = hasActivityFields ? (item.id as string | undefined) : undefined;
                    const viewAction = activityId ? { optionId: "activity.view", params: { activity_id: activityId } } : undefined;
                    effectiveOnPinToContext(buildContextItem(item, columns, viewAction));
                  }
                }}
                className="flex items-center gap-1 text-primary/70 hover:text-primary transition"
                title="Pin all to context for insights"
              >
                <Pin className="h-3 w-3" />
                Pin all
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ActivityListItem({
  item,
  actions,
  onAction,
  onEdit,
  onPinToContext,
  columns,
}: {
  item: Record<string, unknown>;
  actions?: WidgetAction[];
  onAction: (action: WidgetAction) => void;
  onEdit: () => void;
  onPinToContext?: (item: ContextItem) => void;
  columns: { key: string; label: string }[];
}) {
  const title = (item.title as string) ?? "Untitled";
  const status = item.status as string | undefined;
  const date = (item.activity_date ?? item.activityDate) as string | undefined;
  const location = item.location as string | undefined;
  const tags = Array.isArray(item.tags) ? item.tags as { name: string; color?: string }[] : [];
  const noteCount = (item.note_count ?? item.noteCount ?? 0) as number;
  const mediaCount = (item.media_count ?? item.mediaCount ?? 0) as number;
  const description = item.description as string | undefined;
  const media = Array.isArray(item.media) ? item.media as Record<string, unknown>[] : [];
  const thumbUrl = getFirstImageUrl(media);

  const handleViewClick = () => {
    const activityId = item.id as string;
    if (!activityId) return;

    const viewAction = actions?.find((a) => a.optionId === "activity.view");
    onAction({
      label: viewAction?.label ?? "View Activity Details",
      icon: viewAction?.icon ?? "Eye",
      optionId: "activity.view",
      targetResourceId: activityId,
      params: { activity_id: activityId },
    });
  };

  return (
    <div className="flex items-start gap-3">
      {thumbUrl && (
        <div
          className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted cursor-pointer"
          onClick={handleViewClick}
        >
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-1 cursor-pointer" onClick={handleViewClick}>
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate hover:text-primary transition">{title}</p>
          {status && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${statusColors[status] ?? "bg-gray-100"}`}>
              {status.replace("_", " ")}
            </span>
          )}
        </div>

        {description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          {date && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {location}
            </span>
          )}
          {mediaCount > 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3 w-3" />
              {mediaCount}
            </span>
          )}
          {noteCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {noteCount}
            </span>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {tags.slice(0, 4).map((tag) => (
              <span
                key={tag.name}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted"
                style={{ color: tag.color }}
              >
                {tag.name}
              </span>
            ))}
            {tags.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{tags.length - 4}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-1 shrink-0">
        {onPinToContext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const activityId = item.id as string | undefined;
              onPinToContext(buildContextItem(item, columns, activityId ? { optionId: "activity.view", params: { activity_id: activityId } } : undefined));
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition"
            title="Pin to context for insights"
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        )}
        <ItemActions actions={actions} item={item} onAction={onAction} onEdit={onEdit} />
      </div>
    </div>
  );
}

function TagListItem({
  item,
  onOptionSelect,
  onPinToContext,
  columns,
}: {
  item: Record<string, unknown>;
  onOptionSelect?: (optionId: string, params?: Record<string, unknown>) => void;
  onPinToContext?: (item: ContextItem) => void;
  columns: { key: string; label: string }[];
}) {
  const name = (item.name as string) ?? "Tag";
  const color = (item.color as string) ?? "#888";
  const source = (item.source as string) ?? "system";
  const count = (item.activity_count as number) ?? 0;

  const handleDrillDown = () => {
    onOptionSelect?.("analysis.activities", { tag: name });
  };

  return (
    <div
      className={`flex items-center gap-3 ${onOptionSelect ? "cursor-pointer group" : ""}`}
      onClick={onOptionSelect ? handleDrillDown : undefined}
    >
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm group-hover:text-primary transition">{name}</span>
          {source !== "system" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              custom
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1.5">
        {count} activit{count === 1 ? "y" : "ies"}
        {onOptionSelect && count > 0 && (
          <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
        )}
      </span>
      {onPinToContext && (
        <button
          onClick={(e) => { e.stopPropagation(); onPinToContext(buildContextItem(item, columns)); }}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition shrink-0"
          title="Pin to context for insights"
        >
          <Pin className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function NoteListItem({
  item,
  onAction,
  onPinToContext,
  columns,
}: {
  item: Record<string, unknown>;
  onAction: (action: WidgetAction) => void;
  onPinToContext?: (item: ContextItem) => void;
  columns: { key: string; label: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const content = (item.content as string) ?? "";
  const activityTitle = (item.activity_title as string) ?? "Activity";
  const activityId = item.activity_id as string | undefined;
  const activityStatus = item.activity_status as string | undefined;
  const createdAt = item.created_at as string | undefined;

  const isLong = content.length > 150;
  const displayContent = expanded ? content : content.slice(0, 150);

  const handleViewActivity = () => {
    if (!activityId) return;
    onAction({
      label: "View Activity",
      icon: "Eye",
      optionId: "activity.view",
      targetResourceId: activityId,
      params: { activity_id: activityId },
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
          <MessageSquare className="h-4 w-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm leading-relaxed text-foreground">
            {displayContent}
            {isLong && !expanded && "..."}
          </p>
          {isLong && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
              className="text-[11px] text-primary/70 hover:text-primary transition"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {activityId && (
              <button
                onClick={(e) => { e.stopPropagation(); handleViewActivity(); }}
                className="flex items-center gap-1 hover:text-primary transition"
              >
                <Eye className="h-3 w-3" />
                <span className="truncate max-w-[180px]">{activityTitle}</span>
                {activityStatus && (
                  <span className={`text-[10px] px-1 py-0 rounded-full ml-0.5 ${statusColors[activityStatus] ?? "bg-gray-100"}`}>
                    {activityStatus.replace("_", " ")}
                  </span>
                )}
              </button>
            )}
            {createdAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
        {onPinToContext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPinToContext(buildContextItem(
                item,
                columns,
                activityId ? { optionId: "activity.view", params: { activity_id: activityId } } : undefined
              ));
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition shrink-0"
            title="Pin to context for insights"
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

const ENTITY_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  message: MessageSquare,
  activity: Calendar,
  conversation: MessageCircle,
  report: FileText,
};

const ENTITY_TYPE_COLORS: Record<string, string> = {
  message: "bg-blue-100 text-blue-700",
  activity: "bg-green-100 text-green-700",
  conversation: "bg-purple-100 text-purple-700",
  report: "bg-orange-100 text-orange-700",
};

function BookmarkListItem({
  item,
  actions,
  onAction,
}: {
  item: Record<string, unknown>;
  actions?: WidgetAction[];
  onAction: (action: WidgetAction) => void;
}) {
  const label = (item.label as string) ?? "Untitled bookmark";
  const entityType = (item._entity_type_raw as string) ?? "unknown";
  const entityId = item._entity_id as string | undefined;
  const conversationId = item._conversation_id as string | undefined;
  const displayType = (item.entity_type as string) ?? entityType;
  const createdAt = item.created_at as string | undefined;
  const TypeIcon = ENTITY_TYPE_ICONS[entityType] ?? Bookmark;
  const badgeColor = ENTITY_TYPE_COLORS[entityType] ?? "bg-gray-100 text-gray-600";

  const isClickable = (entityType === "activity" && !!entityId)
    || (entityType === "message" && !!conversationId)
    || (entityType === "conversation" && !!entityId);

  const handleClick = () => {
    if (!isClickable) return;

    if (entityType === "activity" && entityId) {
      onAction({
        label: "View Activity",
        icon: "Eye",
        optionId: "activity.view",
        params: { activity_id: entityId },
        targetResourceId: entityId,
      });
    } else if (entityType === "message" && conversationId) {
      onAction({
        label: "Open Conversation",
        icon: "MessageSquare",
        optionId: "_load_conversation",
        params: { conversationId },
        targetResourceId: conversationId,
      });
    } else if (entityType === "conversation" && entityId) {
      onAction({
        label: "Open Conversation",
        icon: "MessageSquare",
        optionId: "_load_conversation",
        params: { conversationId: entityId },
        targetResourceId: entityId,
      });
    }
  };

  return (
    <div
      className={`flex items-center gap-3 ${isClickable ? "cursor-pointer" : ""}`}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${badgeColor}`}>
        <TypeIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className={`font-medium text-sm truncate ${isClickable ? "hover:text-primary transition" : ""}`}>
            {label}
          </p>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${badgeColor}`}>
            {displayType}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {createdAt && (
            <span>
              Saved {new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          )}
          {isClickable && (
            <span className="flex items-center gap-0.5 text-primary/60">
              <ExternalLink className="h-2.5 w-2.5" />
              Open
            </span>
          )}
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        {actions?.map((action, ai) => {
          const Icon = iconMap[action.icon] ?? Zap;
          return (
            <button
              key={ai}
              onClick={(e) => {
                e.stopPropagation();
                onAction({
                  ...action,
                  targetResourceId: item.id as string,
                  params: action.paramKey
                    ? { [action.paramKey]: item.id, ...action.params }
                    : { ...action.params },
                });
              }}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
              title={action.label}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function getFirstImageUrl(media: Record<string, unknown>[]): string | null {
  for (const m of media) {
    const mime = (m.mimeType ?? m.mime_type ?? "") as string;
    if (!mime.startsWith("image/")) continue;
    if (typeof m.url === "string" && m.url.startsWith("http")) return m.url;
    const key = (m.s3_key ?? m.s3Key) as string | undefined;
    if (key) return `/api/media/serve?key=${encodeURIComponent(key)}`;
  }
  return null;
}

function ExpandableJson({ label, data }: { label: string; data: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const summary = Array.isArray(data)
    ? `${data.length} item${data.length !== 1 ? "s" : ""}`
    : typeof data === "object" && data !== null
      ? `${Object.keys(data).length} field${Object.keys(data).length !== 1 ? "s" : ""}`
      : String(data);

  return (
    <div className="w-full mt-1">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v); }}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <span className="opacity-60">{label}:</span>
        <span>{summary}</span>
      </button>
      {expanded && (
        <pre className="mt-1 p-2 rounded-lg bg-muted/50 text-[10px] leading-relaxed text-muted-foreground overflow-x-auto max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

const TITLE_KEYS = new Set(["name", "title", "label", "display_name", "email", "slug", "option_name", "box_title", "tenant_name"]);
const BADGE_KEYS = new Set([
  "status", "user_type", "subscription", "visibility", "type",
  "card_type", "report_type", "author_type", "suggestion_status",
  "entity_type",
]);
const BOOLEAN_KEYS = new Set([
  "is_active", "pinned", "enabled", "override_enabled", "success",
]);

function formatCellValue(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (key.includes("cost")) return `$${value.toFixed(4)}`;
    if (key.includes("avg")) return value.toFixed(0);
    return String(value);
  }
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return new Date(value).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "—";
    if (typeof value[0] === "string") return value.join(", ");
    return `${value.length} items`;
  }
  return String(value ?? "—");
}

function GenericListItem({
  item,
  columns,
  actions,
  onAction,
  onOptionSelect,
  onEdit,
  viewOptionId,
  viewParamKey,
  editOptionId,
  editParamKey,
  onPinToContext,
}: {
  item: Record<string, unknown>;
  columns: { key: string; label: string }[];
  actions?: WidgetAction[];
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onEdit: () => void;
  viewOptionId?: string;
  viewParamKey?: string;
  editOptionId?: string;
  editParamKey?: string;
  onPinToContext?: (item: ContextItem) => void;
}) {
  const titleCol = columns.find((c) => TITLE_KEYS.has(c.key));
  const subtitleCol = titleCol
    ? columns.find((c) => c !== titleCol && TITLE_KEYS.has(c.key))
    : undefined;
  const excluded = new Set([titleCol, subtitleCol].filter(Boolean));
  const restCols = columns.filter((c) => !excluded.has(c));

  const clickOptionId = viewOptionId ?? editOptionId;
  const clickParamKey = viewOptionId ? viewParamKey : editParamKey;
  const isClickable = !!clickOptionId && !!item.id;

  const resolveParamValue = (paramKey: string | undefined): unknown => {
    if (!paramKey) return item.id;
    if (paramKey in item && item[paramKey] != null) return item[paramKey];
    return item.id;
  };

  const handleClick = () => {
    if (!clickOptionId || !item.id) return;
    const value = resolveParamValue(clickParamKey);
    const params = clickParamKey ? { [clickParamKey]: value } : { id: item.id };
    onOptionSelect(clickOptionId, params);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editOptionId && editParamKey && item.id) {
      const value = resolveParamValue(editParamKey);
      onOptionSelect(editOptionId, { [editParamKey]: value });
    }
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 ${isClickable ? "cursor-pointer" : ""}`}
      onClick={isClickable ? handleClick : undefined}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {titleCol && item[titleCol.key] != null && (
            <p className={`font-medium text-sm truncate ${isClickable ? "hover:text-primary transition" : ""} ${item.deleted_at ? "line-through opacity-60" : ""}`}>
              {String(item[titleCol.key])}
            </p>
          )}
          {subtitleCol && item[subtitleCol.key] != null && (
            <span className="text-[11px] text-muted-foreground truncate">
              {String(item[subtitleCol.key])}
            </span>
          )}
          {item.deleted_at && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">
              deactivated
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {restCols.map((col) => {
            const value = item[col.key];
            if (value === undefined || value === null) return null;

            if (col.key === "tags" && Array.isArray(value)) {
              return (
                <div key={col.key} className="flex gap-1">
                  {(value as { name: string; color?: string }[]).slice(0, 3).map((tag) => (
                    <span key={tag.name} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted" style={{ color: tag.color }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              );
            }

            if (col.key === "user_types" && Array.isArray(value)) {
              return (
                <div key={col.key} className="flex gap-1">
                  {(value as string[]).slice(0, 3).map((ut) => (
                    <span key={ut} className={`text-[10px] px-1.5 py-0.5 rounded-full ${userTypeColors[ut] ?? "bg-primary/10 text-primary"}`}>
                      {ut.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              );
            }

            if (BADGE_KEYS.has(col.key)) {
              const strVal = String(value);
              return (
                <span key={col.key} className={`text-[10px] px-1.5 py-0.5 rounded-full ${getBadgeColor(col.key, strVal)}`}>
                  {strVal.replace(/_/g, " ")}
                </span>
              );
            }

            if (BOOLEAN_KEYS.has(col.key)) {
              const active = value === true || value === "true";
              return (
                <span key={col.key} className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {col.label}: {active ? "Yes" : "No"}
                </span>
              );
            }

            if ((col.key.endsWith("_count") || col.key === "count") && typeof value === "number") {
              const CountIcon = COUNT_ICONS[col.key];
              return (
                <span key={col.key} className="text-[11px] text-muted-foreground flex items-center gap-1">
                  {CountIcon && <CountIcon className="h-3 w-3" />}
                  {value} {col.label.toLowerCase()}
                </span>
              );
            }

            if (typeof value === "object" && value !== null) {
              return <ExpandableJson key={col.key} label={col.label} data={value} />;
            }

            return (
              <span key={col.key} className="text-[11px] text-muted-foreground">
                <span className="opacity-60">{col.label}: </span>{formatCellValue(col.key, value)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex gap-1 shrink-0">
        {onPinToContext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const genericViewAction = viewOptionId && item.id
                ? { optionId: viewOptionId, params: viewParamKey ? { [viewParamKey]: item.id } : { id: item.id } }
                : undefined;
              onPinToContext(buildContextItem(item, columns, genericViewAction));
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition"
            title="Pin to context for insights"
          >
            <Pin className="h-3.5 w-3.5" />
          </button>
        )}
        {editOptionId && editParamKey && item.id && viewOptionId && (
          <button
            onClick={handleEditClick}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <ItemActions actions={actions} item={item} onAction={onAction} onEdit={onEdit} />
      </div>
    </div>
  );
}

function ItemActions({
  actions,
  item,
  onAction,
  onEdit,
}: {
  actions?: WidgetAction[];
  item: Record<string, unknown>;
  onAction: (action: WidgetAction) => void;
  onEdit: () => void;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex gap-1 shrink-0">
      {actions.map((action, ai) => {
        const Icon = iconMap[action.icon] ?? Zap;
        const isEdit = action.optionId === "activity.edit";
        return (
          <button
            key={ai}
            onClick={(e) => {
              e.stopPropagation();
              if (isEdit) {
                onEdit();
              } else {
                onAction({
                  ...action,
                  targetResourceId: item.id as string,
                  params: action.paramKey
                    ? { [action.paramKey]: item.id, ...action.params }
                    : { ...action.params },
                });
              }
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title={action.label}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
