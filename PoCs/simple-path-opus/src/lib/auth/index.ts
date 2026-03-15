import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserById } from "@/lib/supabase/helpers";
import { logger } from "@/lib/logger";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Get the currently authenticated user from Supabase session + users table.
 * Returns null if not authenticated or user record not found.
 */
export async function getCurrentUser(): Promise<Tables<"users"> | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const { data: user, error } = await getUserById(supabase, authUser.id);

  if (error || !user) {
    logger.warn("Auth user exists but app user not found", {
      authUserId: authUser.id,
    });
    return null;
  }

  return user;
}

/**
 * Require an authenticated user. Redirects to /login if not authenticated.
 * Use in server components and server actions for protected routes.
 */
export async function requireAuth(): Promise<Tables<"users">> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require an admin user. Redirects to /login if not authenticated or not admin.
 * Use in server components and server actions for admin-only routes.
 */
export async function requireAdmin(): Promise<Tables<"users">> {
  const user = await requireAuth();

  if (user.role !== "admin") {
    logger.warn("Non-admin attempted admin access", {
      userId: user.id,
      role: user.role,
    });
    redirect("/login");
  }

  return user;
}
