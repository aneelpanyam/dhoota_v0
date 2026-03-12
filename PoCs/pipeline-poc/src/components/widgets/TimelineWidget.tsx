"use client";

import type { Widget, WidgetAction } from "@/types/api";
import type { ContextItem } from "@/components/chat/ContextStrip";
import { ActivityTimelineView } from "./ActivityTimelineView";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
  onPinToContext?: (item: ContextItem) => void;
}

export function TimelineWidget({ widget, onAction }: Props) {
  const d = widget.data;
  const items = (d.items as Record<string, unknown>[]) ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
        No activities to display on the timeline.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden p-3">
      <ActivityTimelineView
        items={items as Parameters<typeof ActivityTimelineView>[0]["items"]}
        actions={widget.actions}
        onAction={onAction}
      />
    </div>
  );
}
