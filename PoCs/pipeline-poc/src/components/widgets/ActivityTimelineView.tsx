"use client";

import { useMemo } from "react";
import { format, parseISO, isToday, isYesterday, differenceInDays } from "date-fns";
import {
  Calendar, MapPin, Eye, MessageSquare,
  Image as ImageIcon, Clock, CheckCircle2, Circle, XCircle, Timer,
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
  media?: Record<string, unknown>[];
  [key: string]: unknown;
}

interface Props {
  items: ActivityItem[];
  actions?: WidgetAction[];
  onAction: (action: WidgetAction) => void;
}

const statusConfig: Record<string, { icon: typeof Circle; color: string; bg: string }> = {
  planned: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500" },
  in_progress: { icon: Timer, color: "text-yellow-500", bg: "bg-yellow-500" },
  completed: { icon: CheckCircle2, color: "text-green-500", bg: "bg-green-500" },
  cancelled: { icon: XCircle, color: "text-gray-400", bg: "bg-gray-400" },
};

function getDateLabel(dateStr: string): string {
  const d = parseISO(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  const diff = differenceInDays(new Date(), d);
  if (diff <= 7 && diff > 0) return format(d, "EEEE");
  return format(d, "MMMM d, yyyy");
}

function getFirstImageUrl(media: Record<string, unknown>[]): string | null {
  for (const m of media) {
    const mime = (m.mimeType ?? m.mime_type ?? "") as string;
    if (!mime.startsWith("image/")) continue;
    if (typeof m.url === "string" && m.url.startsWith("http")) return m.url;
    const key = (m.s3_key ?? m.s3Key) as string | undefined;
    if (key) return `/api/media/serve?key=${encodeURIComponent(key)}`;
  }
  return null;
}

export function ActivityTimelineView({ items, actions, onAction }: Props) {
  const groupedByDate = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const da = a.activity_date ?? a.activityDate ?? "";
      const db = b.activity_date ?? b.activityDate ?? "";
      return db.localeCompare(da);
    });

    const groups: { dateKey: string; label: string; date: string; items: ActivityItem[] }[] = [];
    for (const item of sorted) {
      const raw = item.activity_date ?? item.activityDate;
      if (!raw) continue;
      const dateKey = format(parseISO(raw), "yyyy-MM-dd");
      const last = groups[groups.length - 1];
      if (last && last.dateKey === dateKey) {
        last.items.push(item);
      } else {
        groups.push({ dateKey, label: getDateLabel(raw), date: raw, items: [item] });
      }
    }
    return groups;
  }, [items]);

  const noDateItems = items.filter((i) => !(i.activity_date ?? i.activityDate));

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

  if (groupedByDate.length === 0 && noDateItems.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No activities to display on the timeline.
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />

      <div className="space-y-1">
        {groupedByDate.map((group) => (
          <div key={group.dateKey}>
            {/* Date header */}
            <div className="flex items-center gap-3 py-2 relative z-10">
              <div className="w-10 h-10 rounded-full bg-muted border-2 border-background flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <span className="text-sm font-semibold">{group.label}</span>
                {group.label !== format(parseISO(group.date), "MMMM d, yyyy") && (
                  <span className="text-[10px] text-muted-foreground ml-2">
                    {format(parseISO(group.date), "MMM d, yyyy")}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {group.items.length} activit{group.items.length !== 1 ? "ies" : "y"}
              </span>
            </div>

            {/* Activity cards for this date */}
            <div className="ml-[19px] pl-6 space-y-2 pb-2">
              {group.items.map((act) => {
                const cfg = statusConfig[act.status ?? ""] ?? statusConfig.planned;
                const StatusIcon = cfg.icon;
                const mediaArr = Array.isArray(act.media) ? act.media : [];
                const thumbUrl = getFirstImageUrl(mediaArr);
                const mediaCount = (act.media_count ?? act.mediaCount ?? 0) as number;
                const noteCount = (act.note_count ?? act.noteCount ?? 0) as number;

                return (
                  <button
                    key={act.id}
                    onClick={() => handleViewActivity(act.id)}
                    className="w-full text-left group relative"
                  >
                    {/* Connector dot */}
                    <div className={`absolute -left-[25px] top-3 w-2.5 h-2.5 rounded-full border-2 border-background ${cfg.bg}`} />

                    <div className="rounded-lg border bg-card p-3 hover:shadow-sm hover:border-primary/20 transition-all">
                      <div className="flex gap-3">
                        {thumbUrl && (
                          <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-muted">
                            <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <StatusIcon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                            <span className="text-sm font-medium truncate group-hover:text-primary transition">
                              {act.title}
                            </span>
                            <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0 ml-auto" />
                          </div>

                          {act.description && (
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {act.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                            {act.location && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {act.location}
                              </span>
                            )}
                            {mediaCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <ImageIcon className="h-2.5 w-2.5" />
                                {mediaCount}
                              </span>
                            )}
                            {noteCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-2.5 w-2.5" />
                                {noteCount}
                              </span>
                            )}
                            {act.tags && act.tags.length > 0 && (
                              <div className="flex gap-1">
                                {act.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag.name}
                                    className="px-1 rounded text-[9px] bg-muted"
                                    style={{ color: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {noDateItems.length > 0 && (
          <div>
            <div className="flex items-center gap-3 py-2 relative z-10">
              <div className="w-10 h-10 rounded-full bg-muted/60 border-2 border-background flex items-center justify-center shrink-0">
                <Circle className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-semibold text-muted-foreground">No date set</span>
            </div>
            <div className="ml-[19px] pl-6 space-y-2 pb-2">
              {noDateItems.map((act) => (
                <button
                  key={act.id}
                  onClick={() => handleViewActivity(act.id)}
                  className="w-full text-left rounded-lg border bg-card p-3 hover:shadow-sm hover:border-primary/20 transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate group-hover:text-primary transition">
                      {act.title}
                    </span>
                    <Eye className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition shrink-0 ml-auto" />
                  </div>
                  {act.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{act.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
