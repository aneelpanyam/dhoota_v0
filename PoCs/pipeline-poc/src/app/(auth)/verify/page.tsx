"use client";

import { useState, Suspense } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const accessCode = searchParams.get("code") ?? "";
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createBrowserSupabase();

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (otpError) {
      setError(otpError.message);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/link-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, accessCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to link account");
        setLoading(false);
        return;
      }
    } catch {
      setError("Failed to link account. Please try again.");
      setLoading(false);
      return;
    }

    router.push("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 shrink-0 rounded overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon.png"
                  alt=""
                  className="w-20 h-20 object-cover"
                />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Dhoota</h1>
            <p className="text-muted-foreground mt-2">
              Enter the code sent to <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Verification Code
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition"
            >
              {loading ? "Verifying..." : "Verify & Sign In"}
            </button>
          </form>

          <button
            onClick={() => router.push("/login")}
            className="w-full mt-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
