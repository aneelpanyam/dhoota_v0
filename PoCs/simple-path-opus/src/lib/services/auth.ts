import { createHash, randomInt } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Access Code Hashing
// ---------------------------------------------------------------------------

const PEPPER = process.env.ACCESS_CODE_PEPPER ?? "";

export function hashAccessCode(code: string): string {
  return createHash("sha256")
    .update(`${PEPPER}:${code}`)
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Access Code Validation
// ---------------------------------------------------------------------------

export interface AccessCodeUser {
  userId: string;
  email: string;
}

export async function findUserByAccessCode(
  hashedCode: string,
): Promise<{ data: AccessCodeUser | null; error: string | null }> {
  const admin = createAdminClient();

  const { data: accessCode, error: acError } = await admin
    .from("access_codes")
    .select("user_id")
    .eq("code", hashedCode)
    .eq("is_active", true)
    .single();

  if (acError || !accessCode) {
    return { data: null, error: "Invalid access code" };
  }

  await admin
    .from("access_codes")
    .update({ last_used_at: new Date().toISOString() })
    .eq("code", hashedCode);

  const { data: user, error: userError } = await admin
    .from("users")
    .select("id, email, status")
    .eq("id", accessCode.user_id)
    .single();

  if (userError || !user) {
    return { data: null, error: "User not found" };
  }

  if (user.status !== "active") {
    return { data: null, error: "Account is suspended" };
  }

  if (!user.email) {
    return { data: null, error: "No email configured for this account" };
  }

  return {
    data: { userId: user.id, email: user.email },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// OTP Management (stub — in-memory store, logged to console for dev)
// ---------------------------------------------------------------------------

interface OtpEntry {
  code: string;
  userId: string;
  email: string;
  expiresAt: number;
  attempts: number;
  createdAt: number;
}

const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_MS = 60 * 1000;

// Attach to globalThis so the store survives module re-evaluation in Next.js dev mode
const globalForOtp = globalThis as unknown as { __otpStore?: Map<string, OtpEntry> };
if (!globalForOtp.__otpStore) {
  globalForOtp.__otpStore = new Map<string, OtpEntry>();
}
const otpStore = globalForOtp.__otpStore;

function generateOtpCode(): string {
  return String(randomInt(100000, 1000000));
}

export function generateAndStoreOtp(
  email: string,
  userId: string,
): { code: string; error: string | null } {
  const existing = otpStore.get(email);
  if (existing && Date.now() - existing.createdAt < RESEND_COOLDOWN_MS) {
    return { code: "", error: "Please wait before requesting a new code" };
  }

  const code = generateOtpCode();
  otpStore.set(email, {
    code,
    userId,
    email,
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    createdAt: Date.now(),
  });

  logger.info("OTP generated (dev stub — replace with real delivery in production)", {
    email,
    userId,
    otp: code,
    expiresInSeconds: OTP_EXPIRY_MS / 1000,
  });

  return { code, error: null };
}

export function validateStoredOtp(
  email: string,
  code: string,
): { userId: string | null; error: string | null } {
  const entry = otpStore.get(email);

  if (!entry) {
    return { userId: null, error: "No verification code found. Please request a new one." };
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email);
    return { userId: null, error: "Verification code has expired. Please request a new one." };
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(email);
    return { userId: null, error: "Too many attempts. Please request a new code." };
  }

  entry.attempts += 1;

  if (entry.code !== code) {
    return { userId: null, error: "Invalid verification code" };
  }

  otpStore.delete(email);
  return { userId: entry.userId, error: null };
}

// ---------------------------------------------------------------------------
// Session Creation (via Supabase Admin generateLink + server verifyOtp)
// ---------------------------------------------------------------------------

export async function createAuthSession(
  email: string,
): Promise<{ error: string | null }> {
  const admin = createAdminClient();
  const serverClient = await createServerClient();

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });

  if (linkError || !linkData) {
    logger.error("Failed to generate auth link", {
      email,
      error: linkError?.message,
    });
    return { error: "Failed to create session" };
  }

  const hashedToken = linkData.properties?.hashed_token;
  if (!hashedToken) {
    logger.error("No hashed_token in generateLink response", { email });
    return { error: "Failed to create session" };
  }

  const { error: verifyError } = await serverClient.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });

  if (verifyError) {
    logger.error("Failed to verify auth token", {
      email,
      error: verifyError.message,
    });
    return { error: "Failed to create session" };
  }

  return { error: null };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}${"*".repeat(Math.min(local.length - 2, 5))}@${domain}`;
}
