"use client";

import type { Widget, WidgetAction } from "@/types/api";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface RetryRequest {
  source?: string;
  optionId?: string;
  content?: string;
  params?: Record<string, unknown>;
}

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

export function ErrorCardWidget({ widget, onOptionSelect, onConfirm, onQAResponse }: Props) {
  const d = widget.data;
  const message = (d.message as string) ?? "Something went wrong.";
  const retryable = (d.retryable as boolean) ?? false;
  const details = d.details as string | undefined;
  const retryRequest = d.retryRequest as RetryRequest | null;

  function handleRetry() {
    if (!retryRequest?.optionId) return;

    const { source, optionId, params, content } = retryRequest;

    if (source === "confirmation") {
      onConfirm(optionId, params ?? {});
    } else if (source === "qa_response") {
      onQAResponse(optionId, params ?? {}, content);
    } else {
      onOptionSelect(optionId, params);
    }
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2 min-w-0">
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-destructive break-words min-w-0">{message}</p>
      </div>
      {details && (
        <p className="text-xs text-muted-foreground break-words min-w-0">{details}</p>
      )}
      {retryable && retryRequest && (
        <button
          onClick={handleRetry}
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      )}
    </div>
  );
}
