"use client";

import { useState } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import { Pencil, Trash2, Globe, Lock, Pin, FileText } from "lucide-react";
import { usePublicTheme } from "@/lib/contexts/PublicThemeContext";
import { getWidgetBorderStyle, getWidgetFgStyle } from "@/lib/theme-presets";
import { EditAnnouncementFormWidget } from "./EditAnnouncementFormWidget";
import Markdown from "react-markdown";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Pencil, Trash2, FileText, Pin,
};

export function AnnouncementCardWidget({ widget, onAction, onConfirm }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const themeOverrides = usePublicTheme();
  const widgetBorderStyle = getWidgetBorderStyle(themeOverrides?.headerPreset);
  const { style: widgetFgStyle, inheritClass: widgetFgClass } = getWidgetFgStyle(themeOverrides?.headerFgPreset);
  const d = widget.data;
  const title = (d.title as string) ?? "Untitled";
  const content = (d.content as string) ?? "";
  const visibility = (d.visibility as string) ?? "private";
  const pinned = (d.pinned as boolean) ?? false;
  const publishedAt = (d.published_at ?? d.publishedAt) as string | null;

  const VisIcon = visibility === "public" ? Globe : Lock;

  if (isEditing) {
    return (
      <EditAnnouncementFormWidget
        announcement={{
          id: (d.id as string) ?? "",
          title,
          content,
          visibility,
          pinned,
        }}
        onSave={(optionId, params) => {
          setIsEditing(false);
          onConfirm(optionId, params);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const actions = widget.actions ?? [];

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden shadow-sm ${widgetFgClass}`}
      style={{ ...widgetBorderStyle, ...widgetFgStyle }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {pinned && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  <Pin className="h-3 w-3" />
                  Pinned
                </span>
              )}
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <VisIcon className="h-3.5 w-3.5" />
                {visibility}
              </span>
            </div>
            <h3 className="font-semibold text-base mt-1.5 break-words">{title}</h3>
          </div>
        </div>

        {publishedAt && (
          <p className="text-xs text-muted-foreground">
            {new Date(publishedAt).toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        )}

        {content && (
          <div className="text-sm text-foreground/85 prose prose-sm max-w-none dark:prose-invert">
            <Markdown>{content}</Markdown>
          </div>
        )}

        {/* Action bar */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            {actions.map((action, i) => {
              const Icon = iconMap[action.icon] ?? FileText;
              const isEdit = action.optionId === "announcement.edit";
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (isEdit) setIsEditing(true);
                    else onAction(action);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
