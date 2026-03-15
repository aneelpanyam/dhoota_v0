/**
 * Curated theme presets for public site styling.
 * Presets ensure colors never clash with icons, chat messages, or other UI.
 */

export const HEADER_NAV_PRESETS = [
  { id: "default", label: "Default", backgroundColor: "", textColor: "" },
  { id: "light", label: "Light", backgroundColor: "#ffffff", textColor: "#1a1a1a" },
  { id: "light_gray", label: "Light gray", backgroundColor: "#f1f5f9", textColor: "#334155" },
  { id: "muted", label: "Muted", backgroundColor: "#e2e8f0", textColor: "#475569" },
  { id: "dark", label: "Dark", backgroundColor: "#1e293b", textColor: "#f8fafc" },
  { id: "saffron", label: "Saffron", backgroundColor: "#FF9933", textColor: "#1a1a1a" },
  { id: "navy", label: "Navy", backgroundColor: "#1e3a5f", textColor: "#f8fafc" },
  { id: "teal", label: "Teal", backgroundColor: "#0d9488", textColor: "#ffffff" },
] as const;

/** Card presets: bgClassName (background + border), fgClassName (text when fg not overridden). Option A: border uses preset main color. */
export const CARD_PRESETS = [
  { id: "default", label: "Default", bgClassName: "bg-card border", fgClassName: "" },
  { id: "minimal", label: "Minimal", bgClassName: "bg-transparent border", fgClassName: "" },
  { id: "subtle", label: "Subtle", bgClassName: "bg-muted/30 border", fgClassName: "" },
  { id: "saffron", label: "Saffron", bgClassName: "bg-[#FF9933] border border-[#FF9933]", fgClassName: "text-[#1a1a1a] [&_.text-foreground]:!text-[#1a1a1a] [&_.text-muted-foreground]:!text-[#334155]" },
  { id: "navy", label: "Navy", bgClassName: "bg-[#1e3a5f] border border-[#1e3a5f]", fgClassName: "text-[#f8fafc] [&_.text-foreground]:!text-[#f8fafc] [&_.text-muted-foreground]:!text-[#cbd5e1]" },
  { id: "teal", label: "Teal", bgClassName: "bg-[#0d9488] border border-[#0d9488]", fgClassName: "text-[#ffffff] [&_.text-foreground]:!text-[#ffffff] [&_.text-muted-foreground]:!text-[#ccfbf1]" },
] as const;

export type HeaderNavPresetId = (typeof HEADER_NAV_PRESETS)[number]["id"];
export type CardPresetId = (typeof CARD_PRESETS)[number]["id"];

export interface PresetStyles {
  backgroundColor?: string;
  color: string;
  borderColor?: string;
}

export interface CardPresetResult {
  className: string;
  style?: React.CSSProperties;
}

/**
 * Returns border style for widgets when a preset is set.
 * Accepts both card preset IDs and header/nav preset IDs.
 */
export function getWidgetBorderStyle(presetId: string | null | undefined): React.CSSProperties | undefined {
  if (!presetId || presetId === "default") return undefined;
  const cardPreset = CARD_PRESETS.find((p) => p.id === presetId);
  if (cardPreset) {
    const match = cardPreset.bgClassName.match(/border-\[#([0-9a-fA-F]+)\]/);
    if (match) return { borderColor: `#${match[1]}` };
  }
  const headerPreset = HEADER_NAV_PRESETS.find((p) => p.id === presetId);
  if (headerPreset?.backgroundColor) return { borderColor: headerPreset.backgroundColor };
  return undefined;
}

/**
 * Returns text color style and inherit class for widgets when fg preset is set.
 * Use widgetFgPreset for widget text; headerFgPreset is for header/nav bars only.
 */
export function getWidgetFgStyle(presetId: string | null | undefined): {
  style?: React.CSSProperties;
  inheritClass: string;
} {
  const color = presetId && presetId !== "default" ? getForegroundColor(presetId) : null;
  return {
    style: color ? { color } : undefined,
    inheritClass: color ? "[&_.text-foreground]:!text-inherit [&_.text-muted-foreground]:!text-inherit" : "",
  };
}

/**
 * Returns hex color when preset is used as foreground (text color).
 * For "default" returns null. For others, returns preset's main color (backgroundColor).
 */
export function getForegroundColor(presetId: string | null | undefined): string | null {
  if (!presetId || presetId === "default") return null;
  const preset = HEADER_NAV_PRESETS.find((p) => p.id === presetId);
  return preset?.backgroundColor ?? null;
}

/**
 * Returns inline styles for header/nav bars.
 * When fgPresetId is set and not default, use it for text color and border color; else use bg preset's recommended textColor and backgroundColor for border.
 * When bg is default but fg is set, returns fg-only styles (no background override).
 */
export function getPresetStyles(
  bgPresetId: string | null | undefined,
  fgPresetId?: string | null
): PresetStyles | null {
  const fgColor = fgPresetId && fgPresetId !== "default" ? getForegroundColor(fgPresetId) : null;
  if (!bgPresetId || bgPresetId === "default") {
    if (fgColor) return { color: fgColor, borderColor: fgColor };
    return null;
  }
  const preset = HEADER_NAV_PRESETS.find((p) => p.id === bgPresetId);
  if (!preset || !preset.backgroundColor) {
    if (fgColor) return { color: fgColor, borderColor: fgColor };
    return null;
  }
  return {
    backgroundColor: preset.backgroundColor,
    color: fgColor ?? preset.textColor,
    borderColor: fgColor ?? preset.backgroundColor,
  };
}

/**
 * Returns Tailwind classes for card styling (about me, info cards, welcome messages).
 * When preset is "default" or unknown, returns default card classes.
 * @deprecated Use getCardPresetClasses for fg override support.
 */
export function getCardPresetClass(presetId: string | null | undefined): string {
  const result = getCardPresetClasses(presetId, undefined);
  return result.className;
}

/**
 * Returns className and optional style for card preset with optional fg override.
 * When fgPresetId is set and not default, applies that color via inline style.
 * When bg is default but fg is set, still applies fg color.
 */
export function getCardPresetClasses(
  bgPresetId: string | null | undefined,
  fgPresetId?: string | null
): CardPresetResult {
  const fgColor = fgPresetId && fgPresetId !== "default" ? getForegroundColor(fgPresetId) : null;
  if (!bgPresetId || bgPresetId === "default") {
    const className =
      "bg-card border" +
      (fgColor ? " [&_.text-foreground]:!text-inherit [&_.text-muted-foreground]:!text-inherit" : "");
    return { className, style: fgColor ? ({ color: fgColor } as React.CSSProperties) : undefined };
  }
  const preset = CARD_PRESETS.find((p) => p.id === bgPresetId);
  if (!preset) return { className: "bg-card border" };

  const className =
    preset.bgClassName +
    (fgColor
      ? " [&_.text-foreground]:!text-inherit [&_.text-muted-foreground]:!text-inherit"
      : preset.fgClassName
        ? ` ${preset.fgClassName}`
        : "");
  const style = fgColor ? ({ color: fgColor } as React.CSSProperties) : undefined;

  return { className, style };
}
