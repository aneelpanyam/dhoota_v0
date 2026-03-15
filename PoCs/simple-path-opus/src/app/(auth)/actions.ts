"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { withTraceId, getTraceId } from "@/lib/tracing";
import { validate } from "@/lib/validation";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  hashAccessCode,
  findUserByAccessCode,
  generateAndStoreOtp,
  validateStoredOtp,
  createAuthSession,
} from "@/lib/services/auth";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface AuthActionState {
  error?: string;
  fieldErrors?: Array<{ field: string; message: string }>;
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const accessCodeSchema = z.object({
  code: z
    .string()
    .min(4, "Access code must be at least 4 characters")
    .max(50, "Access code is too long"),
});

const otpSchema = z.object({
  token: z.string().regex(/^\d{6}$/, "Enter a 6-digit verification code"),
  email: z.string().email("Invalid email"),
});

// ---------------------------------------------------------------------------
// Login: Validate access code → send OTP → redirect to /verify
// ---------------------------------------------------------------------------

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return withTraceId(async () => {
    const traceId = getTraceId();

    const validation = validate(accessCodeSchema, {
      code: formData.get("code"),
    });

    if (!validation.success) {
      logger.warn("Access code input validation failed", {
        traceId,
        fieldErrors: validation.errors,
      });
      return { fieldErrors: validation.errors, traceId };
    }

    const hashedCode = hashAccessCode(validation.data.code);
    const { data: userInfo, error: findError } =
      await findUserByAccessCode(hashedCode);

    if (findError || !userInfo) {
      logger.warn("Access code lookup failed", { traceId, error: findError });
      return {
        error: "Invalid access code. Please try again.",
        traceId,
      };
    }

    logger.info("Access code validated", {
      traceId,
      userId: userInfo.userId,
    });

    const { error: otpError } = generateAndStoreOtp(
      userInfo.email,
      userInfo.userId,
    );

    if (otpError) {
      return { error: otpError, traceId };
    }

    logger.info("OTP sent", {
      traceId,
      userId: userInfo.userId,
      email: userInfo.email,
    });

    redirect(`/verify?email=${encodeURIComponent(userInfo.email)}`);
  });
}

// ---------------------------------------------------------------------------
// Verify OTP → create session → redirect to /
// ---------------------------------------------------------------------------

export async function verifyAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return withTraceId(async () => {
    const traceId = getTraceId();

    const validation = validate(otpSchema, {
      token: formData.get("token"),
      email: formData.get("email"),
    });

    if (!validation.success) {
      return { fieldErrors: validation.errors, traceId };
    }

    const { email, token } = validation.data;
    const { userId, error: otpError } = validateStoredOtp(email, token);

    if (otpError || !userId) {
      logger.warn("OTP verification failed", { traceId, email, error: otpError });
      return {
        error: otpError ?? "Verification failed",
        traceId,
      };
    }

    logger.info("OTP verified", { traceId, userId, email });

    const { error: sessionError } = await createAuthSession(email);

    if (sessionError) {
      logger.error("Session creation failed after OTP verify", {
        traceId,
        userId,
        email,
        error: sessionError,
      });
      return {
        error: "Failed to sign in. Please try again.",
        traceId,
      };
    }

    logger.info("Session created", { traceId, userId });
    redirect("/");
  });
}

// ---------------------------------------------------------------------------
// Resend OTP (called directly, not via useActionState)
// ---------------------------------------------------------------------------

export async function resendOtp(
  email: string,
): Promise<AuthActionState> {
  return withTraceId(async () => {
    const traceId = getTraceId();

    if (!email) {
      return { error: "Email is required", traceId };
    }

    const admin = createAdminClient();
    const { data: user, error: userError } = await admin
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userError || !user) {
      logger.warn("Resend OTP failed — user not found", { traceId, email });
      return { error: "Unable to resend code", traceId };
    }

    const { error: otpError } = generateAndStoreOtp(email, user.id);

    if (otpError) {
      return { error: otpError, traceId };
    }

    logger.info("OTP resent", { traceId, userId: user.id, email });
    return { traceId };
  });
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
