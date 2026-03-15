/**
 * Seed script: provisions a test user with an access code.
 *
 * Usage:
 *   npx tsx scripts/seed-user.ts
 *
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, ACCESS_CODE_PEPPER
 *   - Migration 001_core_schema.sql applied to the Supabase instance
 *
 * What it does:
 *   1. Creates an auth user in Supabase Auth (email/password)
 *   2. Inserts a row in the public.users table
 *   3. Creates a space for the user
 *   4. Hashes the access code with SHA-256 + pepper and inserts into access_codes
 *
 * Edit the constants below to customise the seed user.
 */

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env.local from project root
config({ path: resolve(__dirname, "../.env.local") });

// ---- Configure your seed user here ----
const SEED_EMAIL = "test@simplepath.dev";
const SEED_PASSWORD = "test-password-not-used-for-login";
const SEED_DISPLAY_NAME = "Test User";
const SEED_ROLE: "user" | "admin" = "user";
const SEED_ACCESS_CODE = "test1234"; // plaintext — will be hashed before storing
// ----------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
const pepper = process.env.ACCESS_CODE_PEPPER ?? "";

if (!supabaseUrl || !secretKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function hashAccessCode(code: string): string {
  return createHash("sha256").update(`${pepper}:${code}`).digest("hex");
}

async function main() {
  console.log("--- Seed: provisioning test user ---\n");

  // 1. Create auth user
  console.log(`1. Creating auth user: ${SEED_EMAIL}`);
  const { data: authData, error: authError } =
    await admin.auth.admin.createUser({
      email: SEED_EMAIL,
      password: SEED_PASSWORD,
      email_confirm: true,
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log("   Auth user already exists — looking up...");
      const { data: listData } = await admin.auth.admin.listUsers();
      const existing = listData?.users?.find((u) => u.email === SEED_EMAIL);
      if (!existing) {
        console.error("   Could not find existing auth user");
        process.exit(1);
      }
      console.log(`   Found auth user: ${existing.id}`);
      await seedAppUser(existing.id);
      return;
    }
    console.error("   Failed to create auth user:", authError.message);
    process.exit(1);
  }

  console.log(`   Created auth user: ${authData.user.id}`);
  await seedAppUser(authData.user.id);
}

async function seedAppUser(userId: string) {
  // 2. Insert into public.users
  console.log(`\n2. Inserting into users table (role: ${SEED_ROLE})`);
  const { error: userError } = await admin.from("users").upsert(
    {
      id: userId,
      email: SEED_EMAIL,
      display_name: SEED_DISPLAY_NAME,
      role: SEED_ROLE,
      status: "active",
    },
    { onConflict: "id" },
  );

  if (userError) {
    console.error("   Failed to insert user:", userError.message);
    process.exit(1);
  }
  console.log("   Done.");

  // 3. Create a space
  console.log("\n3. Creating space for user");
  const { error: spaceError } = await admin.from("spaces").upsert(
    {
      user_id: userId,
      name: `${SEED_DISPLAY_NAME}'s Space`,
    },
    { onConflict: "user_id" },
  );

  if (spaceError) {
    console.error("   Failed to create space:", spaceError.message);
    // Non-fatal — continue
  } else {
    console.log("   Done.");
  }

  // 4. Hash and insert access code
  const hashed = hashAccessCode(SEED_ACCESS_CODE);
  console.log(`\n4. Inserting access code (plaintext: "${SEED_ACCESS_CODE}")`);
  console.log(`   SHA-256 hash: ${hashed.slice(0, 16)}...`);

  // Delete existing codes for this user first (upsert isn't practical on code column)
  await admin.from("access_codes").delete().eq("user_id", userId);

  const { error: codeError } = await admin.from("access_codes").insert({
    user_id: userId,
    code: hashed,
    is_active: true,
  });

  if (codeError) {
    console.error("   Failed to insert access code:", codeError.message);
    process.exit(1);
  }
  console.log("   Done.");

  // Summary
  console.log("\n--- Seed complete ---");
  console.log(`  Email:       ${SEED_EMAIL}`);
  console.log(`  Access code: ${SEED_ACCESS_CODE}`);
  console.log(`  Role:        ${SEED_ROLE}`);
  console.log(`  User ID:     ${userId}`);
  console.log(
    `\nYou can now log in at /login with access code "${SEED_ACCESS_CODE}".`,
  );
  console.log("The OTP will be printed in the server console (dev stub).");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
