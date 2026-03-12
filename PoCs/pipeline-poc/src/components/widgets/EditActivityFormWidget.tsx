"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Check, X, Upload, FileIcon } from "lucide-react";
import type { FileReference } from "@/types/api";

interface PendingFile {
  file: File;
  s3Key?: string;
  uploading: boolean;
  error?: string;
}

interface ActivityData {
  id: string;
  title: string;
  description?: string | null;
  activity_date?: string | null;
  location?: string | null;
  status: string;
  visibility: string;
}

interface Props {
  activity: ActivityData;
  onSave: (optionId: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}

const STATUS_OPTIONS = ["planned", "in_progress", "completed", "cancelled"];
const VISIBILITY_OPTIONS = ["private", "team", "public"];

export function EditActivityFormWidget({ activity, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(activity.title ?? "");
  const [description, setDescription] = useState(activity.description ?? "");
  const [activityDate, setActivityDate] = useState(
    activity.activity_date ? new Date(activity.activity_date).toISOString().slice(0, 16) : ""
  );
  const [location, setLocation] = useState(activity.location ?? "");
  const [status, setStatus] = useState(activity.status ?? "completed");
  const [visibility, setVisibility] = useState(activity.visibility ?? "private");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const pending: PendingFile = { file, uploading: true };
      setPendingFiles((prev) => [...prev, pending]);

      try {
        const res = await fetch("/api/media/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type,
            fileSizeBytes: file.size,
            context: "activity",
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");

        const { uploadUrl, s3Key } = await res.json();

        await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        setPendingFiles((prev) =>
          prev.map((f) =>
            f.file === file ? { ...f, s3Key, uploading: false } : f
          )
        );
      } catch {
        setPendingFiles((prev) =>
          prev.map((f) =>
            f.file === file
              ? { ...f, uploading: false, error: "Upload failed" }
              : f
          )
        );
      }
    }

    e.target.value = "";
  }, []);

  const removeFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const fileRefs: FileReference[] = pendingFiles
      .filter((f) => f.s3Key)
      .map((f) => ({
        s3Key: f.s3Key!,
        originalFilename: f.file.name,
        mimeType: f.file.type,
        fileSizeBytes: f.file.size,
      }));

    const params: Record<string, unknown> = {
      activity_id: activity.id,
      title: title || undefined,
      description: description || undefined,
      activity_date: activityDate ? new Date(activityDate).toISOString() : undefined,
      location: location || undefined,
      status,
      visibility,
    };

    if (fileRefs.length > 0) {
      params.media_keys = fileRefs;
    }

    onSave("activity.edit", params);
  }

  const hasUploadingFiles = pendingFiles.some((f) => f.uploading);

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-4">
      <h4 className="font-semibold text-sm">Edit Activity</h4>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Date</label>
            <input
              type="datetime-local"
              value={activityDate}
              onChange={(e) => setActivityDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background"
            >
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Media upload */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Photos / Videos</label>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {pendingFiles.length > 0 && (
            <EditFilePreviewGrid files={pendingFiles} onRemove={removeFile} />
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={hasUploadingFiles}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground transition disabled:opacity-40"
          >
            <Upload className="h-3.5 w-3.5" />
            {pendingFiles.length > 0 ? "Add more files" : "Add photos or videos"}
          </button>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <button
          type="submit"
          disabled={hasUploadingFiles}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditFilePreviewGrid({
  files,
  onRemove,
}: {
  files: PendingFile[];
  onRemove: (index: number) => void;
}) {
  const previews = useMemo(
    () =>
      files.map((pf) =>
        pf.file.type.startsWith("image/") ? URL.createObjectURL(pf.file) : null
      ),
    [files]
  );

  useEffect(() => {
    return () => previews.forEach((url) => url && URL.revokeObjectURL(url));
  }, [previews]);

  return (
    <div className="grid grid-cols-4 gap-1.5 mb-2">
      {files.map((pf, i) => {
        const previewUrl = previews[i];
        return previewUrl ? (
          <div key={i} className="relative group rounded-md overflow-hidden bg-muted aspect-square">
            <img src={previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
            {pf.uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {pf.error && (
              <div className="absolute inset-0 bg-destructive/60 flex items-center justify-center">
                <span className="text-white text-[10px] font-medium">Failed</span>
              </div>
            )}
            {!pf.uploading && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ) : (
          <div key={i} className="flex flex-col items-center justify-center gap-1 p-1.5 rounded-md bg-muted text-[10px] aspect-square">
            <FileIcon className="h-4 w-4 text-muted-foreground" />
            <span className="truncate w-full text-center">{pf.file.name}</span>
            {pf.uploading && (
              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            )}
            {!pf.uploading && (
              <button type="button" onClick={() => onRemove(i)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
