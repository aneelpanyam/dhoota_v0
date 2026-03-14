"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface AnnouncementData {
  id: string;
  title: string;
  content?: string;
  visibility: string;
  pinned: boolean;
}

interface Props {
  announcement: AnnouncementData;
  onSave: (optionId: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}

const VISIBILITY_OPTIONS = ["private", "public"];
const PINNED_OPTIONS = [
  { value: "true", label: "Yes" },
  { value: "false", label: "No" },
];

export function EditAnnouncementFormWidget({ announcement, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(announcement.title ?? "");
  const [content, setContent] = useState(announcement.content ?? "");
  const [visibility, setVisibility] = useState(announcement.visibility ?? "private");
  const [pinned, setPinned] = useState(announcement.pinned ? "true" : "false");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params: Record<string, unknown> = {
      announcement_id: announcement.id,
      title: title || undefined,
      content: content || undefined,
      visibility,
      pinned: pinned === "true",
    };
    onSave("announcement.edit", params);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-4">
      <h4 className="font-semibold text-sm">Edit Announcement</h4>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            placeholder="Enter content (markdown supported)..."
            className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-y font-mono min-h-[120px]"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Supports markdown: **bold**, *italic*, headers, lists, links</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background"
            >
              {VISIBILITY_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Pinned</label>
            <select
              value={pinned}
              onChange={(e) => setPinned(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background"
            >
              {PINNED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t">
        <button
          type="submit"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
        >
          <Check className="h-4 w-4" />
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition"
        >
          <X className="h-4 w-4" />
          Cancel
        </button>
      </div>
    </form>
  );
}
