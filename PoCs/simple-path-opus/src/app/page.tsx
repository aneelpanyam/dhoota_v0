import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/app/(auth)/actions";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-svh flex-col items-center justify-center p-6">
      <h1 className="font-heading text-3xl font-bold text-primary-600">
        Simple Path
      </h1>
      {user ? (
        <div className="mt-4 text-center">
          <p className="text-surface-600">
            Welcome, {user.display_name ?? user.email ?? "User"}
          </p>
          <p className="mt-1 text-xs text-surface-400">
            Role: {user.role}
          </p>
          <form action={signOut} className="mt-4">
            <button
              type="submit"
              className="rounded-lg border border-surface-300 px-4 py-2 text-sm text-surface-600 transition-colors hover:bg-surface-100"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <p className="mt-2 text-surface-500">
          Activity Tracker &mdash; Coming Soon
        </p>
      )}
    </main>
  );
}
