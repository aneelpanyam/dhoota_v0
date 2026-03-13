import { createServiceSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  accessCode: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: "Invalid input" },
        { status: 400 }
      );
    }

    const { email, accessCode } = parsed.data;
    const db = createServiceSupabase();

    const { data: user, error: queryError } = await db
      .from("users")
      .select("id, tenant_id, display_name, tenants!users_tenant_id_fkey(name)")
      .eq("email", email)
      .eq("access_code", accessCode)
      .is("deleted_at", null)
      .single();

    if (queryError) {
      console.error("[validate-access] Supabase query error:", queryError);
    }

    if (!user) {
      console.error("[validate-access] No user found for email:", email, "accessCode:", accessCode);
      return NextResponse.json(
        { valid: false, error: "Invalid email or access code" },
        { status: 200 }
      );
    }

    const tenantData = user.tenants as { name: string } | { name: string }[] | null;
    const tenantName =
      (Array.isArray(tenantData) ? tenantData[0] : tenantData)?.name ?? "Unknown";

    return NextResponse.json({
      valid: true,
      tenantName,
      displayName: user.display_name,
    });
  } catch (err) {
    console.error("[validate-access] Unexpected error:", err);
    return NextResponse.json(
      { valid: false, error: "Invalid email or access code" },
      { status: 200 }
    );
  }
}
