"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "../actions";

const initialState: AuthActionState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  const codeError = state.fieldErrors?.find((e) => e.field === "code");

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-primary-600">
            Simple Path
          </h1>
          <p className="mt-2 text-sm text-surface-500">
            Enter your access code to continue
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="code" className="sr-only">
              Access Code
            </label>
            <input
              id="code"
              name="code"
              type="password"
              autoComplete="off"
              required
              autoFocus
              placeholder="Enter access code"
              disabled={isPending}
              className="w-full rounded-lg border border-surface-300 bg-white px-4 py-3 text-surface-900 placeholder:text-surface-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:opacity-60"
            />
            {codeError && (
              <p className="mt-1.5 text-sm text-danger-500">
                {codeError.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-primary-600 px-4 py-3 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Verifying\u2026" : "Continue"}
          </button>
        </form>

        {state.error && (
          <div className="rounded-lg bg-danger-50 p-4 text-sm text-danger-700">
            <p>{state.error}</p>
            {state.traceId && (
              <p className="mt-1 text-xs text-danger-500">
                Reference: {state.traceId}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
