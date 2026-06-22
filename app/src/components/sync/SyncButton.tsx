import { useEffect, useState } from "react";
import { useSync } from "../../state/SyncContext";
import { describeSyncButton } from "../../lib/syncStatus";
import { ACTIVATION_COPY } from "../../lib/activationCopy";
import { IconChevronDown, IconSync } from "../common/icons";

// Header cloud-sync control. Shows a generic status label (never any provider
// wording) and a small options menu (Activate / Change / Remove / Local only).
export function SyncButton() {
  const {
    mode,
    syncStatus,
    message,
    isActivated,
    syncNow,
    openActivation,
    removeKey,
  } = useSync();
  const view = describeSyncButton(mode, syncStatus);

  const [menuOpen, setMenuOpen] = useState(false);

  // Non-blocking status text: "Saving..." (auto-save), "Synced", errors.
  const showToast =
    message.length > 0 &&
    (syncStatus === "syncing" || syncStatus === "success" || syncStatus === "error");
  const toastTone =
    syncStatus === "success" ? "is-success" : syncStatus === "error" ? "is-error" : "";

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const onPrimary = () => {
    if (mode === "checking") return;
    if (isActivated) void syncNow();
    else openActivation();
  };

  const runMenu = (fn: () => void) => {
    fn();
    setMenuOpen(false);
  };

  return (
    <div className="sync-wrap">
      <button
        type="button"
        className={`btn btn-sm sync-button ${view.spinning ? "is-syncing" : ""} ${view.toneClass}`}
        onClick={onPrimary}
        disabled={mode === "checking" || syncStatus === "syncing"}
        aria-busy={view.spinning}
        aria-label={isActivated ? "Sync now" : "Activate cloud sync"}
        title={
          isActivated
            ? "Your progress saves and loads automatically. Click to sync now."
            : "Activate cloud sync to back up your progress across devices."
        }
      >
        <IconSync className="sync-icon" width={15} height={15} />
        <span className="sync-label">{view.label}</span>
      </button>

      <button
        type="button"
        className="sync-settings-btn"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Cloud sync options"
        title="Cloud sync options"
      >
        <IconChevronDown width={14} height={14} />
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            className="sync-popover-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div className="sync-menu" role="menu">
            {isActivated ? (
              <>
                <p className="sync-menu-hint">{ACTIVATION_COPY.connectedHint}</p>
                <button
                  type="button"
                  role="menuitem"
                  className="sync-menu-item"
                  onClick={() => runMenu(() => void syncNow())}
                >
                  {ACTIVATION_COPY.menuSyncNow}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="sync-menu-item"
                  onClick={() => runMenu(openActivation)}
                >
                  {ACTIVATION_COPY.menuChange}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="sync-menu-item is-danger"
                  onClick={() => runMenu(removeKey)}
                >
                  {ACTIVATION_COPY.menuRemove}
                </button>
              </>
            ) : (
              <button
                type="button"
                role="menuitem"
                className="sync-menu-item"
                onClick={() => runMenu(openActivation)}
              >
                {ACTIVATION_COPY.menuActivate}
              </button>
            )}
          </div>
        </>
      )}

      {showToast && (
        <span className={`sync-toast ${toastTone}`} role="status">
          {message}
        </span>
      )}
    </div>
  );
}
