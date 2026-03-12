"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, Download } from "lucide-react";

export interface LightboxImage {
  url: string;
  alt: string;
}

interface Props {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}

export function MediaLightbox({ images, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const count = images.length;
  const current = images[index];

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : count - 1));
  }, [count]);

  const goNext = useCallback(() => {
    setIndex((i) => (i < count - 1 ? i + 1 : 0));
  }, [count]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  // Prevent body scroll while lightbox is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90" />

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 z-10">
        <span className="text-white/80 text-sm font-medium">
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={current.url}
            download={current.alt}
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <Download className="h-5 w-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Image */}
      <div
        className="relative z-10 flex items-center justify-center max-w-[90vw] max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={current.url}
          src={current.url}
          alt={current.alt}
          className="max-w-full max-h-[80vh] object-contain rounded-lg select-none"
          draggable={false}
        />
      </div>

      {/* Navigation arrows */}
      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 hover:text-white transition"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Thumbnail strip */}
      {count > 1 && (
        <div
          className="absolute bottom-4 inset-x-0 z-10 flex justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1.5 px-3 py-2 rounded-xl bg-black/50 backdrop-blur-sm max-w-[90vw] overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition ${
                  i === index ? "border-white" : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
