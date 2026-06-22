import { usePlanner } from "../../state/PlannerContext";
import { ThemeToggle } from "./ThemeToggle";
import { IconMenu } from "../common/icons";
import { SyncButton } from "../sync/SyncButton";

export function Header({ onMenu, menuOpen = false }: { onMenu: () => void; menuOpen?: boolean }) {
  const { state } = usePlanner();
  const savedTitle = state.lastSaved
    ? `Saved at ${new Date(state.lastSaved).toLocaleTimeString()}`
    : "Your changes are saved automatically in this browser";

  return (
    <header className="app-header">
      <div className="app-header-row">
        <button
          className="icon-btn menu-btn"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          onClick={onMenu}
        >
          <IconMenu />
        </button>

        <div className="header-brand">
          <span className="header-brand-title">Latifah FE Study Planner</span>
          <span className="header-brand-sub">A calm plan for steady progress</span>
        </div>

        <div className="header-actions">
          <span className="saved-chip" title={savedTitle}>
            <span className="saved-dot" />
            <span className="saved-text">Saved</span>
          </span>
          <SyncButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
