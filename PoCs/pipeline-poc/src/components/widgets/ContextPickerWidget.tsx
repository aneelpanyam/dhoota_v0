"use client";

import type { Widget, WidgetAction } from "@/types/api";
import {
  List, Eye, Tags, Calendar, MessageSquare, Search, Zap,
} from "lucide-react";

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

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  List, Eye, Tags, Calendar, MessageSquare, Search, Zap,
};

interface ContextOption {
  contextId: string;
  label: string;
  icon: string;
  description: string;
  relevance: number;
  reason: string;
}

export function ContextPickerWidget({ widget, onQAResponse, onCancel }: Props) {
  const d = widget.data;
  const originalQuery = (d.originalQuery as string) ?? "";
  const contexts = (d.contexts as ContextOption[]) ?? [];
  const optionId = (d.optionId as string) ?? "dynamic_query";
  const queryMode = (d.queryMode as string) ?? "data";

  const handleSelect = (ctx: ContextOption) => {
    onQAResponse(optionId, {
      selectedContextId: ctx.contextId,
      originalQuery,
      queryMode,
    }, `Look at: ${ctx.label}`);
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">
          Where should I look?
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          To answer &quot;{originalQuery}&quot;, choose a data context:
        </p>
      </div>

      <div className="grid gap-2">
        {contexts.map((ctx) => {
          const Icon = iconMap[ctx.icon] ?? Search;
          return (
            <button
              key={ctx.contextId}
              onClick={() => handleSelect(ctx)}
              className="flex items-start gap-3 px-4 py-3 rounded-xl border bg-card hover:bg-muted hover:border-primary/30 transition text-left w-full group"
            >
              <div className="mt-0.5 p-1.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium">{ctx.label}</span>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {ctx.reason || ctx.description}
                </p>
              </div>
              {ctx.relevance >= 0.8 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shrink-0 mt-0.5">
                  best match
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={onCancel}
        className="text-xs text-muted-foreground hover:text-foreground transition"
      >
        Cancel
      </button>
    </div>
  );
}
