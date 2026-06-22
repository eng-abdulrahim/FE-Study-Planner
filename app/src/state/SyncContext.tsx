// Cloud-sync React wrapper around the framework-agnostic sync engine.
//
// Activation model:
// - The cloud-sync access key ("activation key") is entered by the user at
//   runtime and stored ONLY in this browser's localStorage. It is never read
//   from env, embedded in the bundle, put in the synced file, logged, exported,
//   or placed in an error/commit message.
// - On startup we load local planner data immediately, then either prompt for a
//   key (modal) or silently validate the stored one before starting cloud sync.
// - The engine reads the active key via getToken() at call time, so no static
//   build config is involved.
//
// Auto-save: any planner DATA change (state.lastUpdatedAt) schedules a debounced
// push when a valid key is active. The header control is a manual force sync.
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
import type { SyncMode, SyncStatus } from "../lib/syncStatus";
import { readEnvelopeState, serializeEnvelope } from "../lib/syncEnvelope";
import { AUTO_PUSH_DEBOUNCE_MS } from "../lib/autoPush";
import { createSyncEngine } from "../lib/syncEngine";
import type { SyncEngine } from "../lib/syncEngine";
import { SYNC_CONFIG } from "../config/syncConfig";
import {
  clearStoredActivationKey,
  getStoredActivationKey,
  setStoredActivationKey,
} from "../lib/activationKey";
import { activationErrorMessage, validateActivationKey } from "../lib/activation";
import type { ActivationResult } from "../lib/activation";
import { ACTIVATION_COPY } from "../lib/activationCopy";

interface SyncContextValue {
  /** High-level activation state that drives the header label. */
  mode: SyncMode;
  /** Transient state of an in-flight sync action. */
  syncStatus: SyncStatus;
  /** Last transient toast message (generic wording). */
  message: string;
  /** True when a valid key is active and cloud sync is running. */
  isActivated: boolean;
  lastSyncedAt: string | null;
  /** Whether the activation modal is currently open. */
  activationModalOpen: boolean;
  /** Inline error to show inside the activation modal (generic wording). */
  activationError: string | null;
  /** Open the activation modal (Activate / Change activation key). */
  openActivation: () => void;
  /** Dismiss the activation modal without changing the mode. */
  closeActivation: () => void;
  /** Forget the stored key on this device; keep local data. */
  removeKey: () => void;
  /** Validate a key; on success store it and start cloud sync. */
  activate: (key: string) => Promise<ActivationResult>;
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
  const [meta, setMeta] = useState<SyncMeta>(() => loadSyncMeta());

  // Startup: a stored key means "validate silently"; no key means "prompt".
  const [mode, setMode] = useState<SyncMode>(() =>
    getStoredActivationKey() ? "checking" : "needs-activation",
  );
  const [activationModalOpen, setActivationModalOpen] = useState<boolean>(
    () => getStoredActivationKey() === null,
  );
  const [activationError, setActivationError] = useState<string | null>(null);

  // Always-fresh mirrors so the engine's async work never reads stale closures.
  const stateRef = useRef(state);
  stateRef.current = state;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const metaRef = useRef<SyncMeta>(meta);
  // The ACTIVE key only (null until validated). The engine reads this at call
  // time; it is never set unless a key has been confirmed usable.
  const tokenRef = useRef<string | null>(null);
  const modeRef = useRef<SyncMode>(mode);
  modeRef.current = mode;

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didMountRef = useRef(false);

  const commitMeta = useCallback((patch: Partial<SyncMeta>) => {
    const next = { ...metaRef.current, ...patch };
    metaRef.current = next;
    saveSyncMeta(next);
    setMeta(next);
  }, []);

  // Single status sink for the engine. Success states auto-revert to idle so the
  // control settles back to "Cloud sync active" after "Synced"/"Saved".
  const handleStatus = useCallback((status: SyncStatus, msg: string) => {
    setSyncStatus(status);
    setMessage(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    if (status === "success") {
      successTimerRef.current = setTimeout(() => {
        setSyncStatus((s) => (s === "success" ? "idle" : s));
        setMessage((m) => (m === msg ? "" : m));
      }, SUCCESS_VISIBLE_MS);
    }
  }, []);

  // An invalid/expired/forbidden key during normal sync: drop the key and
  // re-prompt. Local planner data is never touched.
  const handleAuthError = useCallback(() => {
    clearStoredActivationKey();
    tokenRef.current = null;
    setMode("needs-activation");
    setActivationError(ACTIVATION_COPY.errNoLongerValid);
    setActivationModalOpen(true);
  }, []);

  // Build the engine once; its deps read refs so it always sees fresh data.
  const engineRef = useRef<SyncEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = createSyncEngine({
      debounceMs: AUTO_PUSH_DEBOUNCE_MS,
      getToken: () => tokenRef.current,
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
      onAuthError: handleAuthError,
    });
  }

  // Startup: validate a stored key silently before any cloud sync begins.
  useEffect(() => {
    const stored = getStoredActivationKey();
    if (!stored) return; // no key -> modal already open, mode is needs-activation
    let cancelled = false;
    void validateActivationKey(stored).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        tokenRef.current = stored;
        setMode("active");
        void engineRef.current?.syncNow();
      } else if (res.reason === "network") {
        // Offline at startup: keep the key and proceed optimistically. The
        // normal retry/auto-load path catches up; a real auth failure later
        // re-prompts via handleAuthError.
        tokenRef.current = stored;
        setMode("active");
      } else {
        clearStoredActivationKey();
        tokenRef.current = null;
        setMode("needs-activation");
        setActivationError(ACTIVATION_COPY.errNoLongerValid);
        setActivationModalOpen(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save: any real planner DATA change schedules a debounced push. The
  // first run (mount) is skipped so opening the app never triggers a network
  // call on its own. The engine no-ops while no key is active.
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    engineRef.current?.onLocalChange();
  }, [state.lastUpdatedAt]);

  // Auto-load (no user action): pull newer cloud data on open, when the tab
  // regains focus/visibility, and on a light interval. Quiet unless it brings
  // in new data; no-ops while no key is active.
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

  // Validate a key; on success store it (localStorage only) and start sync. A
  // failure never overwrites an already-working key. The modal owns closing so
  // it can briefly show the success state.
  const activate = useCallback(async (raw: string): Promise<ActivationResult> => {
    const key = raw.trim();
    if (!key) return { ok: false, reason: "empty" };
    const prevMode = modeRef.current;
    setActivationError(null);
    setMode("checking");
    const res = await validateActivationKey(key);
    if (res.ok) {
      setStoredActivationKey(key);
      tokenRef.current = key;
      setMode("active");
      setActivationError(null);
      void engineRef.current?.syncNow();
    } else {
      setMode(prevMode === "active" ? "active" : "needs-activation");
      setActivationError(activationErrorMessage(res.reason));
    }
    return res;
  }, []);

  const openActivation = useCallback(() => {
    setActivationError(null);
    setActivationModalOpen(true);
  }, []);

  const closeActivation = useCallback(() => {
    setActivationModalOpen(false);
  }, []);

  const removeKey = useCallback(() => {
    clearStoredActivationKey();
    tokenRef.current = null;
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    setSyncStatus("idle");
    setMessage("");
    setActivationError(null);
    setMode("local-only");
  }, []);

  const value = useMemo<SyncContextValue>(
    () => ({
      mode,
      syncStatus,
      message,
      isActivated: mode === "active",
      lastSyncedAt: meta.lastSyncedAt,
      activationModalOpen,
      activationError,
      openActivation,
      closeActivation,
      removeKey,
      activate,
      syncNow,
    }),
    [
      mode,
      syncStatus,
      message,
      meta.lastSyncedAt,
      activationModalOpen,
      activationError,
      openActivation,
      closeActivation,
      removeKey,
      activate,
      syncNow,
    ],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within a SyncProvider");
  return ctx;
}
