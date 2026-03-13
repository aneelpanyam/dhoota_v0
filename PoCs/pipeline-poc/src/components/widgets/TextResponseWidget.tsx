"use client";

import Markdown from "react-markdown";
import type { Widget, WidgetAction } from "@/types/api";

interface RelatedItem {
  entityType: string;
  entityId: string;
  label: string;
  summary: string;
  viewAction?: { optionId: string; params: Record<string, unknown> };
}

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

export function TextResponseWidget({ widget, onOptionSelect }: Props) {
  const text = (widget.data.text as string) ?? "";
  const relatedItems = (widget.data.relatedItems as RelatedItem[] | undefined) ?? [];

  return (
    <div className="space-y-3">
      <div className="text-sm text-foreground leading-relaxed prose prose-sm prose-neutral dark:prose-invert max-w-none">
        <Markdown
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          em: ({ children }) => <em>{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-4 space-y-1 my-2">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 space-y-1 my-2">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 italic text-foreground/70 my-2">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{children}</code>
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
              {children}
            </a>
          ),
          h1: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
        }}
      >
        {text}
      </Markdown>
      </div>
      {relatedItems.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
          <span className="text-xs text-muted-foreground mr-1">View:</span>
          {relatedItems.map((item) => {
            const clickable = !!item.viewAction && !!onOptionSelect;
            return (
              <button
                key={item.entityId}
                onClick={clickable ? () => onOptionSelect(item.viewAction!.optionId, item.viewAction!.params) : undefined}
                className={`px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap ${
                  clickable
                    ? "bg-primary/10 text-primary hover:bg-primary/20 transition cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-default"
                }`}
                title={item.summary}
              >
                {item.entityType}: {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
