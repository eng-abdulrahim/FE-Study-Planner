// Cloud-sync React wrapper around the framework-agnostic sync engine.
//
// All config (owner/repo/branch/path/token) comes from SYNC_CONFIG; there is no
// settings UI. The token is read only when calling GitHub and is never
// persisted, never put in the synced file, never logged, and never placed in an
// error message or commit message.
//
// Auto-save: any planner DATA change (state.lastUpdatedAt) schedules a debounced
// push. The single header "Sync" button is now a manual force-sync/refresh.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { usePlanner } from "./PlannerContext";
import { importJson } from "../lib/storage";
import { getFile, putFile } from "../lib/githubSync";
import { loadSyncMeta, saveSyncMeta } from "../lib/syncMeta";
import type { SyncMeta } from "../lib/syncMeta";
import type { SyncStatus } from "../lib/syncStatus";
import { readEnvelopeState, serializeEnvelope } from "../lib/syncEnvelope";
import { AUTO_PUSH_DEBOUNCE_MS } from "../lib/autoPush";
import { createSyncEngine } from "../lib/syncEngine";
import type { SyncEngine } from "../lib/syncEngine";
import { SYNC_CONFIG, isSyncConfigured } from "../config/syncConfig";

interface SyncContextValue {
  syncStatus: SyncStatus;
  message: string;
  lastError: string | null;
  lastSyncedAt: string | null;
  /** Manual force sync / refresh (saving and loading are otherwise automatic). */
  syncNow: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const SUCCESS_VISIBLE_MS = 2500;
const AUTO_LOAD_INTERVAL_MS = 60_000;
const INITIAL_LOAD_DELAY_MS = 800;

export function SyncProvider({ children }: { children: ReactNode }) {
  const { state, actions } = usePlanner();

  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState("");
  const [lastError, setLastError] = useState<string | null>(null);
  const [meta, setMeta] = useState<SyncMeta>(() => loadSyncMeta());

  // Always-fresh mirrors so the engine's async work never reads stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const metaRef = useRef<SyncMeta>(meta);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMountRef = useRef(false);

  const commitMeta = useCallback((patch: Partial<SyncMeta>) => {
    const next = { ...metaRef.current, ...patch };
    metaRef.current = next;
    saveSyncMeta(next);
    setMeta(next);
  }, []);

  // Single status sink for the engine. Success states auto-revert to idle so the
  // button settles back to "Sync" after briefly showing "Synced"/"Saved".
  const handleStatus = useCallback((status: SyncStatus, msg: string) => {
    setSyncStatus(status);
    setMessage(msg);
    setLastError(status === "error" ? msg : null);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (status === "success") {
      successTimerRef.current = setTimeout(() => {
        setSyncStatus((s) => (s === "success" ? "idle" : s));
        setMessage((m) => (m === msg ? "" : m));
      }, SUCCESS_VISIBLE_MS);
    }
  }, []);

  // Build the engine once; its deps read refs so it always sees fresh data.
  const engineRef = useRef<SyncEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = createSyncEngine({
      debounceMs: AUTO_PUSH_DEBOUNCE_MS,
      getToken: () => (isSyncConfigured() ? SYNC_CONFIG.token : null),
      target: () => ({
        owner: SYNC_CONFIG.owner,
        repo: SYNC_CONFIG.repo,
        path: SYNC_CONFIG.path,
        branch: SYNC_CONFIG.branch,
      }),
      getState: () => stateRef.current,
      getMeta: () => metaRef.current,
      commitMeta,
      serialize: (s, deviceId) => serializeEnvelope(s, deviceId),
      parseRemote: (contentJson) => {
        let inner: unknown;
        try {
          inner = readEnvelopeState(contentJson);
        } catch {
          return null;
        }
        // Remote data ALWAYS goes through the existing validation + hydrate path
        // (which also strips unsafe note URLs). Never applied directly.
        const result = importJson(JSON.stringify(inner));
        return result.ok && result.state ? result.state : null;
      },
      applyRemoteState: (s) => actionsRef.current.importState(s),
      getFile,
      putFile,
      onStatus: handleStatus,
    });
  }

  // Auto-save: any real planner DATA change schedules a debounced push. The
  // first run (mount) is skipped so opening the app never triggers a network
  // call on its own.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    engineRef.current?.onLocalChange();
  }, [state.lastUpdatedAt]);

  // Auto-load (no user action): pull newer cloud data on open, when the tab
  // regains focus/visibility, and on a light interval. Background loads are
  // quiet (no spinner) unless they actually bring in new data.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const load = () => void engine.autoLoad();

    const initial = setTimeout(load, INITIAL_LOAD_DELAY_MS);
    const poll = setInterval(load, AUTO_LOAD_INTERVAL_MS);
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(initial);
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Clean up timers on unmount.
  useEffect(() => {
    const engine = engineRef.current;
    return () => {
      engine?.dispose();
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const syncNow = useCallback(() => engineRef.current!.syncNow(), []);

  const value = useMemo<SyncContextValue>(
    () => ({
      syncStatus,
      message,
      lastError,
      lastSyncedAt: meta.lastSyncedAt,
      syncNow,
    }),
    [syncStatus, message, lastError, meta.lastSyncedAt, syncNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
