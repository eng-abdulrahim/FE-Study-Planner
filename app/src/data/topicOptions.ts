// Single source of truth for topic STATUS and CONFIDENCE options, labels and
// migration. Every dropdown, badge, filter and label in the app derives from
// the arrays below so wording can never drift apart again.
//
//   Status     = workflow state (Not started .. Done / Skipped)
//   Confidence = user self-rating 1..5 (Very weak .. Strong)
//   Readiness  = a SEPARATE computed score (see lib/readiness.ts), never a status
import type { TopicConfidence, TopicStatus } from "../types/planner";

export const TOPIC_STATUS_OPTIONS = [
  { value: "not-started", label: "Not started" },
  { value: "studying", label: "Studying" },
  { value: "practicing", label: "Practicing" },
  { value: "reviewing", label: "Reviewing" },
  { value: "done", label: "Done" },
  { value: "skipped", label: "Skipped" },
] as const satisfies readonly { value: TopicStatus; label: string }[];

export const CONFIDENCE_OPTIONS = [
  { value: 1, label: "1 - Very weak", shortLabel: "Very weak" },
  { value: 2, label: "2 - Weak", shortLabel: "Weak" },
  { value: 3, label: "3 - Okay", shortLabel: "Okay" },
  { value: 4, label: "4 - Good", shortLabel: "Good" },
  { value: 5, label: "5 - Strong", shortLabel: "Strong" },
] as const satisfies readonly {
  value: TopicConfidence;
  label: string;
  shortLabel: string;
}[];

/** Canonical status values in display order. */
export const STATUS_VALUES: TopicStatus[] = TOPIC_STATUS_OPTIONS.map((o) => o.value);

/** Canonical confidence values (1..5). */
export const CONFIDENCE_VALUES: TopicConfidence[] = CONFIDENCE_OPTIONS.map((o) => o.value);

const STATUS_LABEL_MAP: Record<TopicStatus, string> = Object.fromEntries(
  TOPIC_STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TopicStatus, string>;

const CONFIDENCE_LABEL_MAP: Record<TopicConfidence, string> = Object.fromEntries(
  CONFIDENCE_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TopicConfidence, string>;

const CONFIDENCE_SHORT_MAP: Record<TopicConfidence, string> = Object.fromEntries(
  CONFIDENCE_OPTIONS.map((o) => [o.value, o.shortLabel]),
) as Record<TopicConfidence, string>;

export function getStatusLabel(status: TopicStatus): string {
  return STATUS_LABEL_MAP[status] ?? STATUS_LABEL_MAP["not-started"];
}

// Accept a plain number because TopicState.confidence is stored numerically;
// the value is normalized to 1..5 before lookup so the label is always valid.
export function getConfidenceLabel(confidence: number): string {
  return CONFIDENCE_LABEL_MAP[normalizeConfidence(confidence)];
}

export function getConfidenceShortLabel(confidence: number): string {
  return CONFIDENCE_SHORT_MAP[normalizeConfidence(confidence)];
}

export function isTopicStatus(value: unknown): value is TopicStatus {
  return typeof value === "string" && (STATUS_VALUES as string[]).includes(value);
}

/**
 * Status to use when a topic is reverted from Done back to "not done". A topic
 * with logged hours returns to "reviewing" (it has clearly been worked on);
 * one with no progress returns to "not-started". Either way it becomes eligible
 * for planning again.
 */
export function reopenStatus(completedHours: number): TopicStatus {
  return completedHours > 0 ? "reviewing" : "not-started";
}

/**
 * Map any legacy / external status value to a canonical one. Handles both the
 * old internal enum values that may already be saved to LocalStorage / the
 * cloud ("Learning", "Improving", "Strong", "Exam Ready", ...) and the older
 * display strings ("Almost there", "Ready", "Not started"). Unknown values
 * safely fall back to "not-started".
 */
export function normalizeTopicStatus(value: unknown): TopicStatus {
  const normalized = String(value ?? "").trim().toLowerCase();

  switch (normalized) {
    case "not started":
    case "not-started":
      return "not-started";

    case "learning": // legacy internal value
    case "studying":
      return "studying";

    case "practicing":
      return "practicing";

    case "improving": // legacy internal value
    case "almost there":
    case "almost-there":
    case "reviewing":
      return "reviewing";

    // Old "Strong" was a STATUS meaning "strong but not finished" -> reviewing.
    case "strong":
      return "reviewing";

    case "exam ready": // legacy internal value
    case "exam-ready":
    case "ready":
    case "done":
      return "done";

    case "skipped":
      return "skipped";

    default:
      return "not-started";
  }
}

/** Clamp any value to an integer confidence 1..5 (defaults to 3 when unknown). */
export function normalizeConfidence(value: unknown): TopicConfidence {
  const n = Number(value);
  if (!Number.isFinite(n)) return 3;
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  const rounded = Math.round(n);
  return (rounded === 2 || rounded === 4 ? rounded : 3) as TopicConfidence;
}
