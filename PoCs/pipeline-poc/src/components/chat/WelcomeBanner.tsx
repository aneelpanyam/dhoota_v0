"use client";

interface WelcomeBannerProps {
  message: string;
  displayName?: string;
}

export function WelcomeBanner({ message, displayName }: WelcomeBannerProps) {
  return (
    <div className="rounded-xl bg-gradient-to-r from-primary/15 via-primary/10 to-accent/10 border border-primary/20 p-4 shadow-sm">
      {displayName && (
        <h2 className="text-base font-semibold text-foreground mb-1.5">
          {displayName}
        </h2>
      )}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {message}
      </p>
    </div>
  );
}
