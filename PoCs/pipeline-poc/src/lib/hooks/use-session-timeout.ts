"use client";

import { useEffect, useRef, useCallback } from "react";

const STORAGE_KEY = "session_last_activity";
const DEFAULT_TIMEOUT_MINUTES = 30;
const CHECK_INTERVAL_MS = 60_000; // Check every minute

function getTimeoutMs(): number {
  const env = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES : undefined;
  const minutes = env ? parseInt(env, 10) : DEFAULT_TIMEOUT_MINUTES;
  return (Number.isNaN(minutes) ? DEFAULT_TIMEOUT_MINUTES : Math.max(1, minutes)) * 60 * 1000;
}

function getLastActivity(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : Date.now();
  } catch {
    return Date.now();
  }
}

function setLastActivity(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export interface UseSessionTimeoutOptions {
  onTimeout: () => void;
  enabled?: boolean;
}

/**
 * Hook to track user activity and handle session timeout.
 * Call recordActivity() on user interactions (message send, option click, etc.).
 * On timeout, calls onTimeout (e.g. to sign out and redirect).
 * Set enabled: false to disable (e.g. in public/citizen mode).
 */
export function useSessionTimeout({ onTimeout, enabled = true }: UseSessionTimeoutOptions): {
  recordActivity: () => void;
} {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const recordActivity = useCallback(() => {
    if (enabled) setLastActivity();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    setLastActivity(); // Reset on enable — treat fresh session as new activity
    const timeoutMs = getTimeoutMs();
    let intervalId: ReturnType<typeof setInterval>;

    const check = () => {
      const last = getLastActivity();
      const elapsed = Date.now() - last;
      if (elapsed >= timeoutMs) {
        clearInterval(intervalId);
        onTimeoutRef.current();
      }
    };

    intervalId = setInterval(check, CHECK_INTERVAL_MS);
    check(); // Run immediately in case already expired

    return () => clearInterval(intervalId);
  }, [enabled]);

  return { recordActivity };
}
