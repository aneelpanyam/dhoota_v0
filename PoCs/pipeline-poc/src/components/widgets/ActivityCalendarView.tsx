"use client";

import { useState, useMemo } from "react";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths, isToday, parseISO,
} from "date-fns";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  MapPin, Eye, ImageIcon,
} from "lucide-react";
import type { WidgetAction } from "@/types/api";

interface ActivityItem {
  id: string;
  title: string;
  status?: string;
  activity_date?: string;
  activityDate?: string;
  location?: string;
  description?: string;
  tags?: { name: string; color?: string }[];
  media_count?: number;
  mediaCount?: number;
  note_count?: number;
  noteCount?: number;
  [key: string]: unknown;
}

interface Props {
  items: ActivityItem[];
  actions?: WidgetAction[];
  onAction: (action: WidgetAction) => void;
}

const statusDotColor: Record<string, string> = {
  planned: "bg-blue-400",
  in_progress: "bg-yellow-400",
  completed: "bg-green-400",
  cancelled: "bg-gray-300",
};

const statusBgColor: Record<string, string> = {
  planned: "bg-blue-50 border-blue-200",
  in_progress: "bg-yellow-50 border-yellow-200",
  completed: "bg-green-50 border-green-200",
  cancelled: "bg-gray-50 border-gray-200",
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ActivityCalendarView({ items, actions, onAction }: Props) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const activityByDate = useMemo(() => {
    const map = new Map<string, ActivityItem[]>();
    for (const item of items) {
      const raw = item.activity_date ?? item.activityDate;
      if (!raw) continue;
      const dateKey = format(parseISO(raw), "yyyy-MM-dd");
      const existing = map.get(dateKey) ?? [];
      existing.push(item);
      map.set(dateKey, existing);
    }
    return map;
  }, [items]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart);
    const calEnd = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const selectedActivities = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return activityByDate.get(key) ?? [];
  }, [selectedDate, activityByDate]);

  const monthStats = useMemo(() => {
    let total = 0;
    let daysWithActivities = 0;
    for (const [dateKey, acts] of activityByDate) {
      const d = parseISO(dateKey);
      if (isSameMonth(d, currentMonth)) {
        total += acts.length;
        daysWithActivities++;
      }
    }
    return { total, daysWithActivities };
  }, [activityByDate, currentMonth]);

  const handleViewActivity = (activityId: string) => {
    const viewAction = actions?.find((a) => a.optionId === "activity.view");
    onAction({
      label: viewAction?.label ?? "View Activity Details",
      icon: viewAction?.icon ?? "Eye",
      optionId: "activity.view",
      targetResourceId: activityId,
      params: { activity_id: activityId },
    });
  };

  return (
    <div className="space-y-3">
      {/* Month navigation + stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-muted transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold min-w-[140px] text-center">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-muted transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>{monthStats.total} activit{monthStats.total !== 1 ? "ies" : "y"}</span>
          <span className="opacity-40">·</span>
          <span>{monthStats.daysWithActivities} active day{monthStats.daysWithActivities !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 bg-muted/50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1.5">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const dayActivities = activityByDate.get(key) ?? [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(isSelected ? null : day)}
                className={`
                  relative min-h-[52px] p-1 border-t border-r text-left transition-all
                  ${!inMonth ? "opacity-30" : ""}
                  ${isSelected ? "bg-primary/5 ring-1 ring-primary/30" : "hover:bg-muted/40"}
                  ${i % 7 === 0 ? "border-l-0" : ""}
                `}
              >
                <span
                  className={`
                    text-[11px] leading-none block mb-0.5
                    ${today ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center font-bold" : ""}
                    ${!today && inMonth ? "font-medium" : ""}
                  `}
                >
                  {format(day, "d")}
                </span>

                {dayActivities.length > 0 && (
                  <div className="flex flex-wrap gap-[2px] mt-0.5">
                    {dayActivities.slice(0, 3).map((act, j) => (
                      <span
                        key={j}
                        className={`w-1.5 h-1.5 rounded-full ${statusDotColor[act.status ?? ""] ?? "bg-primary/50"}`}
                        title={act.title}
                      />
                    ))}
                    {dayActivities.length > 3 && (
                      <span className="text-[8px] text-muted-foreground leading-none">
                        +{dayActivities.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground px-1">
        {Object.entries(statusDotColor).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            {status.replace("_", " ")}
          </span>
        ))}
      </div>

      {/* Selected date detail panel */}
      {selectedDate && (
        <div className="rounded-lg border bg-card overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="px-3 py-2 bg-muted/30 border-b flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {selectedActivities.length} activit{selectedActivities.length !== 1 ? "ies" : "y"}
            </span>
          </div>

          {selectedActivities.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No activities on this day.
            </div>
          ) : (
            <div className="divide-y">
              {selectedActivities.map((act) => (
                <button
                  key={act.id}
                  onClick={() => handleViewActivity(act.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-muted/30 transition border-l-2 ${statusBgColor[act.status ?? ""] ?? "border-gray-200"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate flex-1">{act.title}</span>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                  {act.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                      {act.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    {act.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {act.location}
                      </span>
                    )}
                    {((act.media_count ?? act.mediaCount ?? 0) as number) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <ImageIcon className="h-2.5 w-2.5" />
                        {(act.media_count ?? act.mediaCount) as number}
                      </span>
                    )}
                    {act.tags && act.tags.length > 0 && (
                      <div className="flex gap-1">
                        {act.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag.name}
                            className="px-1 py-0 rounded text-[9px] bg-muted"
                            style={{ color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
