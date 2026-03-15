export function isPublicMode(): boolean {
  const v = process.env.NEXT_PUBLIC_DHOOTA_PUBLIC_MODE ?? process.env.DHOOTA_PUBLIC_MODE;
  return v === "true" || v === "1";
}

export function isSuggestionBoxMode(): boolean {
  const v = process.env.NEXT_PUBLIC_DHOOTA_SUGGESTION_BOX_MODE ?? process.env.DHOOTA_SUGGESTION_BOX_MODE;
  return v === "true" || v === "1";
}

export function getPublicUserId(): string | null {
  return process.env.NEXT_PUBLIC_DHOOTA_PUBLIC_USER_ID ?? process.env.DHOOTA_PUBLIC_USER_ID ?? null;
}

export function getPublicTenantId(): string | null {
  return process.env.NEXT_PUBLIC_DHOOTA_PUBLIC_TENANT_ID ?? process.env.DHOOTA_PUBLIC_TENANT_ID ?? null;
}

/** Enable the pipeline debug panel (authenticated and public views). Default: false. */
export function isDebugPanelEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_DHOOTA_DEBUG_PANEL ?? process.env.DHOOTA_DEBUG_PANEL;
  return v === "true" || v === "1";
}
