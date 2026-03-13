"use client";

import { useState, useEffect } from "react";
import { X, Sparkles, ChevronDown, Filter, FileText } from "lucide-react";

export interface ContextItem {
  entityType: string;
  entityId: string;
  label: string;
  summary: string;
  viewAction?: { optionId: string; params: Record<string, unknown> };
}

interface ContextFilter {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

interface ContextStripProps {
  items: ContextItem[];
  onRemove: (entityId: string) => void;
  onClearAll: () => void;
  onItemClick?: (item: ContextItem) => void;
  filters?: ContextFilter[];
  selectedFilter?: { id: string; name: string };
  onFilterSelect?: (filterId: string) => void;
  onClearFilter?: () => void;
  onGenerateReport?: (filter: { id: string; name: string }) => void;
  isLoading?: boolean;
}

export function ContextStrip({
  items,
  onRemove,
  onClearAll,
  onItemClick,
  filters = [],
  selectedFilter,
  onFilterSelect,
  onClearFilter,
  onGenerateReport,
  isLoading,
}: ContextStripProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const hasFilters = filters.length > 0 && onFilterSelect;
  const showStrip = items.length > 0 || hasFilters || !!selectedFilter;

  useEffect(() => {
    if (!filterOpen) return;
    const close = () => setFilterOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [filterOpen]);

  if (!showStrip) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
      {hasFilters && (
        <div className="relative shrink-0">
          {selectedFilter ? (
            <div className="flex items-center gap-1.5">
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] cursor-pointer hover:bg-primary/20 transition"
                onClick={(e) => { e.stopPropagation(); setFilterOpen((o) => !o); }}
              >
                <Filter className="h-3 w-3" />
                <span className="font-medium">Filter:</span>
                <span className="max-w-32 truncate">{selectedFilter.name}</span>
                <ChevronDown className="h-3 w-3" />
                {onClearFilter && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onClearFilter(); }}
                    className="p-0.5 rounded-full hover:bg-primary/20 transition"
                    title="Clear filter"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              {onGenerateReport && (
                <button
                  onClick={() => onGenerateReport(selectedFilter)}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/40 text-[11px] text-primary hover:bg-primary/10 transition disabled:opacity-40"
                  title="Generate report"
                >
                  <FileText className="h-3 w-3" />
                  Report
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setFilterOpen((o) => !o); }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-dashed border-primary/40 text-[11px] text-primary hover:bg-primary/10 transition"
            >
              <Filter className="h-3 w-3" />
              Select filter
              <ChevronDown className="h-3 w-3" />
            </button>
          )}
          {filterOpen && (
            <div
              className="absolute left-0 top-full mt-1 py-1 rounded-lg border bg-background shadow-lg z-50 min-w-[180px]"
              onClick={(e) => e.stopPropagation()}
            >
              {filters.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    onFilterSelect?.(f.id);
                    setFilterOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                >
                  {f.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
      {items.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-[10px] text-muted-foreground hover:text-foreground transition whitespace-nowrap"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
