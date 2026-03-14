"use client";

import { useState } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import { Eye, Pencil, Trash2, Globe, Lock, FileText } from "lucide-react";
import { EditInfoCardFormWidget } from "./EditInfoCardFormWidget";
import Markdown from "react-markdown";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye, Pencil, Trash2, FileText,
};

function getContentRaw(d: Record<string, unknown>): string {
  if (typeof d.content_raw === "string") return d.content_raw;
  const content = d.content as Record<string, unknown> | undefined;
  if (content && typeof content.content_raw === "string") return content.content_raw;
  if (content && typeof content.text === "string") return content.text;
  return "";
}

/** Returns content as key-value pairs when it's a plain object (e.g. { email, phone }), excluding internal keys. */
function getContentKeyValues(d: Record<string, unknown>): Array<{ key: string; value: string }> {
  const content = d.content as Record<string, unknown> | undefined;
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  const skip = new Set(["content_raw", "text"]);
  const pairs: Array<{ key: string; value: string }> = [];
  for (const [k, v] of Object.entries(content)) {
    if (skip.has(k)) continue;
    if (v != null && typeof v === "string") pairs.push({ key: k, value: v });
    else if (v != null && typeof v === "number") pairs.push({ key: k, value: String(v) });
    else if (v != null && typeof v === "boolean") pairs.push({ key: k, value: v ? "Yes" : "No" });
    else if (Array.isArray(v) && v.every((x) => typeof x === "string")) pairs.push({ key: k, value: (v as string[]).join(", ") });
  }
  return pairs;
}

export function InfoCardWidget({ widget, onAction, onConfirm }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const d = widget.data;
  const title = (d.title as string) ?? "Untitled";
  const cardType = (d.card_type as string) ?? "custom";
  const visibility = (d.visibility as string) ?? "private";
  const contentRaw = getContentRaw(d);
  const contentKeyValues = getContentKeyValues(d);

  const VisIcon = visibility === "public" ? Globe : Lock;

  if (isEditing) {
    return (
      <EditInfoCardFormWidget
        infoCard={{
          id: (d.id as string) ?? "",
          title,
          content_raw: contentRaw,
          content: d.content as Record<string, unknown>,
          card_type: cardType,
          visibility,
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
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground uppercase">
              {cardType}
            </span>
            <h3 className="font-semibold text-base mt-1.5 break-words">{title}</h3>
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <VisIcon className="h-3.5 w-3.5" />
            {visibility}
          </span>
        </div>

        {contentRaw ? (
          <div className="text-sm text-foreground/85 prose prose-sm max-w-none dark:prose-invert">
            <Markdown>{contentRaw}</Markdown>
          </div>
        ) : contentKeyValues.length > 0 ? (
          <dl className="text-sm text-foreground/85 space-y-1.5">
            {contentKeyValues.map(({ key, value }) => (
              <div key={key} className="flex gap-2">
                <dt className="font-medium text-muted-foreground capitalize shrink-0">{key}:</dt>
                <dd className="break-words">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {/* Action bar */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-2 border-t">
            {actions.map((action, i) => {
              const Icon = iconMap[action.icon] ?? FileText;
              const isEdit = action.optionId === "info_card.edit";
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
