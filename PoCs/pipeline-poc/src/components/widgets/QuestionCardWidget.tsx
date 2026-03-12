"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import type { Widget, WidgetAction, FileReference } from "@/types/api";
import { Send, X, Upload, FileIcon, FileText } from "lucide-react";

interface PendingFile {
  file: File;
  s3Key?: string;
  uploading: boolean;
  error?: string;
}

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (
    optionId: string,
    params: Record<string, unknown>,
    content?: string
  ) => void;
  onCancel: () => void;
}

interface EntityContextData {
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
}

export function QuestionCardWidget({ widget, onQAResponse, onCancel }: Props) {
  const d = widget.data;
  const questionText = d.questionText as string;
  const questionKey = d.questionKey as string;
  const inlineWidget = d.inlineWidget as string | null;
  const widgetConfig = (d.widgetConfig as Record<string, unknown>) ?? {};
  const isRequired = (d.isRequired as boolean) ?? true;
  const optionId = d.optionId as string;
  const sessionParams = (d.sessionParams as Record<string, unknown>) ?? {};
  const entityContext = d.entityContext as EntityContextData | null | undefined;

  const [value, setValue] = useState("");
  const [dateValue, setDateValue] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [selectValue, setSelectValue] = useState("private");
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

  const handleSubmit = () => {
    let answer: unknown;

    switch (inlineWidget) {
      case "date_picker":
        answer = new Date(dateValue).toISOString();
        break;
      case "visibility_select":
        answer = selectValue;
        break;
      case "file_upload": {
        const fileRefs: FileReference[] = pendingFiles
          .filter((f) => f.s3Key)
          .map((f) => ({
            s3Key: f.s3Key!,
            originalFilename: f.file.name,
            mimeType: f.file.type,
            fileSizeBytes: f.file.size,
          }));
        answer = fileRefs.length > 0 ? fileRefs : null;
        break;
      }
      default:
        answer = value.trim() || null;
        break;
    }

    if (answer === null && isRequired) return;

    const updatedParams = { ...sessionParams, [questionKey]: answer };
    onQAResponse(optionId, updatedParams, typeof answer === "string" ? answer : undefined);
  };

  const handleSkip = () => {
    const updatedParams = { ...sessionParams, [questionKey]: null };
    onQAResponse(optionId, updatedParams);
  };

  const hasUploadingFiles = pendingFiles.some((f) => f.uploading);
  const hasUploadedFiles = pendingFiles.some((f) => f.s3Key);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      {entityContext && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 -mx-0.5">
          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-medium text-foreground truncate block">{entityContext.title}</span>
            {entityContext.subtitle && (
              <span className="text-[10px] text-muted-foreground">{entityContext.subtitle}</span>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{questionText}</p>
        {!isRequired && (
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition"
          >
            Skip
          </button>
        )}
      </div>

      {inlineWidget === "file_upload" ? (
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple={!!widgetConfig.multiple}
            accept={(widgetConfig.accept as string) ?? "image/*,video/*"}
            className="hidden"
            onChange={handleFileSelect}
          />

          {pendingFiles.length > 0 && (
            <FilePreviewGrid files={pendingFiles} onRemove={removeFile} />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={hasUploadingFiles}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground transition disabled:opacity-40"
            >
              <Upload className="h-4 w-4" />
              {pendingFiles.length > 0 ? "Add more files" : "Choose files"}
            </button>

            {hasUploadedFiles && (
              <button
                onClick={handleSubmit}
                disabled={hasUploadingFiles}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          {inlineWidget === "date_picker" ? (
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          ) : inlineWidget === "visibility_select" ? (
            <select
              value={selectValue}
              onChange={(e) => setSelectValue(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {((widgetConfig.options as string[]) ?? ["private", "team", "public"]).map(
                (opt) => (
                  <option key={opt} value={opt}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </option>
                )
              )}
            </select>
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Type your answer..."
              className="flex-1 px-3 py-2 rounded-lg border bg-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          )}

          <button
            onClick={handleSubmit}
            className="p-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function FilePreviewGrid({
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
    <div className="grid grid-cols-3 gap-2">
      {files.map((pf, i) => {
        const previewUrl = previews[i];
        return previewUrl ? (
          <div key={i} className="relative group rounded-lg overflow-hidden bg-muted aspect-square">
            <img src={previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
            {pf.uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            )}
            {pf.error && (
              <div className="absolute inset-0 bg-destructive/60 flex items-center justify-center">
                <span className="text-white text-xs font-medium">Failed</span>
              </div>
            )}
            {!pf.uploading && (
              <button
                onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ) : (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-muted text-xs col-span-1">
            <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {pf.uploading && (
              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" />
            )}
            <span className="truncate">{pf.file.name}</span>
            {pf.error && <span className="text-destructive text-[10px]">Failed</span>}
            {!pf.uploading && (
              <button onClick={() => onRemove(i)} className="ml-auto text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
