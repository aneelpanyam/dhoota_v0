"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, PlusCircle, UserCircle, FileText, MoreVertical, X } from "lucide-react";
import type { OptionReference } from "@/types/api";
import { getOptionIcon } from "@/lib/icons/option-icons";

const TENANT_TOP_OPTIONS = [
  { optionId: "activity.create", icon: PlusCircle, label: "Add Activity" },
  { optionId: "profile.set_avatar", icon: UserCircle, label: "Set Avatar" },
  { optionId: "info_card.create", icon: FileText, label: "Info Cards" },
] as const;

interface OptionsStripProps {
  defaultOptions: OptionReference[];
  isPublicMode: boolean;
  featureFlags?: string[];
  representativeAvatarUrl?: string | null;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onExplore: () => void;
  contextFilters?: { id: string; name: string }[];
  /** When provided, public.info_cards opens the side panel instead of running the option */
  onOpenInfoPanel?: () => void;
}

export function OptionsStrip({
  defaultOptions,
  isPublicMode,
  featureFlags = [],
  representativeAvatarUrl,
  onOptionSelect,
  onExplore,
  contextFilters = [],
  onOpenInfoPanel,
}: OptionsStripProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    if (moreOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [moreOpen]);

  const optionIds = new Set(defaultOptions.map((o) => o.optionId));
  const hasPublicSite = featureFlags.includes("public_site_enabled");

  const tenantTopActions = TENANT_TOP_OPTIONS.filter((def) => {
    if (def.optionId === "info_card.create" && !hasPublicSite) return false;
    return optionIds.has(def.optionId);
  });

  const tenantMoreOptions = defaultOptions.filter(
    (o) => !tenantTopActions.some((t) => t.optionId === o.optionId)
  );

  const publicTopCount = 3;
  const publicTopOptions = defaultOptions.slice(0, publicTopCount);
  const publicMoreOptions = defaultOptions.slice(publicTopCount);

  const topActions = isPublicMode
    ? publicTopOptions.map((opt) => ({
        optionId: opt.optionId,
        label: opt.name,
        Icon: getOptionIcon(opt.icon),
      }))
    : tenantTopActions.map((def) => ({
        optionId: def.optionId,
        label: def.label,
        Icon: def.icon,
      }));

  const moreOptions = isPublicMode ? publicMoreOptions : tenantMoreOptions;
  const filterCount = contextFilters.length;

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-t bg-muted/30 overflow-x-auto">
      <button
        onClick={onExplore}
        className="flex items-center gap-2 shrink-0 p-2 md:px-3 md:py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
        title="Explore"
        aria-label="Explore"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="hidden md:inline text-sm font-medium">Explore</span>
      </button>

      {topActions.map(({ optionId, label, Icon }) => {
        const showAvatar = isPublicMode && optionId === "public.about" && representativeAvatarUrl;
        return (
          <button
            key={optionId}
            onClick={() => {
              if (isPublicMode && optionId === "public.info_cards" && onOpenInfoPanel) {
                onOpenInfoPanel();
              } else {
                onOptionSelect(optionId);
              }
            }}
            className="flex items-center gap-2 shrink-0 p-2 md:px-3 md:py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
            title={label}
            aria-label={label}
          >
            {showAvatar ? (
              <img
                src={representativeAvatarUrl}
                alt=""
                className="h-4 w-4 rounded-full object-cover shrink-0"
              />
            ) : (
              <Icon className="h-4 w-4 text-primary" />
            )}
            <span className="hidden md:inline text-sm font-medium">{label}</span>
          </button>
        );
      })}

      {moreOptions.length > 0 && (
        <div ref={moreRef} className="relative shrink-0">
          <button
            onClick={() => setMoreOpen((v) => !v)}
            className="flex items-center gap-2 p-2 md:px-3 md:py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
            aria-label="More options"
            aria-expanded={moreOpen}
          >
            <MoreVertical className="h-4 w-4" />
            <span className="hidden md:inline text-sm font-medium">More</span>
          </button>

          {moreOpen && (
            <>
              <div
                className="fixed inset-0 z-[10000] bg-black/50"
                aria-hidden
                onClick={() => setMoreOpen(false)}
              />
              <div className="fixed bottom-0 left-0 right-0 z-[10001] w-full max-w-[100vw] max-h-[70vh] overflow-y-auto overflow-x-hidden rounded-t-2xl border-t bg-background shadow-lg pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom)]">
                <div className="sticky top-0 py-2 px-4 border-b bg-background flex items-center justify-between z-10">
                  <span className="text-sm font-medium text-muted-foreground">More options</span>
                  <button
                    onClick={() => setMoreOpen(false)}
                    className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="py-1 bg-background">
                    {moreOptions.map((opt) => {
                    const Icon = getOptionIcon(opt.icon);
                    const showAvatar = isPublicMode && opt.optionId === "public.about" && representativeAvatarUrl;
                    return (
                      <button
                        key={opt.optionId}
                        onClick={() => {
                          setMoreOpen(false);
                          if (isPublicMode && opt.optionId === "public.info_cards" && onOpenInfoPanel) {
                            onOpenInfoPanel();
                          } else {
                            onOptionSelect(opt.optionId, opt.params);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm hover:bg-muted transition"
                      >
                        {showAvatar ? (
                          <img
                            src={representativeAvatarUrl}
                            alt=""
                            className="h-4 w-4 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <Icon className="h-4 w-4 text-primary shrink-0" />
                        )}
                        <span>{opt.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {filterCount > 0 && (
        <span className="hidden md:inline shrink-0 text-xs text-muted-foreground ml-auto" title={`${filterCount} filter${filterCount !== 1 ? "s" : ""} available`}>
          {filterCount} filter{filterCount !== 1 ? "s" : ""}
        </span>
      )}
    </div>
  );
}
