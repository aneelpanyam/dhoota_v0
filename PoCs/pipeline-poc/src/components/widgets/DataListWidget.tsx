"use client";

import { useState } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import {
  Eye, Pencil, MessageSquare, ChevronLeft, ChevronRight,
  Calendar, MapPin, Image as ImageIcon,
} from "lucide-react";
import { EditActivityFormWidget } from "./EditActivityFormWidget";

// Media URLs are resolved via API proxy to handle S3 auth

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye, Pencil, MessageSquare, Image: ImageIcon,
};

const statusColors: Record<string, string> = {
  planned: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

export function DataListWidget({ widget, onAction, onConfirm }: Props) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const d = widget.data;
  const items = (d.items as Record<string, unknown>[]) ?? [];
  const columns = (d.columns as { key: string; label: string }[]) ?? [];
  const totalItems = (d.totalItems as number) ?? items.length;
  const page = (d.page as number) ?? 1;
  const pageSize = (d.pageSize as number) ?? 10;

  const hasActivityFields = items.length > 0 && ("status" in items[0] || "activity_date" in items[0]);
  const hasTagFields = items.length > 0 && ("color" in items[0] && "source" in items[0]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
        No items to display.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
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
            ) : hasTagFields ? (
              <TagListItem item={item} />
            ) : hasActivityFields ? (
              <ActivityListItem
                item={item}
                actions={widget.actions}
                onAction={onAction}
                onEdit={() => setEditingItemId(item.id as string)}
              />
            ) : (
              <GenericListItem
                item={item}
                columns={columns}
                actions={widget.actions}
                onAction={onAction}
                onEdit={() => setEditingItemId(item.id as string)}
              />
            )}
          </div>
        ))}
      </div>

      {totalItems > pageSize && (
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalItems)} of {totalItems}
          </span>
          <div className="flex gap-1">
            <button disabled={page <= 1} className="p-1 rounded hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button disabled={page * pageSize >= totalItems} className="p-1 rounded hover:bg-muted disabled:opacity-30">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityListItem({
  item,
  actions,
  onAction,
  onEdit,
}: {
  item: Record<string, unknown>;
  actions?: WidgetAction[];
  onAction: (action: WidgetAction) => void;
  onEdit: () => void;
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

      <ItemActions actions={actions} item={item} onAction={onAction} onEdit={onEdit} />
    </div>
  );
}

function TagListItem({ item }: { item: Record<string, unknown> }) {
  const name = (item.name as string) ?? "Tag";
  const color = (item.color as string) ?? "#888";
  const source = (item.source as string) ?? "system";
  const count = (item.activity_count as number) ?? 0;

  return (
    <div className="flex items-center gap-3">
      <span
        className="w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{name}</span>
          {source !== "system" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              custom
            </span>
          )}
        </div>
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {count} activit{count === 1 ? "y" : "ies"}
      </span>
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

function GenericListItem({
  item,
  columns,
  actions,
  onAction,
  onEdit,
}: {
  item: Record<string, unknown>;
  columns: { key: string; label: string }[];
  actions?: WidgetAction[];
  onAction: (action: WidgetAction) => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        {columns.map((col) => {
          const value = item[col.key];
          if (value === undefined || value === null) return null;

          if (col.key === "title" || col.key === "name") {
            return <p key={col.key} className="font-medium text-sm truncate">{String(value)}</p>;
          }

          if (col.key === "tags" && Array.isArray(value)) {
            return (
              <div key={col.key} className="flex gap-1 mt-1">
                {(value as { name: string; color?: string }[]).slice(0, 3).map((tag) => (
                  <span key={tag.name} className="text-xs px-1.5 py-0.5 rounded bg-muted" style={{ color: tag.color }}>
                    {tag.name}
                  </span>
                ))}
              </div>
            );
          }

          return (
            <span key={col.key} className="text-xs text-muted-foreground mr-3">{String(value)}</span>
          );
        })}
      </div>

      <ItemActions actions={actions} item={item} onAction={onAction} onEdit={onEdit} />
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
        const Icon = iconMap[action.icon];
        const isEdit = action.optionId === "activity.edit";
        return (
          <button
            key={ai}
            onClick={() => {
              if (isEdit) {
                onEdit();
              } else {
                onAction({
                  ...action,
                  targetResourceId: item.id as string,
                  params: { ...action.params, activity_id: item.id },
                });
              }
            }}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title={action.label}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : <span className="text-xs">{action.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
