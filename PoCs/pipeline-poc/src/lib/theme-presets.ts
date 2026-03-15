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

/** Card presets: bgClassName (background + border), fgClassName (text when fg not overridden) */
export const CARD_PRESETS = [
  { id: "default", label: "Default", bgClassName: "bg-card border", fgClassName: "" },
  { id: "minimal", label: "Minimal", bgClassName: "bg-transparent border", fgClassName: "" },
  { id: "subtle", label: "Subtle", bgClassName: "bg-muted/30 border", fgClassName: "" },
  { id: "saffron", label: "Saffron", bgClassName: "bg-[#FF9933] border border-[#e68a2e]", fgClassName: "text-[#1a1a1a] [&_.text-foreground]:!text-[#1a1a1a] [&_.text-muted-foreground]:!text-[#334155]" },
  { id: "navy", label: "Navy", bgClassName: "bg-[#1e3a5f] border border-[#2d4a6f]", fgClassName: "text-[#f8fafc] [&_.text-foreground]:!text-[#f8fafc] [&_.text-muted-foreground]:!text-[#cbd5e1]" },
  { id: "teal", label: "Teal", bgClassName: "bg-[#0d9488] border border-[#0f766e]", fgClassName: "text-[#ffffff] [&_.text-foreground]:!text-[#ffffff] [&_.text-muted-foreground]:!text-[#ccfbf1]" },
] as const;

export type HeaderNavPresetId = (typeof HEADER_NAV_PRESETS)[number]["id"];
export type CardPresetId = (typeof CARD_PRESETS)[number]["id"];

export interface PresetStyles {
  backgroundColor?: string;
  color: string;
}

export interface CardPresetResult {
  className: string;
  style?: React.CSSProperties;
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
 * When fgPresetId is set and not default, use it for text color; else use bg preset's recommended textColor.
 * When bg is default but fg is set, returns fg-only styles (no background override).
 */
export function getPresetStyles(
  bgPresetId: string | null | undefined,
  fgPresetId?: string | null
): PresetStyles | null {
  const fgColor = fgPresetId && fgPresetId !== "default" ? getForegroundColor(fgPresetId) : null;
  if (!bgPresetId || bgPresetId === "default") {
    if (fgColor) return { color: fgColor };
    return null;
  }
  const preset = HEADER_NAV_PRESETS.find((p) => p.id === bgPresetId);
  if (!preset || !preset.backgroundColor) {
    if (fgColor) return { color: fgColor };
    return null;
  }
  return {
    backgroundColor: preset.backgroundColor,
    color: fgColor ?? preset.textColor,
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
