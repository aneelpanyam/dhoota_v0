"use client";

import { useState } from "react";
import type { OptionReference } from "@/types/api";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import { getOptionIcon } from "@/lib/icons/option-icons";

function ActionButton({
  opt,
  onOptionSelect,
  isMobile,
  pressedActionId,
  onActionPress,
}: {
  opt: OptionReference;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  isMobile: boolean;
  pressedActionId: string | null;
  onActionPress: (id: string | null) => void;
}) {
  const Icon = getOptionIcon(opt.icon);
  const isPressed = isMobile && pressedActionId === opt.optionId;

  const handleClick = () => {
    if (isMobile) {
      if (isPressed) {
        onActionPress(null);
        onOptionSelect(opt.optionId, opt.params);
      } else {
        onActionPress(opt.optionId);
      }
    } else {
      onOptionSelect(opt.optionId, opt.params);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className={`p-1.5 rounded-lg transition ${isPressed ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-primary"}`}
        title={opt.name}
        aria-label={opt.name}
      >
        <Icon className="h-4 w-4" />
      </button>
      {isPressed && (
        <>
          <div
            className="fixed inset-0 z-30"
            aria-hidden
            onClick={() => onActionPress(null)}
          />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-3 py-1.5 rounded-lg bg-popover border shadow-lg text-xs font-medium whitespace-nowrap z-40">
            {opt.name}
            <span className="block text-[10px] text-muted-foreground font-normal mt-0.5">Tap again to run</span>
          </div>
        </>
      )}
    </div>
  );
}

export interface HeaderActionStripProps {
  headerActions?: OptionReference[];
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
}

export function HeaderActionStrip({
  headerActions,
  onOptionSelect,
}: HeaderActionStripProps) {
  const [pressedActionId, setPressedActionId] = useState<string | null>(null);
  const isMobile = useIsMobile();

  if (!headerActions || headerActions.length === 0) return null;

  return (
    <div className="flex items-center gap-1 shrink-0">
      {headerActions.map((opt) => (
        <ActionButton
          key={opt.optionId}
          opt={opt}
          onOptionSelect={onOptionSelect}
          isMobile={isMobile}
          pressedActionId={pressedActionId}
          onActionPress={setPressedActionId}
        />
      ))}
    </div>
  );
}
