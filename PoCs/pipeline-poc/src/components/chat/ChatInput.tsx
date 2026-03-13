"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, X, Sparkles, Pin, ChevronDown } from "lucide-react";
import type { FileReference, ConversationState } from "@/types/api";
import { ContextStrip, type ContextItem } from "./ContextStrip";

interface ContextFilter {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface ChatInputProps {
  onSend: (content: string, files?: FileReference[]) => void;
  onSendInsights: (content: string, contextItems: ContextItem[], filter?: { id: string; name: string }) => void;
  onSendReport?: (filter: { id: string; name: string }) => void;
  isLoading: boolean;
  conversationState: ConversationState;
  isPublicMode?: boolean;
  contextItems: ContextItem[];
  onRemoveContext: (entityId: string) => void;
  onClearContext: () => void;
  onContextItemClick?: (item: ContextItem) => void;
  contextFilters?: ContextFilter[];
  selectedFilter?: { id: string; name: string };
  onFilterSelect?: (filterId: string) => void;
  onClearFilter?: () => void;
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
  onSendReport,
  isLoading,
  conversationState,
  isPublicMode,
  contextItems,
  onRemoveContext,
  onClearContext,
  onContextItemClick,
  contextFilters,
  selectedFilter,
  onFilterSelect,
  onClearFilter,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default to collapsed on mobile to save space
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsExpanded(!mq.matches);
  }, []);

  const hasContext = contextItems.length > 0;
  const hasFilter = !!selectedFilter;
  const isInsightsMode = hasContext || hasFilter;

  // Auto-expand when user pins items, selects a filter, or needs to respond
  useEffect(() => {
    if (isInsightsMode || conversationState !== "active") setIsExpanded(true);
  }, [isInsightsMode, conversationState]);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && pendingFiles.length === 0) return;

    if (isInsightsMode && trimmed) {
      onSendInsights(trimmed, contextItems, selectedFilter);
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
  }, [text, pendingFiles, onSend, onSendInsights, isInsightsMode, contextItems, selectedFilter?.id]);

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

  const showTextInput = isInsightsMode || conversationState !== "active";

  const placeholder = isInsightsMode
    ? hasFilter
      ? `Ask about ${selectedFilter?.name ?? "filter"}...`
      : `Ask a question about ${contextItems.length} selected item${contextItems.length !== 1 ? "s" : ""}...`
    : conversationState === "awaiting_confirmation"
    ? "Confirm or edit the details above..."
    : conversationState === "awaiting_input"
    ? "Answer the question above..."
    : "";

  return (
    <div className="border-t bg-background shrink-0">
      {isExpanded ? (
        <>
          {/* Context strip for insights mode */}
          <ContextStrip
            items={contextItems}
            onRemove={onRemoveContext}
            onClearAll={onClearContext}
            onItemClick={onContextItemClick}
            filters={contextFilters}
            selectedFilter={selectedFilter}
            onFilterSelect={onFilterSelect}
            onClearFilter={onClearFilter}
            onGenerateReport={onSendReport}
            isLoading={isLoading}
          />

          <div className="p-4">
            <div className="mx-auto">
              {showTextInput ? (
                <>
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
                </>
              ) : (
                /* Guidance prompt when idle (no context pinned, conversation active) */
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/50 border border-dashed border-muted-foreground/20">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    <Pin className="h-3.5 w-3.5 shrink-0" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choose an option above, <span className="font-medium text-foreground/70">select a filter</span>, or pin items from results to ask questions
                  </p>
                </div>
              )}
            </div>

            {/* Collapse button */}
            <button
              onClick={() => setIsExpanded(false)}
              className="mt-2 flex items-center justify-center gap-1.5 w-full py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
              title="Collapse query box"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </button>
          </div>
        </>
      ) : (
        /* Collapsed: sparkles button to expand */
        <div className="flex items-center justify-center gap-2 w-full py-3 px-4">
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg px-3 py-2 transition"
            title="Ask a question"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Ask a question</span>
          </button>
          {contextFilters && contextFilters.length > 0 && (
            <span className="text-xs text-muted-foreground" title={`${contextFilters.length} filter${contextFilters.length !== 1 ? "s" : ""} available`}>
              {contextFilters.length} filter{contextFilters.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
