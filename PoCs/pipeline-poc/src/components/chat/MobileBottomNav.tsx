"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  PlusCircle,
  UserCircle,
  FileText,
  MoreVertical,
  X,
} from "lucide-react";
import type { OptionReference } from "@/types/api";
import { getOptionIcon } from "@/lib/icons/option-icons";

const TENANT_TOP_OPTIONS = [
  { optionId: "activity.create", icon: PlusCircle, label: "Add Activity" },
  { optionId: "profile.set_avatar", icon: UserCircle, label: "Set Avatar" },
  { optionId: "info_card.create", icon: FileText, label: "Info Cards" },
] as const;

interface MobileBottomNavProps {
  defaultOptions: OptionReference[];
  isPublicMode: boolean;
  featureFlags?: string[];
  representativeAvatarUrl?: string | null;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onExplore: () => void;
  /** When provided, public.info_cards opens the side panel instead of running the option */
  onOpenInfoPanel?: () => void;
}

export function MobileBottomNav({
  defaultOptions,
  isPublicMode,
  featureFlags = [],
  representativeAvatarUrl,
  onOptionSelect,
  onExplore,
  onOpenInfoPanel,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [pressedActionId, setPressedActionId] = useState<string | null>(null);
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

  // Show all public options as icons in the bottom strip (no More) for a clean nav
  const publicTopCount = defaultOptions.length;
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

  const NavButton = ({
    actionId,
    onSelect,
    icon: Icon,
    label,
    ariaLabel,
    avatarUrl,
  }: {
    actionId: string;
    onSelect: () => void;
    icon: React.ComponentType<{ className?: string }>;
    label?: string;
    ariaLabel: string;
    avatarUrl?: string | null;
  }) => {
    const isPressed = pressedActionId === actionId;
    const handleClick = () => {
      if (isPressed) {
        setPressedActionId(null);
        onSelect();
      } else {
        setPressedActionId(actionId);
      }
    };
    return (
      <div className="relative flex flex-col items-center flex-1 min-w-0">
        <button
          onClick={handleClick}
          className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-0 flex-1 w-full text-muted-foreground hover:text-foreground transition ${isPressed ? "text-primary relative z-[60]" : ""}`}
          aria-label={ariaLabel}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
          ) : (
            <Icon className="h-5 w-5 shrink-0" />
          )}
          {label && !isPressed && (
            <span className="hidden md:inline text-[10px] truncate max-w-full">{label}</span>
          )}
        </button>
        {isPressed && (
          <>
            <div
              className="fixed inset-0 z-[45] bg-black/30"
              aria-hidden
              onClick={() => setPressedActionId(null)}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-1.5 rounded-lg bg-background border shadow-lg text-xs font-medium whitespace-nowrap z-[55]">
              {label ?? ariaLabel}
              <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">Tap again to run</span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden w-full max-w-[100vw] border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 pb-[env(safe-area-inset-bottom)]"
      aria-label="Bottom navigation"
    >
      <div className="flex items-stretch justify-around h-14 [&>*]:border-r [&>*]:border-border [&>*:last-child]:border-r-0">
        <NavButton
          actionId="explore"
          onSelect={onExplore}
          icon={Sparkles}
          label="Explore"
          ariaLabel="Explore"
        />

        {topActions.map(({ optionId, label, Icon }) => (
          <NavButton
            key={optionId}
            actionId={optionId}
            onSelect={() => {
              if (isPublicMode && optionId === "public.info_cards" && onOpenInfoPanel) {
                onOpenInfoPanel();
              } else {
                onOptionSelect(optionId);
              }
            }}
            icon={Icon}
            label={label}
            ariaLabel={label}
            avatarUrl={isPublicMode && optionId === "public.about" ? representativeAvatarUrl : undefined}
          />
        ))}

        {moreOptions.length > 0 && (
          <div ref={moreRef} className="relative flex-1 flex items-stretch min-w-0">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-0 flex-1 text-muted-foreground hover:text-foreground transition"
              aria-label="More options"
              aria-expanded={moreOpen}
            >
              <MoreVertical className="h-5 w-5 shrink-0" />
              <span className="hidden md:inline text-[10px]">More</span>
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
      </div>
    </nav>
  );
}
