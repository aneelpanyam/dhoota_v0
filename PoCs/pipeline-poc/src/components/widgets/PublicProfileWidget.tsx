"use client";

import Markdown from "react-markdown";
import { User } from "lucide-react";
import type { Widget, WidgetAction, OptionReference } from "@/types/api";
import { HeaderActionStrip } from "./HeaderActionStrip";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
  headerActions?: OptionReference[];
}

export function PublicProfileWidget({ widget, onOptionSelect, headerActions }: Props) {
  const displayName = (widget.data.displayName as string) ?? "Representative";
  const welcomeMessage = (widget.data.welcomeMessage as string) ?? "";
  const avatarUrl = widget.data.avatarUrl as string | undefined;

  const hasFooter = headerActions && headerActions.length > 0 && onOptionSelect;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        <div className="flex shrink-0 justify-center sm:justify-start">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center border-2 border-border">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-foreground mb-2">{displayName}</h3>
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
              {welcomeMessage}
            </Markdown>
          </div>
        </div>
      </div>
      {hasFooter && (
        <div className="flex items-center justify-end gap-1 px-4 py-2 border-t text-xs text-muted-foreground min-w-0">
          <HeaderActionStrip
            headerActions={headerActions}
            onOptionSelect={onOptionSelect}
          />
        </div>
      )}
    </div>
  );
}
