"use client";

import { useState, useMemo } from "react";
import { HEADER_NAV_PRESETS, CARD_PRESETS } from "@/lib/theme-presets";

const HEADER_NAV_OPTIONS = HEADER_NAV_PRESETS.map((p) => ({ value: p.id, label: p.label }));
const CARD_BG_OPTIONS = CARD_PRESETS.map((p) => ({ value: p.id, label: p.label }));
const CARD_FG_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "saffron", label: "Saffron" },
  { value: "navy", label: "Navy" },
  { value: "teal", label: "Teal" },
];

export interface ThemeSettings {
  theme_header_preset?: string;
  theme_header_fg_preset?: string;
  theme_bottom_nav_preset?: string;
  theme_bottom_nav_fg_preset?: string;
  theme_about_me_preset?: string;
  theme_about_me_fg_preset?: string;
  theme_info_card_preset?: string;
  theme_info_card_fg_preset?: string;
  theme_welcome_message_preset?: string;
  theme_welcome_message_fg_preset?: string;
  theme_chat_message_fg_preset?: string;
}

function getInitialTheme(sessionParams: Record<string, unknown> | undefined): ThemeSettings {
  const fromCompound = sessionParams?.theme_settings as ThemeSettings | undefined;
  if (fromCompound && typeof fromCompound === "object") {
    return { ...fromCompound };
  }
  return {
    theme_header_preset: String(sessionParams?.theme_header_preset ?? "default"),
    theme_header_fg_preset: String(sessionParams?.theme_header_fg_preset ?? "default"),
    theme_bottom_nav_preset: String(sessionParams?.theme_bottom_nav_preset ?? "default"),
    theme_bottom_nav_fg_preset: String(sessionParams?.theme_bottom_nav_fg_preset ?? "default"),
    theme_about_me_preset: String(sessionParams?.theme_about_me_preset ?? "default"),
    theme_about_me_fg_preset: String(sessionParams?.theme_about_me_fg_preset ?? "default"),
    theme_info_card_preset: String(sessionParams?.theme_info_card_preset ?? "default"),
    theme_info_card_fg_preset: String(sessionParams?.theme_info_card_fg_preset ?? "default"),
    theme_welcome_message_preset: String(sessionParams?.theme_welcome_message_preset ?? "default"),
    theme_welcome_message_fg_preset: String(sessionParams?.theme_welcome_message_fg_preset ?? "default"),
    theme_chat_message_fg_preset: String(sessionParams?.theme_chat_message_fg_preset ?? "default"),
  };
}

interface ThemeEditorWidgetProps {
  sessionParams: Record<string, unknown>;
  onSubmit: (theme: ThemeSettings) => void;
  onCancel: () => void;
}

export function ThemeEditorWidget({ sessionParams, onSubmit, onCancel }: ThemeEditorWidgetProps) {
  const initial = useMemo(() => getInitialTheme(sessionParams), [sessionParams]);
  const [theme, setTheme] = useState<ThemeSettings>(initial);

  const update = (key: keyof ThemeSettings, value: string) => {
    setTheme((prev) => ({ ...prev, [key]: value || "default" }));
  };

  const handleSubmit = () => {
    onSubmit(theme);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Customize colors for your public site. All settings are optional.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Header */}
        <section className="space-y-2 rounded-lg border p-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Header bar
          </h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Background</label>
              <select
                value={theme.theme_header_preset ?? "default"}
                onChange={(e) => update("theme_header_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {HEADER_NAV_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Text color</label>
              <select
                value={theme.theme_header_fg_preset ?? "default"}
                onChange={(e) => update("theme_header_fg_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {HEADER_NAV_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Bottom nav */}
        <section className="space-y-2 rounded-lg border p-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bottom nav bar
          </h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Background</label>
              <select
                value={theme.theme_bottom_nav_preset ?? "default"}
                onChange={(e) => update("theme_bottom_nav_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {HEADER_NAV_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Text / icons</label>
              <select
                value={theme.theme_bottom_nav_fg_preset ?? "default"}
                onChange={(e) => update("theme_bottom_nav_fg_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {HEADER_NAV_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* About me card */}
        <section className="space-y-2 rounded-lg border p-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            About me card
          </h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Style</label>
              <select
                value={theme.theme_about_me_preset ?? "default"}
                onChange={(e) => update("theme_about_me_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {CARD_BG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Text color</label>
              <select
                value={theme.theme_about_me_fg_preset ?? "default"}
                onChange={(e) => update("theme_about_me_fg_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {CARD_FG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Info cards */}
        <section className="space-y-2 rounded-lg border p-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Info cards
          </h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Style</label>
              <select
                value={theme.theme_info_card_preset ?? "default"}
                onChange={(e) => update("theme_info_card_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {CARD_BG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Text color</label>
              <select
                value={theme.theme_info_card_fg_preset ?? "default"}
                onChange={(e) => update("theme_info_card_fg_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {CARD_FG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Welcome message card */}
        <section className="space-y-2 rounded-lg border p-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Welcome message card
          </h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Style</label>
              <select
                value={theme.theme_welcome_message_preset ?? "default"}
                onChange={(e) => update("theme_welcome_message_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {CARD_BG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Text color</label>
              <select
                value={theme.theme_welcome_message_fg_preset ?? "default"}
                onChange={(e) => update("theme_welcome_message_fg_preset", e.target.value)}
                className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              >
                {CARD_FG_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Chat message text */}
        <section className="space-y-2 rounded-lg border p-3">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Chat message text
          </h4>
          <div>
            <label className="text-xs text-muted-foreground">Color</label>
            <select
              value={theme.theme_chat_message_fg_preset ?? "default"}
              onChange={(e) => update("theme_chat_message_fg_preset", e.target.value)}
              className="mt-0.5 w-full px-2 py-1.5 rounded border bg-muted/50 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
            >
              {CARD_FG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive transition"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
