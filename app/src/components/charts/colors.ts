import type { BadgeTone } from "../common/Badge";

// Maps a semantic tone to a theme CSS variable so charts follow light/dark mode.
export function toneVar(tone: BadgeTone): string {
  switch (tone) {
    case "primary":
      return "var(--color-primary)";
    case "success":
      return "var(--color-success)";
    case "warning":
      return "var(--color-warning)";
    case "danger":
      return "var(--color-danger)";
    case "rest":
      return "var(--color-rest)";
    case "neutral":
    default:
      return "var(--color-text-muted)";
  }
}
