"use client";

import { useState, useEffect, useRef } from "react";
import type { Widget, WidgetAction } from "@/types/api";
import {
  Plus, List, BarChart3, Tags, Eye, Pencil, MessageSquare,
  Trash2, Image, Zap, Settings, Users, Globe, Inbox,
  ChevronDown,
} from "lucide-react";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Plus, List, BarChart3, Tags, Eye, Pencil, MessageSquare,
  Trash2, Image, Zap, Settings, Users, Globe, Inbox, TagIcon: Tags,
};

export function DefaultOptionsMenuWidget({ widget, onOptionSelect }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const d = widget.data;
  const title = (d.title as string) ?? "What would you like to do?";
  const options = (d.options as { optionId: string; name: string; icon: string; description?: string }[]) ?? [];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [dropdownOpen]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{title}</p>
      {/* Mobile: collapsible dropdown */}
      <div ref={dropdownRef} className="md:hidden relative">
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center justify-between w-full gap-2 px-4 py-3 rounded-xl border bg-card hover:bg-muted hover:border-primary/30 transition text-sm font-medium"
        >
          Options
          <ChevronDown className={`h-4 w-4 transition ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 py-1 rounded-xl border bg-card shadow-lg z-50 overflow-hidden">
            {options.map((opt) => {
              const Icon = iconMap[opt.icon] ?? Zap;
              return (
                <button
                  key={opt.optionId}
                  onClick={() => {
                    setDropdownOpen(false);
                    onOptionSelect(opt.optionId);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted transition"
                >
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span>{opt.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {/* Desktop: button grid */}
      <div className="hidden md:flex flex-wrap gap-2">
        {options.map((opt) => {
          const Icon = iconMap[opt.icon] ?? Zap;
          return (
            <button
              key={opt.optionId}
              onClick={() => onOptionSelect(opt.optionId)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-card hover:bg-muted hover:border-primary/30 transition text-sm"
            >
              <Icon className="h-4 w-4 text-primary" />
              <span>{opt.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
