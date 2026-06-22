// Plain-JSON cloud envelope: a thin wrapper around the full planner state.
// The state stays compatible with the existing importJson / hydrate path.
import type { PlannerState } from "../types/planner";
import { exportJson } from "./storage";
import { APP_VERSION, SYNC_SCHEMA_VERSION } from "./syncMeta";

export interface SyncEnvelope {
  schemaVersion: number;
  appVersion: string;
  lastUpdatedAt: string;
  deviceId: string;
  state: unknown;
}

export function buildEnvelope(
  state: PlannerState,
  deviceId: string,
  now: string = new Date().toISOString(),
): SyncEnvelope {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    // Real data-change instant (falls back to now only for never-edited state).
    lastUpdatedAt: state.lastUpdatedAt ?? now,
    deviceId,
    state: JSON.parse(exportJson(state)),
  };
}

export function serializeEnvelope(
  state: PlannerState,
  deviceId: string,
  now?: string,
): string {
  return JSON.stringify(buildEnvelope(state, deviceId, now), null, 2);
}

/** Extract the inner planner state from a cloud file (tolerates a raw state). */
export function readEnvelopeState(contentJson: string): unknown {
  const parsed = JSON.parse(contentJson) as Record<string, unknown>;
  return parsed && typeof parsed === "object" && "state" in parsed ? parsed.state : parsed;
}
