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
        const [configResult, cardsResult] = await Promise.all([
          db
            .from("public_site_configs")
            .select("welcome_message, side_panel_content, theme_overrides, enabled_option_ids, site_title")
            .eq("tenant_id", tenantId)
            .eq("user_id", userId)
            .single(),
          db
            .from("info_cards")
            .select("id, title, content, card_type, icon, display_order")
            .eq("tenant_id", tenantId)
            .eq("created_by", userId)
            .eq("visibility", "public")
            .is("deleted_at", null)
            .order("display_order", { ascending: true }),
        ]);

        const data = configResult.data;
        const infoCards = cardsResult.data ?? [];

        if (data) {
          publicSiteConfig = {
            welcomeMessage: data.welcome_message,
            sidePanelContent: data.side_panel_content,
            themeOverrides: data.theme_overrides,
            enabledOptionIds: data.enabled_option_ids,
            siteTitle: data.site_title ?? null,
            infoCards,
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
