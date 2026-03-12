import { createServerSupabase, createServiceSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  accessCode: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { email, accessCode } = parsed.data;

    if (authUser.email !== email) {
      return NextResponse.json(
        { error: "Email mismatch" },
        { status: 403 }
      );
    }

    const db = createServiceSupabase();

    const { data: appUser } = await db
      .from("users")
      .select("id, auth_user_id")
      .eq("email", email)
      .eq("access_code", accessCode)
      .is("deleted_at", null)
      .single();

    if (!appUser) {
      return NextResponse.json(
        { error: "Invalid email or access code" },
        { status: 400 }
      );
    }

    if (appUser.auth_user_id && appUser.auth_user_id !== authUser.id) {
      return NextResponse.json(
        { error: "Account already linked to a different auth user" },
        { status: 409 }
      );
    }

    if (!appUser.auth_user_id) {
      await db
        .from("users")
        .update({ auth_user_id: authUser.id })
        .eq("id", appUser.id);
    }

    return NextResponse.json({ linked: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
