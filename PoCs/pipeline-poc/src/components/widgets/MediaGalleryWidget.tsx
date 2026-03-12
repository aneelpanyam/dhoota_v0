"use client";

import type { Widget, WidgetAction } from "@/types/api";
import { FileImage, Film, FileText } from "lucide-react";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

export function MediaGalleryWidget({ widget }: Props) {
  const items = (widget.data.items as {
    id: string;
    url: string;
    thumbnailUrl?: string;
    mimeType: string;
    filename: string;
  }[]) ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground text-sm">
        No media files.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => {
          const isImage = item.mimeType.startsWith("image/");
          const isVideo = item.mimeType.startsWith("video/");

          return (
            <div
              key={item.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-pointer"
            >
              {isImage ? (
                <img
                  src={item.thumbnailUrl ?? item.url}
                  alt={item.filename}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  {isVideo ? <Film className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
                  <span className="text-xs truncate px-2">{item.filename}</span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
                <FileImage className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
