import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { isPublicMode, isSuggestionBoxMode, getPublicUserId, getPublicTenantId } from "@/lib/auth/public-mode";
import type { SessionUser } from "@/types/auth";

export async function getSession(): Promise<SessionUser | null> {
  if (isPublicMode() || isSuggestionBoxMode()) {
    return getPublicSession();
  }

  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceSupabase();
  const { data: appUser } = await service
    .from("users")
    .select("id, tenant_id, user_type, email, display_name")
    .eq("auth_user_id", user.id)
    .single();

  if (!appUser) return null;

  return {
    id: appUser.id,
    tenantId: appUser.tenant_id,
    userType: appUser.user_type,
    email: appUser.email ?? user.email ?? "",
    displayName: appUser.display_name,
  };
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

function getPublicSession(): SessionUser | null {
  const tenantId = getPublicTenantId();
  const userId = getPublicUserId();

  if (!tenantId) return null;

  return {
    id: userId ?? "citizen-anonymous",
    tenantId,
    userType: "citizen",
    email: "",
    displayName: "Citizen",
  };
}
