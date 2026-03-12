"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Paperclip, X } from "lucide-react";
import type { FileReference, ConversationState } from "@/types/api";
import { ContextStrip, type ContextItem } from "./ContextStrip";

interface ChatInputProps {
  onSend: (content: string, files?: FileReference[]) => void;
  onSendInsights: (content: string, contextItems: ContextItem[]) => void;
  isLoading: boolean;
  conversationState: ConversationState;
  isPublicMode?: boolean;
  contextItems: ContextItem[];
  onRemoveContext: (entityId: string) => void;
  onClearContext: () => void;
  onContextItemClick?: (item: ContextItem) => void;
}

interface PendingFile {
  file: File;
  s3Key?: string;
  uploading: boolean;
  error?: string;
}

export function ChatInput({
  onSend,
  onSendInsights,
  isLoading,
  conversationState,
  isPublicMode,
  contextItems,
  onRemoveContext,
  onClearContext,
  onContextItemClick,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContext = contextItems.length > 0;
  const isInsightsMode = hasContext;

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    if (isInsightsMode && trimmed) {
      onSendInsights(trimmed, contextItems);
      setText("");
      inputRef.current?.focus();
      return;
    }

    const fileRefs: FileReference[] = pendingFiles
      .filter((f) => f.s3Key)
      .map((f) => ({
        s3Key: f.s3Key!,
        originalFilename: f.file.name,
        mimeType: f.file.type,
        fileSizeBytes: f.file.size,
      }));

    onSend(trimmed, fileRefs.length > 0 ? fileRefs : undefined);
    setText("");
    setPendingFiles([]);
    inputRef.current?.focus();
  }, [text, pendingFiles, onSend, onSendInsights, isInsightsMode, contextItems]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

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

  const placeholder = isInsightsMode
    ? `Ask a question about ${contextItems.length} selected item${contextItems.length !== 1 ? "s" : ""}...`
    : isPublicMode
    ? "Choose an option above..."
    : conversationState === "awaiting_confirmation"
    ? "Confirm or edit the details above..."
    : conversationState === "awaiting_input"
    ? "Answer the question above..."
    : "Choose an option, or pin items for insights...";

  return (
    <div className="border-t bg-background shrink-0">
      {/* Context strip for insights mode */}
      <ContextStrip
        items={contextItems}
        onRemove={onRemoveContext}
        onClearAll={onClearContext}
        onItemClick={onContextItemClick}
      />

      <div className="p-4">
        <div className="mx-auto">
          {/* Pending files */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {pendingFiles.map((pf, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs"
                >
                  {pf.uploading && (
                    <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  )}
                  <span className="truncate max-w-32">{pf.file.name}</span>
                  {pf.error && <span className="text-destructive">{pf.error}</span>}
                  <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            {!isPublicMode && !isInsightsMode && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition shrink-0"
                  title="Attach files"
                >
                  <Paperclip className="h-5 w-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </>
            )}

            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                rows={1}
                className={`w-full resize-none rounded-xl border px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 max-h-32 overflow-y-auto ${
                  isInsightsMode
                    ? "bg-primary/5 border-primary/30 focus:ring-primary/50"
                    : "bg-muted/50 focus:ring-primary/50"
                }`}
                style={{ minHeight: "42px" }}
                disabled={isLoading}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading || (!text.trim() && pendingFiles.length === 0)}
              className={`p-2.5 rounded-lg transition shrink-0 ${
                isInsightsMode
                  ? "bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
                  : "bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40"
              }`}
              title={isInsightsMode ? "Ask insight" : "Send"}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
