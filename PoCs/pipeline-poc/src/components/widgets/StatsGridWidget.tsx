"use client";

import type { Widget, OptionReference } from "@/types/api";
import { usePublicTheme } from "@/lib/contexts/PublicThemeContext";
import { getWidgetBorderStyle, getWidgetFgStyle } from "@/lib/theme-presets";
import {
  Activity,
  CheckCircle2,
  CalendarDays,
  Calendar,
  Clock,
  Megaphone,
  CreditCard,
  MessageSquare,
  User,
  DollarSign,
  Zap,
  BarChart3,
  AlertCircle,
} from "lucide-react";
import { HeaderActionStrip } from "./HeaderActionStrip";

interface StatItem {
  label: string;
  value: string | number;
}

const ICON_MAP: Record<string, { icon: typeof Activity; color: string }> = {
  total: { icon: Activity, color: "text-primary" },
  total_cost: { icon: DollarSign, color: "text-green-500" },
  llm_calls: { icon: Zap, color: "text-amber-500" },
  input_tokens: { icon: BarChart3, color: "text-blue-500" },
  output_tokens: { icon: BarChart3, color: "text-indigo-500" },
  total_executions: { icon: Zap, color: "text-primary" },
  avg_latency_ms: { icon: Clock, color: "text-blue-500" },
  total_errors: { icon: AlertCircle, color: "text-red-500" },
  completed: { icon: CheckCircle2, color: "text-green-500" },
  planned: { icon: Clock, color: "text-blue-500" },
  this_week: { icon: CalendarDays, color: "text-blue-500" },
  this_month: { icon: Calendar, color: "text-purple-500" },
  announcements: { icon: Megaphone, color: "text-amber-500" },
  info_cards: { icon: CreditCard, color: "text-indigo-500" },
  welcome_messages: { icon: MessageSquare, color: "text-teal-500" },
  avatar: { icon: User, color: "text-slate-500" },
};

function iconForLabel(label: string) {
  const key = label.toLowerCase().replace(/\s+/g, "_");
  return ICON_MAP[key] ?? { icon: Activity, color: "text-muted-foreground" };
}

interface Props {
  widget: Widget;
  onOptionSelect?: (optionId: string, params?: Record<string, unknown>) => void;
  headerActions?: OptionReference[];
}

export function StatsGridWidget({ widget, onOptionSelect, headerActions }: Props) {
  const stats = (widget.data?.stats as StatItem[] | undefined) ?? [];
  const themeOverrides = usePublicTheme();
  const widgetBorderStyle = getWidgetBorderStyle(themeOverrides?.headerPreset);
  const { style: widgetFgStyle, inheritClass: widgetFgClass } = getWidgetFgStyle(themeOverrides?.headerFgPreset);

  if (stats.length === 0) return null;

  const hasFooter = headerActions && headerActions.length > 0 && onOptionSelect;

  const cellClass = hasFooter
    ? "rounded-lg bg-muted/50 p-2.5 flex items-center gap-2 min-w-0"
    : "rounded-lg border bg-card p-2.5 flex items-center gap-2 min-w-0";

  const grid = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {stats.map((stat) => {
        const { icon: Icon, color } = iconForLabel(stat.label);
        return (
          <div
            key={stat.label}
            className={`${cellClass} ${!hasFooter ? widgetFgClass : ""}`}
            style={!hasFooter ? { ...widgetBorderStyle, ...widgetFgStyle } : undefined}
          >
            <Icon className={`h-4 w-4 shrink-0 ${color}`} />
            <div className="min-w-0 flex-1">
              <span className="text-base font-bold leading-tight whitespace-nowrap">
                {stat.value}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1">
                {stat.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (!hasFooter) return grid;

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden ${widgetFgClass}`}
      style={{ ...widgetBorderStyle, ...widgetFgStyle }}
    >
      <div className="p-4">{grid}</div>
      <div className="flex items-center justify-end gap-1 px-4 py-2 border-t text-xs text-muted-foreground min-w-0">
        <HeaderActionStrip
          headerActions={headerActions}
          onOptionSelect={onOptionSelect}
        />
      </div>
    </div>
  );
}
