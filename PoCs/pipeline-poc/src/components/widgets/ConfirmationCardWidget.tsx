"use client";

import { useState } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import { Check, Pencil, X, Sparkles, FileText } from "lucide-react";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

interface MediaFile {
  s3Key: string;
  originalFilename: string;
  mimeType: string;
}

function formatLabel(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFieldValue(
  field: { label: string; value: string },
  mediaFiles: MediaFile[]
): string | null {
  if (field.value !== "[object Object]") return field.value;
  const labelLower = field.label.toLowerCase();
  const isMediaField = /photos|videos|media|attachments|files/.test(labelLower);
  if (isMediaField && mediaFiles.length > 0) return `${mediaFiles.length} file(s) attached`;
  if (isMediaField && mediaFiles.length === 0) return null;
  return "—";
}

function parseMediaFiles(mediaKeys: unknown): MediaFile[] {
  if (!Array.isArray(mediaKeys)) return [];
  return mediaKeys
    .filter((f): f is Record<string, unknown> => f != null && typeof f === "object")
    .map((f) => ({
      s3Key: ((f.s3Key ?? f.s3_key) as string) ?? "",
      originalFilename: ((f.originalFilename ?? f.original_filename) as string) ?? "file",
      mimeType: ((f.mimeType ?? f.mime_type) as string) ?? "",
    }))
    .filter((f) => f.s3Key);
}

function MediaPreviewGrid({ files }: { files: MediaFile[] }) {
  if (files.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">Attachments</span>
      <div className="flex flex-wrap gap-2">
        {files.map((file) => {
          const isImage = file.mimeType.startsWith("image/");
          const isVideo = file.mimeType.startsWith("video/");
          const url = `/api/media/serve?key=${encodeURIComponent(file.s3Key)}`;

          if (isImage) {
            return (
              <div
                key={file.s3Key}
                className="relative group w-20 h-20 rounded-lg overflow-hidden border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={file.originalFilename}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition">
                  <p className="text-[10px] text-white truncate">{file.originalFilename}</p>
                </div>
              </div>
            );
          }

          if (isVideo) {
            return (
              <div
                key={file.s3Key}
                className="relative w-20 h-20 rounded-lg overflow-hidden border bg-muted flex items-center justify-center"
              >
                <video src={url} className="w-full h-full object-cover" muted />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <span className="text-white text-lg">&#9654;</span>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5">
                  <p className="text-[10px] text-white truncate">{file.originalFilename}</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={file.s3Key}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border bg-muted text-xs"
            >
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate max-w-[120px]">{file.originalFilename}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Valid user_type enum values - used to detect/fix UUID mistakenly sent as user_type */
const VALID_USER_TYPES = new Set(["worker", "candidate", "representative", "team_worker"]);

function isUuidLike(val: unknown): boolean {
  return typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(val);
}

const SELECT_OPTIONS: Record<string, { label: string; value: string }[]> = {
  status: [
    { label: "Completed", value: "completed" },
    { label: "Planned", value: "planned" },
    { label: "In Progress", value: "in_progress" },
    { label: "Cancelled", value: "cancelled" },
    { label: "Draft", value: "draft" },
    { label: "Active", value: "active" },
    { label: "Archived", value: "archived" },
    { label: "Requested", value: "requested" },
    { label: "Processing", value: "processing" },
    { label: "Failed", value: "failed" },
    { label: "New", value: "new" },
    { label: "Reviewed", value: "reviewed" },
    { label: "Resolved", value: "resolved" },
  ],
  visibility: [
    { label: "Private", value: "private" },
    { label: "Team", value: "team" },
    { label: "Public", value: "public" },
  ],
  subscription: [
    { label: "Free", value: "free" },
    { label: "Basic", value: "basic" },
    { label: "Standard", value: "standard" },
    { label: "Premium", value: "premium" },
  ],
  user_type: [
    { label: "Worker", value: "worker" },
    { label: "Candidate", value: "candidate" },
    { label: "Representative", value: "representative" },
    { label: "Team Worker", value: "team_worker" },
  ],
  suggestion_status: [
    { label: "New", value: "new" },
    { label: "Reviewed", value: "reviewed" },
    { label: "Resolved", value: "resolved" },
  ],
  regenerate_access_code: [
    { label: "No", value: "false" },
    { label: "Yes", value: "true" },
  ],
  deactivate: [
    { label: "No", value: "false" },
    { label: "Yes", value: "true" },
  ],
  enabled: [
    { label: "Yes", value: "true" },
    { label: "No", value: "false" },
  ],
  pinned: [
    { label: "Yes", value: "true" },
    { label: "No", value: "false" },
  ],
};

const TEXTAREA_KEYS = new Set(["description", "content", "notes"]);
const DATE_KEYS = new Set(["activity_date", "date", "date_from", "date_to"]);

interface EntityContextData {
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
}

function deriveEditableKeys(
  fields: { label: string; value: string }[],
  params: Record<string, unknown>
): string[] {
  const fieldLabels = new Set(fields.map((f) => f.label.toLowerCase()));
  const keys: string[] = [];
  for (const key of Object.keys(params)) {
    const humanized = key.replace(/_/g, " ").toLowerCase();
    if (fieldLabels.has(humanized) || fieldLabels.has(key.toLowerCase())) {
      keys.push(key);
    }
  }
  if (keys.length === 0) {
    for (const f of fields) {
      const guessedKey = f.label.toLowerCase().replace(/ /g, "_");
      keys.push(guessedKey);
    }
  }
  return keys;
}

export function ConfirmationCardWidget({ widget, onConfirm, onCancel }: Props) {
  const d = widget.data;
  const cardTitle = (d.title as string) ?? "Confirm";
  const fields = (d.fields as { label: string; value: string; inferred?: boolean }[]) ?? [];
  const suggestedTags = (d.suggestedTags as { name: string; confidence: number }[]) ?? [];
  const optionId = d.optionId as string;
  const params = (d.params as Record<string, unknown>) ?? {};
  const entityContext = d.entityContext as EntityContextData | null | undefined;

  const editableKeys = deriveEditableKeys(fields, params).filter(
    (k) => !(optionId === "admin.user.provision" && k === "tenant_name")
  );

  const [isEditing, setIsEditing] = useState(false);
  const [editParams, setEditParams] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const key of editableKeys) {
      if (params[key] != null) {
        let val = String(params[key]);
        // Fix: user_type as UUID (tenant_id leaked) -> use "worker" so dropdown shows correct option
        if (key === "user_type" && optionId === "admin.user.provision" && isUuidLike(val) && !VALID_USER_TYPES.has(val)) {
          val = "worker";
        }
        initial[key] = val;
      }
    }
    return initial;
  });

  const mediaFiles = parseMediaFiles(params.media_keys);

  function buildFinalParams(): Record<string, unknown> {
    const finalParams = { ...params };

    if (isEditing) {
      for (const [key, val] of Object.entries(editParams)) {
        if (val.trim()) finalParams[key] = val.trim();
      }
    }

    // Fix: when user_type is a UUID (e.g. tenant_id leaked due to no change event on default select),
    // replace with valid default so validation passes
    if (
      optionId === "admin.user.provision" &&
      finalParams.user_type != null &&
      isUuidLike(finalParams.user_type) &&
      !VALID_USER_TYPES.has(String(finalParams.user_type))
    ) {
      finalParams.user_type = "worker";
    }

    const existingTags = Array.isArray(finalParams.tags)
      ? (finalParams.tags as (string | { name: string })[])
          .map((t) => (typeof t === "string" ? t : t?.name))
          .filter(Boolean) as string[]
      : [];
    const sugNames = suggestedTags
      .map((t) => (typeof t === "string" ? t : t?.name))
      .filter(Boolean) as string[];
    const allTags = [...new Set([...existingTags, ...sugNames])];
    if (allTags.length > 0) finalParams.tags = allTags;

    return finalParams;
  }

  const contextBanner = entityContext ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="min-w-0">
        <span className="text-xs font-medium text-foreground truncate block">{entityContext.title}</span>
        {entityContext.subtitle && (
          <span className="text-[10px] text-muted-foreground">{entityContext.subtitle}</span>
        )}
      </div>
    </div>
  ) : null;

  if (isEditing) {
    return (
      <div className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <Pencil className="h-4 w-4 text-primary" />
          Edit: {cardTitle.replace("Confirm: ", "")}
        </h4>
        {contextBanner}

        <div className="space-y-3">
          {editableKeys.map((key) => {
            if (!(key in editParams)) return null;
            const label = formatLabel(key);
            const selectOpts = SELECT_OPTIONS[key];

            if (selectOpts) {
              return (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <select
                    value={editParams[key] ?? ""}
                    onChange={(e) => setEditParams((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border text-sm bg-background"
                  >
                    {selectOpts.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (TEXTAREA_KEYS.has(key)) {
              return (
                <div key={key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{label}</label>
                  <textarea
                    value={editParams[key] ?? ""}
                    onChange={(e) => setEditParams((p) => ({ ...p, [key]: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border text-sm bg-background resize-none"
                  />
                </div>
              );
            }

            return (
              <div key={key} className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                <input
                  type={DATE_KEYS.has(key) ? "date" : "text"}
                  value={editParams[key] ?? ""}
                  onChange={(e) => setEditParams((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-background"
                />
              </div>
            );
          })}
        </div>

        <MediaPreviewGrid files={mediaFiles} />

        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={() => {
              onConfirm(optionId, buildFinalParams());
            }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
          >
            <Check className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm hover:bg-muted transition"
          >
            Back to Preview
          </button>
          <button
            onClick={onCancel}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition"
          >
            <X className="h-4 w-4" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        {cardTitle}
      </h4>

      {contextBanner}

      {/* Fields */}
      <div className="space-y-2">
        {fields.map((field, i) => {
          const displayValue = formatFieldValue(field, mediaFiles);
          if (displayValue === null) return null;
          return (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground min-w-[100px] shrink-0">
                {formatLabel(field.label)}:
              </span>
              <span className="flex-1">
                {displayValue}
                {field.inferred && (
                  <span className="ml-1.5 text-xs text-primary/70 italic">(inferred)</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Attached files */}
      <MediaPreviewGrid files={mediaFiles} />

      {/* Suggested tags */}
      {suggestedTags.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Suggested tags:</span>
          <div className="flex gap-1">
            {suggestedTags.map((tag) => (
              <span
                key={tag.name}
                className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <button
          onClick={() => onConfirm(optionId, buildFinalParams())}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm hover:bg-muted transition"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}
