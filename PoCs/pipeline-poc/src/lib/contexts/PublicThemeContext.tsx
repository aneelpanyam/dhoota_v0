"use client";

import { createContext, useContext } from "react";

export interface ThemeOverrides {
  headerPreset?: string;
  bottomNavPreset?: string;
  aboutMePreset?: string;
  infoCardPreset?: string;
  welcomeMessagePreset?: string;
  headerFgPreset?: string;
  widgetFgPreset?: string;
  bottomNavFgPreset?: string;
  aboutMeFgPreset?: string;
  infoCardFgPreset?: string;
  welcomeMessageFgPreset?: string;
  chatMessageFgPreset?: string;
}

const PublicThemeContext = createContext<ThemeOverrides | null>(null);

export function PublicThemeProvider({
  themeOverrides,
  children,
}: {
  themeOverrides: ThemeOverrides | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <PublicThemeContext.Provider value={themeOverrides ?? null}>
      {children}
    </PublicThemeContext.Provider>
  );
}

export function usePublicTheme(): ThemeOverrides | null {
  return useContext(PublicThemeContext);
}
