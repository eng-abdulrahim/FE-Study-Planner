// Input validation helpers (soft validation - prevent obviously bad data).
import type { IncludeValue, PlannerState } from "../types/planner";
import { INCLUDE_VALUES } from "../data/defaults";

/** Empty is allowed; otherwise must be a well-formed http(s) URL. */
export function isValidNoteUrl(value: string): boolean {
  const v = value.trim();
  if (v === "") return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Coerce an untrusted note URL (from import/hydrate/cloud) into a safe value.
 * Only http(s) links survive; everything else (javascript:, data:, other
 * schemes, malformed values, non-strings) is stripped to "" to prevent a
 * crafted backup from injecting an executable link rendered as <a href>.
 */
export function sanitizeNoteUrl(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.trim();
  return isValidNoteUrl(v) ? v : "";
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function isIncludeValue(v: unknown): v is IncludeValue {
  return typeof v === "string" && (INCLUDE_VALUES as string[]).includes(v);
}

export interface ImportResult {
  ok: boolean;
  errors: string[];
  state?: PlannerState;
}

/** Structural validation of an imported backup object. */
export function validateImportedState(raw: unknown): ImportResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["Backup is not a valid JSON object."] };
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.examDate !== "string" || !isValidISODate(obj.examDate)) {
    errors.push("Missing or invalid examDate (expected yyyy-mm-dd).");
  }
  if (typeof obj.topics !== "object" || obj.topics === null) {
    errors.push("Missing topics object.");
  }
  if (obj.studyLog !== undefined && !Array.isArray(obj.studyLog)) {
    errors.push("studyLog must be an array.");
  }
  if (obj.dailyAvailability !== undefined && !Array.isArray(obj.dailyAvailability)) {
    errors.push("dailyAvailability must be an array.");
  }
  if (errors.length) return { ok: false, errors };
  return { ok: true, errors: [], state: raw as PlannerState };
}
