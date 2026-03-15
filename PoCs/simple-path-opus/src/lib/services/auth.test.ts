import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  hashAccessCode,
  generateAndStoreOtp,
  validateStoredOtp,
  maskEmail,
} from "./auth";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("hashAccessCode", () => {
  it("produces a deterministic hex hash", () => {
    const hash1 = hashAccessCode("my-secret-code");
    const hash2 = hashAccessCode("my-secret-code");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different inputs", () => {
    const hash1 = hashAccessCode("code-a");
    const hash2 = hashAccessCode("code-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("OTP flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("generateAndStoreOtp creates a 6-digit code", () => {
    vi.useRealTimers();
    const result = generateAndStoreOtp("test@example.com", "user-123");
    expect(result.error).toBeNull();
    expect(result.code).toMatch(/^\d{6}$/);
  });

  it("validateStoredOtp succeeds with correct code", () => {
    vi.useRealTimers();
    const { code } = generateAndStoreOtp("verify@example.com", "user-456");
    const result = validateStoredOtp("verify@example.com", code);
    expect(result.error).toBeNull();
    expect(result.userId).toBe("user-456");
  });

  it("validateStoredOtp fails with wrong code", () => {
    vi.useRealTimers();
    generateAndStoreOtp("wrong@example.com", "user-789");
    const result = validateStoredOtp("wrong@example.com", "000000");
    expect(result.userId).toBeNull();
    expect(result.error).toBe("Invalid verification code");
  });

  it("validateStoredOtp fails when no OTP exists", () => {
    vi.useRealTimers();
    const result = validateStoredOtp("noexist@example.com", "123456");
    expect(result.userId).toBeNull();
    expect(result.error).toContain("No verification code found");
  });

  it("validateStoredOtp fails after expiry", () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const { code } = generateAndStoreOtp("expire@example.com", "user-exp");

    vi.setSystemTime(now + 6 * 60 * 1000);
    const result = validateStoredOtp("expire@example.com", code);

    expect(result.userId).toBeNull();
    expect(result.error).toContain("expired");

    vi.useRealTimers();
  });

  it("validateStoredOtp fails after max attempts", () => {
    vi.useRealTimers();
    const { code } = generateAndStoreOtp("attempts@example.com", "user-att");

    validateStoredOtp("attempts@example.com", "000001");
    validateStoredOtp("attempts@example.com", "000002");
    validateStoredOtp("attempts@example.com", "000003");

    const result = validateStoredOtp("attempts@example.com", code);
    expect(result.userId).toBeNull();
    expect(result.error).toContain("Too many attempts");
  });

  it("enforces resend cooldown", () => {
    vi.useRealTimers();
    generateAndStoreOtp("cooldown@example.com", "user-cd");
    const result2 = generateAndStoreOtp("cooldown@example.com", "user-cd");
    expect(result2.error).toContain("wait");
  });
});

describe("maskEmail", () => {
  it("masks email local part", () => {
    expect(maskEmail("johndoe@example.com")).toBe("jo*****@example.com");
  });

  it("handles short local parts", () => {
    expect(maskEmail("ab@example.com")).toBe("a***@example.com");
  });

  it("handles single-char local", () => {
    expect(maskEmail("a@example.com")).toBe("a***@example.com");
  });

  it("handles invalid email", () => {
    expect(maskEmail("noemail")).toBe("***");
  });
});
