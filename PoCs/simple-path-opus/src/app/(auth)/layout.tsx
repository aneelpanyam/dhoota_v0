import { Suspense } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-svh items-center justify-center">
          <p className="text-surface-400">Loading&hellip;</p>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
