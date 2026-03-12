export function isPublicMode(): boolean {
  return process.env.DHOOTA_PUBLIC_MODE === "true";
}

export function isSuggestionBoxMode(): boolean {
  return process.env.DHOOTA_SUGGESTION_BOX_MODE === "true";
}

export function getPublicUserId(): string | null {
  return process.env.DHOOTA_PUBLIC_USER_ID ?? null;
}

export function getPublicTenantId(): string | null {
  return process.env.DHOOTA_PUBLIC_TENANT_ID ?? null;
}
