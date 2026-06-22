import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "rest";

export function Badge({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  children: ReactNode;
}) {
  const toneClass = tone === "neutral" ? "" : tone;
  return (
    <span className={`badge ${toneClass}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}
