"use client";

import type { Widget, WidgetAction } from "@/types/api";

interface Props {
  widget: Widget;
  onAction: (action: WidgetAction) => void;
  onOptionSelect: (optionId: string, params?: Record<string, unknown>) => void;
  onConfirm: (optionId: string, params: Record<string, unknown>) => void;
  onQAResponse: (optionId: string, params: Record<string, unknown>, content?: string) => void;
  onCancel: () => void;
}

/** Options are now shown in the Explore strip (OptionsStrip) above the input. */
export function DefaultOptionsMenuWidget(_props: Props) {
  return null;
}
