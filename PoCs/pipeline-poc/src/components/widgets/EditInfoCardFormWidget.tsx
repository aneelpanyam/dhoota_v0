"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { RichMarkdownEditor } from "@/components/ui/RichMarkdownEditor";

interface InfoCardData {
  id: string;
  title: string;
  content_raw?: string;
  content?: Record<string, unknown>;
  card_type: string;
  visibility: string;
}

interface Props {
  infoCard: InfoCardData;
  onSave: (optionId: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}

const CARD_TYPE_OPTIONS = ["about", "contact", "service", "custom"];
const VISIBILITY_OPTIONS = ["private", "public"];

function getContentRaw(card: InfoCardData): string {
  if (typeof card.content_raw === "string") return card.content_raw;
  const content = card.content as Record<string, unknown> | undefined;
  if (content && typeof content.content_raw === "string") return content.content_raw;
  if (content && typeof content.text === "string") return content.text;
  return "";
}

export function EditInfoCardFormWidget({ infoCard, onSave, onCancel }: Props) {
  const [title, setTitle] = useState(infoCard.title ?? "");
  const [contentRaw, setContentRaw] = useState(getContentRaw(infoCard));
  const [cardType, setCardType] = useState(infoCard.card_type ?? "custom");
  const [visibility, setVisibility] = useState(infoCard.visibility ?? "private");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params: Record<string, unknown> = {
      info_card_id: infoCard.id,
      title: title || undefined,
      content_raw: contentRaw || undefined,
      card_type: cardType,
      visibility,
    };
    onSave("info_card.edit", params);
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-4">
      <h4 className="font-semibold text-sm">Edit Info Card</h4>

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
          <RichMarkdownEditor
            value={contentRaw}
            onChange={setContentRaw}
            placeholder="Enter content (use toolbar for formatting)..."
            minRows={6}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Card Type</label>
            <select
              value={cardType}
              onChange={(e) => setCardType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-background"
            >
              {CARD_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

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
