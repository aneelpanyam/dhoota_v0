"use client";

import type { Widget, WidgetAction } from "@/types/api";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { usePublicTheme } from "@/lib/contexts/PublicThemeContext";
import { getWidgetBorderStyle, getWidgetFgStyle } from "@/lib/theme-presets";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

export function StatsCardWidget({ widget }: Props) {
  const d = widget.data;
  const themeOverrides = usePublicTheme();
  const widgetBorderStyle = getWidgetBorderStyle(themeOverrides?.headerPreset);
  const { style: widgetFgStyle, inheritClass: widgetFgClass } = getWidgetFgStyle(themeOverrides?.headerFgPreset);
  const label = (d.label as string) ?? "Stat";
  const value = d.value as string | number;
  const change = d.change as number | undefined;
  const changeLabel = d.changeLabel as string | undefined;
  const trend = (d.trend as string) ?? "flat";

  const trendColors: Record<string, string> = {
    up: "text-green-600",
    down: "text-red-600",
    flat: "text-muted-foreground",
  };

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div
      className={`rounded-xl border bg-card p-4 inline-block min-w-[140px] ${widgetFgClass}`}
      style={{ ...widgetBorderStyle, ...widgetFgStyle }}
    >
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {(change !== undefined || changeLabel) && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${trendColors[trend]}`}>
          <TrendIcon className="h-3.5 w-3.5" />
          {change !== undefined && <span>{change > 0 ? "+" : ""}{change}</span>}
          {changeLabel && <span>{changeLabel}</span>}
        </div>
      )}
    </div>
  );
}
