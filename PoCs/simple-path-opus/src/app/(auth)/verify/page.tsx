"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useSearchParams } from "next/navigation";
import { verifyAction, resendOtp, type AuthActionState } from "../actions";

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}${"*".repeat(Math.min(local.length - 2, 5))}@${domain}`;
}

const initialState: AuthActionState = {};

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [verifyState, verifyFormAction, isVerifying] = useActionState(
    verifyAction,
    initialState,
  );

  const [resendResult, setResendResult] = useState<AuthActionState>({});
  const [isResending, startResendTransition] = useTransition();

  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [cooldown, setCooldown] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (!email) {
      window.location.href = "/login";
    }
  }, [email]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (value.length > 1) value = value.slice(-1);
      if (value && !/^\d$/.test(value)) return;

      const newDigits = [...digits];
      newDigits[index] = value;
      setDigits(newDigits);

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      if (value && index === 5 && newDigits.every((d) => d)) {
        setTimeout(() => formRef.current?.requestSubmit(), 0);
      }
    },
    [digits],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;

    const newDigits = Array.from({ length: 6 }, (_, i) => pasted[i] ?? "");
    setDigits(newDigits);

    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();

    if (pasted.length === 6) {
      setTimeout(() => formRef.current?.requestSubmit(), 0);
    }
  }, []);

  const handleResend = () => {
    setCooldown(60);
    setResendResult({});
    startResendTransition(async () => {
      const result = await resendOtp(email);
      setResendResult(result);
    });
  };

  const token = digits.join("");
  const error = verifyState.error || resendResult.error;
  const traceId = verifyState.traceId || resendResult.traceId;
  const resendSuccess = resendResult.traceId && !resendResult.error;

  if (!email) return null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-heading text-2xl font-bold text-surface-900">
            Verification Code
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            Enter the 6-digit code sent to{" "}
            <span className="font-medium text-surface-700">
              {maskEmail(email)}
            </span>
          </p>
        </div>

        <form ref={formRef} action={verifyFormAction} className="space-y-6">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="token" value={token} />

          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={isVerifying}
                className="h-12 w-12 rounded-lg border border-surface-300 bg-white text-center text-lg font-semibold text-surface-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60"
                aria-label={`Digit ${i + 1}`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={isVerifying || token.length !== 6}
            className="w-full rounded-lg bg-primary-600 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isVerifying ? "Verifying\u2026" : "Verify"}
          </button>
        </form>

        {error && (
          <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700">
            <p>{error}</p>
            {traceId && (
              <p className="mt-1 text-xs text-danger-500">
                Reference: {traceId}
              </p>
            )}
          </div>
        )}

        {resendSuccess && (
          <p className="text-center text-sm text-success-700">
            A new code has been sent.
          </p>
        )}

        <div className="text-center space-y-3">
          <p className="text-sm text-surface-500">
            Didn&apos;t receive a code?{" "}
            {cooldown > 0 ? (
              <span className="text-surface-400">
                Resend in {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="font-medium text-primary-600 hover:text-primary-700 disabled:opacity-60"
              >
                {isResending ? "Sending\u2026" : "Resend code"}
              </button>
            )}
          </p>

          <a
            href="/login"
            className="inline-block text-sm text-surface-500 hover:text-surface-700"
          >
            &larr; Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
