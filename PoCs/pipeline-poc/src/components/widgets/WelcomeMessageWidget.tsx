"use client";

import Markdown from "react-markdown";
import { Globe } from "lucide-react";
import type { Widget, WidgetAction } from "@/types/api";
import { usePublicTheme } from "@/lib/contexts/PublicThemeContext";
import { getCardPresetClasses } from "@/lib/theme-presets";

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

export function WelcomeMessageWidget({
  widget,
}: Props) {
  const text = (widget.data.text as string) ?? "";
  const bannerImageUrl = widget.data.bannerImageUrl as string | undefined;
  const representativeAvatarUrl = widget.data.representativeAvatarUrl as string | undefined;
  const themeOverrides = usePublicTheme();
  const { className: cardClass, style: cardStyle } = getCardPresetClasses(
    themeOverrides?.welcomeMessagePreset,
    themeOverrides?.welcomeMessageFgPreset
  );

  return (
    <article className={`overflow-hidden rounded-xl ${cardClass}`} style={cardStyle}>
      {bannerImageUrl && (
        <div className="aspect-video md:aspect-[6/1] w-full overflow-hidden bg-muted">
          <img
            src={bannerImageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="flex gap-4 p-4">
        {false && <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted">
          {representativeAvatarUrl ? (
            <img
              src={representativeAvatarUrl}
              alt=""
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <Globe className="h-6 w-6 text-primary" />
          )}
        </div>}
        <div className="min-w-0 flex-1">
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
        </div>
      </div>
    </article>
  );
}
