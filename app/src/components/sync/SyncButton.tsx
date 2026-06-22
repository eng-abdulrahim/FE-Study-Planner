import { useSync } from "../../state/SyncContext";
import { describeSyncButton } from "../../lib/syncStatus";
import { IconSync } from "../common/icons";

export function SyncButton() {
  const { syncStatus, message, syncNow } = useSync();
  const view = describeSyncButton(syncStatus);
  // Non-blocking status text: "Saving..." (auto-save), "Saved", "Synced", errors.
  const showToast =
    message.length > 0 &&
    (syncStatus === "syncing" || syncStatus === "success" || syncStatus === "error");
  const toastTone =
    syncStatus === "success" ? "is-success" : syncStatus === "error" ? "is-error" : "";

  return (
    <div className="sync-wrap">
      <button
        type="button"
        className={`btn btn-sm sync-button ${view.spinning ? "is-syncing" : ""} ${view.toneClass}`}
        onClick={() => void syncNow()}
        disabled={syncStatus === "syncing"}
        aria-label="Sync with GitHub"
        aria-busy={syncStatus === "syncing"}
        title="Your progress saves and loads automatically. Click to sync now."
      >
        <IconSync className="sync-icon" width={15} height={15} />
        <span className="sync-label">{view.label}</span>
      </button>

      {showToast && (
        <span className={`sync-toast ${toastTone}`} role="status">
          {message}
        </span>
      )}
    </div>
  );
}
