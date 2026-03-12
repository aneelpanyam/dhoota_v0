"use client";

import { useState } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import { Film, FileText } from "lucide-react";
import { MediaLightbox, type LightboxImage } from "./MediaLightbox";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

export function MediaGalleryWidget({ widget }: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

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

  const imageItems = items.filter((item) => item.mimeType.startsWith("image/"));
  const lightboxImages: LightboxImage[] = imageItems.map((item) => ({
    url: item.url,
    alt: item.filename,
  }));

  function handleImageClick(item: typeof items[number]) {
    const idx = imageItems.findIndex((img) => img.id === item.id);
    if (idx >= 0) setLightboxIndex(idx);
  }

  return (
    <>
      <div className="rounded-xl border bg-card p-3">
        <div className="grid grid-cols-3 gap-2">
          {items.map((item) => {
            const isImage = item.mimeType.startsWith("image/");
            const isVideo = item.mimeType.startsWith("video/");

            return (
              <div
                key={item.id}
                className="relative aspect-square rounded-lg overflow-hidden bg-muted group cursor-pointer"
                onClick={isImage ? () => handleImageClick(item) : undefined}
              >
                {isImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
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

                {isImage && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {lightboxIndex !== null && (
        <MediaLightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
