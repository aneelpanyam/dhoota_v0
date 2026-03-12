"use client";

import { X, Sparkles } from "lucide-react";

export interface ContextItem {
  entityType: string;
  entityId: string;
  label: string;
  summary: string;
  viewAction?: { optionId: string; params: Record<string, unknown> };
}

interface ContextStripProps {
  items: ContextItem[];
  onRemove: (entityId: string) => void;
  onClearAll: () => void;
  onItemClick?: (item: ContextItem) => void;
}

export function ContextStrip({ items, onRemove, onClearAll, onItemClick }: ContextStripProps) {
  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
        {items.map((item) => {
          const clickable = !!item.viewAction && !!onItemClick;
          return (
            <div
              key={item.entityId}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] whitespace-nowrap shrink-0 ${
                clickable ? "cursor-pointer hover:bg-primary/20 transition" : ""
              }`}
              title={item.summary}
              onClick={clickable ? () => onItemClick(item) : undefined}
              role={clickable ? "button" : undefined}
            >
              <span className="font-medium">{item.entityType}:</span>
              <span className={`max-w-32 truncate ${clickable ? "underline decoration-primary/30" : ""}`}>{item.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(item.entityId); }}
                className="p-0.5 rounded-full hover:bg-primary/20 transition"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        onClick={onClearAll}
        className="text-[10px] text-muted-foreground hover:text-foreground transition whitespace-nowrap"
      >
        Clear all
      </button>
    </div>
  );
}
