import { useEffect, useId, useRef, useState } from "react";
import { useSync } from "../../state/SyncContext";
import { ACTIVATION_COPY } from "../../lib/activationCopy";
import { activationErrorMessage } from "../../lib/activation";
import { IconClose } from "../common/icons";

type Phase = "idle" | "checking" | "success";

// App-level modal for entering the cloud-sync activation key. Generic wording
// only (no provider names). The key is never shown in full unless the user opts
// to reveal what they typed, and it is never logged or persisted from here -
// SyncContext stores it in localStorage only after validation succeeds.
export function ActivationModal() {
  const { activationModalOpen, activationError, activate, closeActivation } = useSync();

  const [key, setKey] = useState("");
  const [reveal, setReveal] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const errId = useId();
  const inputId = useId();

  // Reset + seed each time the modal opens.
  useEffect(() => {
    if (!activationModalOpen) return;
    setKey("");
    setReveal(false);
    setPhase("idle");
    setError(activationError ?? null);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [activationModalOpen, activationError]);

  // Escape dismisses the modal.
  useEffect(() => {
    if (!activationModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeActivation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activationModalOpen, closeActivation]);

  if (!activationModalOpen) return null;

  const busy = phase === "checking";
  const done = phase === "success";

  const submit = async () => {
    const trimmed = key.trim();
    if (!trimmed) {
      setError(ACTIVATION_COPY.errEmpty);
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setPhase("checking");
    const res = await activate(trimmed);
    if (res.ok) {
      setKey("");
      setPhase("success");
      window.setTimeout(() => closeActivation(), 900);
    } else {
      setPhase("idle");
      setError(activationErrorMessage(res.reason));
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="activation-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeActivation();
      }}
    >
      <div
        className="activation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        <div className="activation-head">
          <h2 id={titleId} className="activation-title">
            {ACTIVATION_COPY.modalTitle}
          </h2>
          <button
            type="button"
            className="sync-popover-close"
            aria-label="Close"
            onClick={closeActivation}
          >
            <IconClose width={16} height={16} />
          </button>
        </div>

        <p id={descId} className="activation-desc">
          {ACTIVATION_COPY.modalDescription}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="activation-field" htmlFor={inputId}>
            <span className="field-label">{ACTIVATION_COPY.inputLabel}</span>
            <div className="activation-input-row">
              <input
                id={inputId}
                ref={inputRef}
                className="input"
                type={reveal ? "text" : "password"}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                placeholder={ACTIVATION_COPY.inputPlaceholder}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                disabled={busy || done}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errId : undefined}
              />
              <button
                type="button"
                className="activation-show-btn"
                onClick={() => setReveal((s) => !s)}
                disabled={busy || done}
                aria-pressed={reveal}
              >
                {reveal ? ACTIVATION_COPY.hide : ACTIVATION_COPY.show}
              </button>
            </div>
          </label>

          {error && (
            <p id={errId} className="activation-error" role="alert">
              {error}
            </p>
          )}
          {done && (
            <p className="activation-success" role="status">
              {ACTIVATION_COPY.success}
            </p>
          )}

          <div className="activation-actions">
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy || done}>
              {busy ? ACTIVATION_COPY.checking : ACTIVATION_COPY.activate}
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={closeActivation}
              disabled={busy || done}
            >
              {ACTIVATION_COPY.cancel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
