/**
 * Prompt injection guard rails for LLM interactions.
 * Sanitizes user input and detects injection attempts.
 */

const INJECTION_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|above|prior)\s+instructions?\b/i,
  /\bdisregard\s+(all\s+)?(previous|above|prior)\s+instructions?\b/i,
  /\bforget\s+(all\s+)?(previous|above|prior)\s+instructions?\b/i,
  /\boverride\s+(system\s+)?(prompt|instructions?)\b/i,
  /\bsystem\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /\buser\s*:\s*(you\s+are|act\s+as)/i,
  /\b\[INST\]/i,
  /\b\[SYSTEM\]/i,
  /\b\[USER\]/i,
  /\b<\s*system\s*>/i,
  /\b<\s*\/\s*system\s*>/i,
  /\byou\s+are\s+now\s+(a|an)\s+/i,
  /\bpretend\s+(you\s+are|to\s+be)\b/i,
  /\bact\s+as\s+(if\s+you\s+are|a\s+different)\b/i,
  /\bnew\s+instructions?\s*:\s*/i,
  /\bprompt\s*:\s*["']/i,
];

/** Strip known injection patterns from user input. */
export function sanitizeUserInput(text: string): string {
  if (!text || typeof text !== "string") return "";
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[redacted]");
  }
  return sanitized.trim();
}

/** Return true if input appears to contain an injection attempt. */
export function detectInjectionAttempt(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

/** Strict mode: reject if injection detected. Returns { ok: true } or { ok: false, error } */
export function checkInput(
  text: string,
  options?: { strict?: boolean }
): { ok: true } | { ok: false; error: string } {
  if (detectInjectionAttempt(text)) {
    if (options?.strict ?? process.env.GUARDRAILS_STRICT === "true") {
      return { ok: false, error: "Input contains disallowed content. Please rephrase." };
    }
  }
  return { ok: true };
}
