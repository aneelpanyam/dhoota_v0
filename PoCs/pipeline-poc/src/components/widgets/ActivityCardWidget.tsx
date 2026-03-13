"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { Widget, WidgetAction } from "@/types/api";
import {
  Calendar,
  MapPin,
  Tag,
  Eye,
  Pencil,
  MessageSquare,
  Trash2,
  Image as ImageIcon,
  Globe,
  Lock,
  Users,
  Pin,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import type { ContextItem } from "@/components/chat/ContextStrip";
import { EditActivityFormWidget } from "./EditActivityFormWidget";
import { MediaLightbox, type LightboxImage } from "./MediaLightbox";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
  onPinToContext?: (item: ContextItem) => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Eye, Pencil, MessageSquare, Trash2, Image: ImageIcon,
};

const visibilityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  private: Lock,
  team: Users,
  public: Globe,
};

function resolveMediaUrl(item: Record<string, unknown>): string | null {
  if (typeof item.url === "string" && item.url.startsWith("http")) return item.url;
  const key = (item.s3_key ?? item.s3Key) as string | undefined;
  if (key) return `/api/media/serve?key=${encodeURIComponent(key)}`;
  return null;
}

function isImageMime(item: Record<string, unknown>): boolean {
  const mime = (item.mimeType ?? item.mime_type ?? "") as string;
  return mime.startsWith("image/");
}

export function ActivityCardWidget({ widget, onAction, onConfirm, onPinToContext }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const d = widget.data;
  const title = (d.title as string) ?? "Untitled Activity";
  const description = d.description as string | null;
  const status = d.status as string;
  const visibility = d.visibility as string;
  const activityDate = (d.activityDate ?? d.activity_date) as string | null;
  const location = d.location as string | null;
  const tags = (d.tags as { id: string; name: string; color: string | null }[]) ?? [];
  const media = (d.media as Record<string, unknown>[]) ?? [];
  const notes = (d.notes as Record<string, unknown>[]) ?? [];
  const noteCount = (d.noteCount ?? d.note_count ?? notes.length) as number;
  const mediaCount = (d.mediaCount ?? d.media_count ?? media.length) as number;

  const statusColors: Record<string, string> = {
    planned: "bg-blue-100 text-blue-700",
    in_progress: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-gray-100 text-gray-500",
  };

  const VisIcon = visibilityIcons[visibility] ?? Globe;

  if (isEditing) {
    return (
      <EditActivityFormWidget
        activity={{
          id: (d.id as string) ?? "",
          title,
          description,
          activity_date: activityDate as string | null,
          location,
          status,
          visibility,
        }}
        onSave={(optionId, params) => {
          setIsEditing(false);
          onConfirm(optionId, params);
        }}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  const imageMedia = media.filter((m) => isImageMime(m) && resolveMediaUrl(m));

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* Hero image / grid -- social media style */}
      {imageMedia.length > 0 && <MediaGrid images={imageMedia} />}

      <div className="p-4 space-y-2.5">
        {/* Title + status badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base md:text-[15px] leading-snug flex-1 break-words min-w-0">{title}</h3>
          <div className="flex gap-1.5 shrink-0 items-center">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[status] ?? "bg-gray-100"}`}>
              {status?.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Description */}
        {description && (
          <DescriptionText text={description} />
        )}

        {/* Meta row */}
        <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-1 md:gap-x-4 md:gap-y-1 text-xs text-muted-foreground pt-0.5">
          {activityDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(activityDate as string).toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          )}
          {location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <VisIcon className="h-3.5 w-3.5" />
            {visibility}
          </span>
          {mediaCount > 0 && imageMedia.length === 0 && (
            <span className="flex items-center gap-1">
              <ImageIcon className="h-3.5 w-3.5" />
              {mediaCount} media
            </span>
          )}
          {noteCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {noteCount} note{noteCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {tags.map((tag) => (
              <span
                key={tag.id ?? tag.name}
                className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 font-medium"
                style={{
                  backgroundColor: tag.color ? `${tag.color}15` : undefined,
                  color: tag.color ?? undefined,
                }}
              >
                <Tag className="h-2.5 w-2.5" />
                {tag.name}
              </span>
            ))}
          </div>
        )}

        {/* Notes section */}
        {notes.length > 0 && (
          <NotesSection notes={notes} />
        )}

        {/* Action bar */}
        {(widget.actions?.length || onPinToContext) && (
          <ActivityActionBar
            widget={widget}
            onAction={onAction}
            onPinToContext={onPinToContext}
            onEdit={() => setIsEditing(true)}
            d={d}
            title={title}
            status={status}
            activityDate={activityDate}
            location={location}
            description={description}
            tags={tags}
          />
        )}
      </div>
    </div>
  );
}

function DescriptionText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const needsExpand = text.length > 200;
  const displayText = expanded || !needsExpand ? text : text.slice(0, 200);

  return (
    <div>
      <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap break-words">
        {displayText}
        {!expanded && needsExpand && "..."}
      </p>
      {needsExpand && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary hover:underline mt-0.5"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function ActivityActionBar({
  widget,
  onAction,
  onPinToContext,
  onEdit,
  d,
  title,
  status,
  activityDate,
  location,
  description,
  tags,
}: {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onPinToContext?: (item: ContextItem) => void;
  onEdit: () => void;
  d: Record<string, unknown>;
  title: string;
  status: string;
  activityDate: string | null;
  location: string | null;
  description: string | null;
  tags: { id: string; name: string; color: string | null }[];
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = dropdownRef.current?.contains(target);
      const inPortal = (target as Element).closest?.(".activity-actions-portal");
      if (!inTrigger && !inPortal) setDropdownOpen(false);
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  useEffect(() => {
    if (dropdownOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownRect({ top: rect.bottom + 4, left: rect.left });
    } else {
      setDropdownRect(null);
    }
  }, [dropdownOpen]);

  const handlePin = () => {
    const summaryParts = [
      status && `Status: ${status.replace("_", " ")}`,
      activityDate && `Date: ${new Date(activityDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      location && `Location: ${location}`,
      description && `Description: ${description}`,
      tags.length > 0 && `Tags: ${tags.map((t) => t.name).join(", ")}`,
    ].filter(Boolean);
    onPinToContext?.({
      entityType: "activity",
      entityId: String(d.id ?? title),
      label: title,
      summary: summaryParts.join("; "),
      viewAction: d.id
        ? { optionId: "activity.view", params: { activity_id: String(d.id) } }
        : undefined,
    });
  };

  const allActions = [
    ...(widget.actions ?? []),
    ...(onPinToContext ? [{ optionId: "_pin", label: "Pin", icon: "Pin" }] : []),
  ];

  const primaryActions = allActions.filter((a) =>
    a.optionId === "activity.view" || a.optionId === "activity.edit"
  );
  const secondaryActions = allActions.filter((a) =>
    a.optionId !== "activity.view" && a.optionId !== "activity.edit"
  );

  const renderAction = (action: { optionId: string; label: string; icon: string }, i: number) => {
    if (action.optionId === "_pin") {
      return (
        <button
          key="_pin"
          onClick={() => { handlePin(); setDropdownOpen(false); }}
          className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition"
        >
          <Pin className="h-4 w-4" />
          Pin
        </button>
      );
    }
    const Icon = iconMap[action.icon];
    const isEdit = action.optionId === "activity.edit";
    return (
      <button
        key={i}
        onClick={() => {
          setDropdownOpen(false);
          if (isEdit) onEdit();
          else onAction(action as WidgetAction);
        }}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition"
      >
        {Icon && <Icon className="h-4 w-4" />}
        {action.label}
      </button>
    );
  };

  return (
    <div className="pt-2 border-t -mx-1">
      {/* Desktop: inline buttons */}
      <div className="hidden md:flex gap-1">
        {allActions.map((action, i) => {
          if (action.optionId === "_pin") {
            return (
              <button
                key="_pin"
                onClick={handlePin}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-primary transition"
                title="Pin to context for insights"
              >
                <Pin className="h-4 w-4" />
                Pin
              </button>
            );
          }
          const Icon = iconMap[action.icon];
          const isEdit = action.optionId === "activity.edit";
          return (
            <button
              key={i}
              onClick={() => (isEdit ? onEdit() : onAction(action as WidgetAction))}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              {Icon && <Icon className="h-4 w-4" />}
              {action.label}
            </button>
          );
        })}
      </div>
      {/* Mobile: primary actions + dropdown */}
      <div ref={dropdownRef} className="md:hidden flex flex-wrap gap-2">
        {primaryActions.slice(0, 2).map((action, i) => {
          if (action.optionId === "_pin") return null;
          const Icon = iconMap[action.icon];
          const isEdit = action.optionId === "activity.edit";
          return (
            <button
              key={i}
              onClick={() => (isEdit ? onEdit() : onAction(action as WidgetAction))}
              className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg border bg-card text-foreground hover:bg-muted transition"
            >
              {Icon && <Icon className="h-4 w-4" />}
              {action.label}
            </button>
          );
        })}
        {secondaryActions.length > 0 && (
          <div ref={dropdownRef} className="relative">
            <button
              ref={triggerRef}
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-card text-sm hover:bg-muted transition"
            >
              <MoreHorizontal className="h-4 w-4" />
              Actions
              <ChevronDown className={`h-3 w-3 transition ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && dropdownRect &&
              createPortal(
                <div
                  className="activity-actions-portal fixed py-1 rounded-lg border bg-card shadow-lg z-[9999] min-w-[180px]"
                  style={{ top: dropdownRect.top, left: dropdownRect.left }}
                >
                  {secondaryActions.map((action, i) => renderAction(action, i))}
                </div>,
                document.body
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function NotesSection({ notes }: { notes: Record<string, unknown>[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayNotes = expanded ? notes : notes.slice(0, 2);
  return (
    <div className="pt-1.5 border-t space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" />
        Notes ({notes.length})
      </div>
      {displayNotes.map((note, i) => {
        const content = (note.content as string) ?? "";
        const createdAt = note.created_at as string;
        const dateStr = createdAt
          ? new Date(createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })
          : "";
        return (
          <div key={(note.id as string) ?? i} className="bg-muted/40 rounded-lg px-3 py-2">
            <p className="text-sm text-foreground/80">{content}</p>
            {dateStr && (
              <p className="text-[10px] text-muted-foreground mt-1">{dateStr}</p>
            )}
          </div>
        );
      })}
      {notes.length > 2 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-primary hover:underline"
        >
          {expanded ? "Show less" : `Show all ${notes.length} notes`}
        </button>
      )}
    </div>
  );
}

function MediaGrid({ images }: { images: Record<string, unknown>[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const count = images.length;

  const allImages: LightboxImage[] = images.map((m) => ({
    url: resolveMediaUrl(m)!,
    alt: (m.original_filename as string) ?? "media",
  }));

  const urls = allImages.slice(0, 4);

  const open = (i: number) => setLightboxIndex(i);

  const gridContent = (() => {
    if (count === 1) {
      return (
        <div className="w-full max-h-80 overflow-hidden cursor-pointer" onClick={() => open(0)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[0].url} alt={urls[0].alt} className="w-full h-full object-cover" />
        </div>
      );
    }

    if (count === 2) {
      return (
        <>
          <div className="flex flex-col gap-0.5 md:hidden">
            {urls.map((u, i) => (
              <div key={i} className="aspect-[4/3] overflow-hidden cursor-pointer" onClick={() => open(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt={u.alt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="hidden md:grid grid-cols-2 gap-0.5 max-h-64 overflow-hidden">
            {urls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u.url} alt={u.alt} className="w-full h-64 object-cover cursor-pointer" onClick={() => open(i)} />
            ))}
          </div>
        </>
      );
    }

    if (count === 3) {
      return (
        <>
          <div className="flex flex-col gap-0.5 md:hidden">
            {urls.map((u, i) => (
              <div key={i} className="aspect-[4/3] overflow-hidden cursor-pointer" onClick={() => open(i)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u.url} alt={u.alt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div className="hidden md:grid grid-cols-2 gap-0.5 max-h-64 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls[0].url} alt={urls[0].alt} className="w-full h-64 object-cover row-span-2 cursor-pointer" onClick={() => open(0)} />
            <div className="flex flex-col gap-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[1].url} alt={urls[1].alt} className="w-full h-[calc(50%-1px)] object-cover cursor-pointer" onClick={() => open(1)} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[2].url} alt={urls[2].alt} className="w-full h-[calc(50%-1px)] object-cover cursor-pointer" onClick={() => open(2)} />
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flex flex-col gap-0.5 md:hidden">
          {urls.map((u, i) => (
            <div key={i} className="relative aspect-[4/3] overflow-hidden cursor-pointer" onClick={() => open(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.url} alt={u.alt} className="w-full h-full object-cover" />
              {i === 3 && count > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">+{count - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="hidden md:grid grid-cols-2 grid-rows-2 gap-0.5 max-h-64 overflow-hidden">
          {urls.map((u, i) => (
            <div key={i} className="relative h-32 overflow-hidden cursor-pointer" onClick={() => open(i)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u.url} alt={u.alt} className="w-full h-full object-cover" />
              {i === 3 && count > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">+{count - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  })();

  return (
    <>
      {gridContent}
      {lightboxIndex !== null && (
        <MediaLightbox
          images={allImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
