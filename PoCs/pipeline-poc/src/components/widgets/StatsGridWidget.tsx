"use client";

import type { Widget } from "@/types/api";
import {
  Activity,
  CheckCircle2,
  CalendarDays,
  Calendar,
  Clock,
} from "lucide-react";

interface StatItem {
  label: string;
  value: string | number;
}

const ICON_MAP: Record<string, { icon: typeof Activity; color: string }> = {
  total: { icon: Activity, color: "text-primary" },
  completed: { icon: CheckCircle2, color: "text-green-500" },
  planned: { icon: Clock, color: "text-blue-500" },
  this_week: { icon: CalendarDays, color: "text-blue-500" },
  this_month: { icon: Calendar, color: "text-purple-500" },
};

function iconForLabel(label: string) {
  const key = label.toLowerCase().replace(/\s+/g, "_");
  return ICON_MAP[key] ?? { icon: Activity, color: "text-muted-foreground" };
}

interface Props {
  widget: Widget;
}

export function StatsGridWidget({ widget }: Props) {
  const stats = (widget.data?.stats as StatItem[] | undefined) ?? [];

  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {stats.map((stat) => {
        const { icon: Icon, color } = iconForLabel(stat.label);
        return (
          <div
            key={stat.label}
            className="rounded-lg border bg-card p-2.5 flex items-center gap-2 min-w-0"
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
}
