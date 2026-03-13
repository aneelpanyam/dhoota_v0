"use client";

import { useMemo } from "react";
import { parseISO, isThisWeek, isThisMonth, format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import {
  Activity, CheckCircle2, Clock, TrendingUp,
  MapPin, Tag, CalendarDays,
} from "lucide-react";

interface ActivityItem {
  id: string;
  title: string;
  status?: string;
  activity_date?: string;
  activityDate?: string;
  location?: string;
  tags?: { name: string; color?: string }[];
  [key: string]: unknown;
}

interface Props {
  items: ActivityItem[];
}

export function ActivityStatsBar({ items }: Props) {
  const stats = useMemo(() => {
    const total = items.length;
    const byStatus: Record<string, number> = {};
    const locations = new Set<string>();
    const tagCounts: Record<string, { count: number; color?: string }> = {};
    let thisWeek = 0;
    let thisMonth = 0;

    const monthDays = eachDayOfInterval({
      start: startOfMonth(new Date()),
      end: endOfMonth(new Date()),
    });
    const activityDaysThisMonth = new Set<string>();

    for (const item of items) {
      const status = item.status ?? "unknown";
      byStatus[status] = (byStatus[status] ?? 0) + 1;

      const raw = item.activity_date ?? item.activityDate;
      if (raw) {
        const d = parseISO(raw);
        if (isThisWeek(d)) thisWeek++;
        if (isThisMonth(d)) {
          thisMonth++;
          activityDaysThisMonth.add(format(d, "yyyy-MM-dd"));
        }
      }

      if (item.location) locations.add(item.location);

      if (item.tags) {
        for (const tag of item.tags) {
          const existing = tagCounts[tag.name] ?? { count: 0, color: tag.color };
          existing.count++;
          tagCounts[tag.name] = existing;
        }
      }
    }

    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const streak = calculateStreak(items);

    return {
      total,
      byStatus,
      thisWeek,
      thisMonth,
      uniqueLocations: locations.size,
      topTags,
      streak,
      activeDaysRatio: monthDays.length > 0
        ? `${activityDaysThisMonth.size}/${monthDays.length}`
        : "0",
    };
  }, [items]);

  const statCards = [
    {
      label: "Total",
      value: stats.total,
      icon: Activity,
      color: "text-primary",
    },
    {
      label: "Completed",
      value: stats.byStatus.completed ?? 0,
      icon: CheckCircle2,
      color: "text-green-500",
    },
    {
      label: "This Week",
      value: stats.thisWeek,
      icon: CalendarDays,
      color: "text-blue-500",
    },
    {
      label: "Streak",
      value: `${stats.streak}d`,
      icon: TrendingUp,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="space-y-3">
      {/* Quick stat cards - compact single-line layout like Summary view */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="rounded-lg border bg-card p-2.5 flex items-center gap-2 min-w-0"
            >
              <Icon className={`h-4 w-4 shrink-0 ${card.color}`} />
              <div className="min-w-0 flex-1">
                <span className="text-base font-bold leading-tight">{card.value}</span>
                <span className="text-[10px] text-muted-foreground ml-1">{card.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status breakdown bar */}
      {stats.total > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            Status breakdown
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-muted">
            {(["completed", "in_progress", "planned", "cancelled"] as const).map((status) => {
              const count = stats.byStatus[status] ?? 0;
              if (count === 0) return null;
              const pct = (count / stats.total) * 100;
              const colors: Record<string, string> = {
                completed: "bg-green-400",
                in_progress: "bg-yellow-400",
                planned: "bg-blue-400",
                cancelled: "bg-gray-300",
              };
              return (
                <div
                  key={status}
                  className={`${colors[status]} transition-all duration-500`}
                  style={{ width: `${pct}%` }}
                  title={`${status.replace("_", " ")}: ${count}`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
            {(["completed", "in_progress", "planned", "cancelled"] as const).map((status) => {
              const count = stats.byStatus[status] ?? 0;
              if (count === 0) return null;
              const colors: Record<string, string> = {
                completed: "bg-green-400",
                in_progress: "bg-yellow-400",
                planned: "bg-blue-400",
                cancelled: "bg-gray-300",
              };
              return (
                <span key={status} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
                  {status.replace("_", " ")} ({count})
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Top tags + locations */}
      <div className="flex flex-col md:flex-row gap-3">
        {stats.topTags.length > 0 && (
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Tag className="h-3 w-3" />
              Top tags
            </div>
            <div className="flex flex-wrap gap-1">
              {stats.topTags.map(([name, { count, color }]) => (
                <span
                  key={name}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted inline-flex items-center gap-1"
                  style={{ color: color ?? undefined }}
                >
                  {name}
                  <span className="opacity-50">({count})</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {stats.uniqueLocations > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              Locations
            </div>
            <span className="text-sm font-medium">{stats.uniqueLocations}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateStreak(items: ActivityItem[]): number {
  const dates = items
    .map((i) => i.activity_date ?? i.activityDate)
    .filter(Boolean)
    .map((d) => format(parseISO(d!), "yyyy-MM-dd"))
    .sort()
    .reverse();

  const uniqueDates = [...new Set(dates)];
  if (uniqueDates.length === 0) return 0;

  let streak = 0;
  const today = format(new Date(), "yyyy-MM-dd");
  const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd");

  if (uniqueDates[0] !== today && uniqueDates[0] !== yesterday) return 0;

  for (let i = 0; i < uniqueDates.length; i++) {
    const expected = format(new Date(Date.now() - i * 86400000), "yyyy-MM-dd");
    if (uniqueDates[i] === expected) {
      streak++;
    } else if (i === 0 && uniqueDates[0] === yesterday) {
      // Started from yesterday, shift expectation
      const shifted = format(new Date(Date.now() - (i + 1) * 86400000), "yyyy-MM-dd");
      if (uniqueDates[i] === shifted) streak++;
      else break;
    } else {
      break;
    }
  }
  return streak;
}
