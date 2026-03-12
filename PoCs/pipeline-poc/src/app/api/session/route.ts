import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isPublicMode, isSuggestionBoxMode, getPublicTenantId, getPublicUserId } from "@/lib/auth/public-mode";
import { createServiceSupabase } from "@/lib/supabase/server";

async function loadEnabledFlags(tenantId: string): Promise<string[]> {
  const db = createServiceSupabase();
  const { data } = await db
    .from("tenant_feature_flags")
    .select("flag_key")
    .eq("tenant_id", tenantId)
    .eq("enabled", true);
  return data?.map((f: { flag_key: string }) => f.flag_key) ?? [];
}

export async function GET() {
  try {
    const session = await getSession();
    const publicMode = isPublicMode();
    const suggestionBoxMode = isSuggestionBoxMode();

    let conversationContext: "tracker" | "admin" | "public" | "suggestion_box" = "tracker";
    if (publicMode) conversationContext = "public";
    if (suggestionBoxMode) conversationContext = "suggestion_box";
    if (session?.userType === "system_admin") conversationContext = "admin";

    let publicSiteConfig = null;
    if (publicMode || suggestionBoxMode) {
      const tenantId = getPublicTenantId();
      const userId = getPublicUserId();
      if (tenantId && userId) {
        const db = createServiceSupabase();
        const { data } = await db
          .from("public_site_configs")
          .select("welcome_message, side_panel_content, theme_overrides, enabled_option_ids")
          .eq("tenant_id", tenantId)
          .eq("user_id", userId)
          .single();

        if (data) {
          publicSiteConfig = {
            welcomeMessage: data.welcome_message,
            sidePanelContent: data.side_panel_content,
            themeOverrides: data.theme_overrides,
            enabledOptionIds: data.enabled_option_ids,
          };
        }
      }
    }

    const featureFlags = session?.tenantId
      ? await loadEnabledFlags(session.tenantId)
      : [];

    return NextResponse.json({
      user: session,
      publicMode,
      suggestionBoxMode,
      publicSiteConfig,
      conversationContext,
      featureFlags,
    });
  } catch {
    return NextResponse.json(
      { user: null, publicMode: false, suggestionBoxMode: false, publicSiteConfig: null, conversationContext: "tracker", featureFlags: [] },
      { status: 200 }
    );
  }
}
