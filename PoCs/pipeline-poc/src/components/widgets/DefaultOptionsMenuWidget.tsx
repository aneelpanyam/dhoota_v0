"use client";

import type { Widget, WidgetAction } from "@/types/api";
import {
  Plus, List, BarChart3, Tags, Eye, Pencil, MessageSquare,
  Trash2, Image, Zap, Settings, Users, Globe, Inbox,
} from "lucide-react";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Plus, List, BarChart3, Tags, Eye, Pencil, MessageSquare,
  Trash2, Image, Zap, Settings, Users, Globe, Inbox, TagIcon: Tags,
};

export function DefaultOptionsMenuWidget({ widget, onOptionSelect }: Props) {
  const d = widget.data;
  const title = (d.title as string) ?? "What would you like to do?";
  const options = (d.options as { optionId: string; name: string; icon: string; description?: string }[]) ?? [];

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const Icon = iconMap[opt.icon] ?? Zap;
          return (
            <button
              key={opt.optionId}
              onClick={() => onOptionSelect(opt.optionId)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted hover:border-primary/30 transition text-sm"
            >
              <Icon className="h-4 w-4 text-primary" />
              <span>{opt.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
