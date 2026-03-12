import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isPublicMode, isSuggestionBoxMode } from "@/lib/auth/public-mode";

const PUBLIC_ALLOWED_ROUTES = [
  "/api/chat/init",
  "/api/chat/message",
  "/api/session",
];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (isPublicMode() || isSuggestionBoxMode()) {
    const isAllowedRoute =
      path === "/" ||
      PUBLIC_ALLOWED_ROUTES.some((r) => path.startsWith(r));

    if (!isAllowedRoute) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.next({ request: { headers: request.headers } });
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = path.startsWith("/login") || path.startsWith("/verify");
  const isPreAuthApi = path.startsWith("/api/auth/validate-access");

  if (!user && !isAuthRoute && !isPreAuthApi) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute) {
    const appUrl = new URL("/", request.url);
    return NextResponse.redirect(appUrl);
  }

  return response;
}
