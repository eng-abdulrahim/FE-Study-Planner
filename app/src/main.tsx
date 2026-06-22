import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app/App";
import { notifyVisit } from "./visitNotify";
import "./styles/globals.css";
import "./styles/layout.css";
import "./styles/dashboard.css";
import "./styles/table.css";
import "./styles/sync.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Fire-and-forget visitor ping (frontend-only, best-effort). Fires on every page
// load/refresh from the module level (not inside a component) so it can't be
// skipped by routing/mount state, isn't duplicated by React StrictMode's
// double-render, and never blocks rendering. See src/visitNotify.ts for the
// security trade-offs.
void notifyVisit();

// Dev-only manual trigger: run `window.__testVisitNotify()` in the browser
// console to fire a ping on demand while debugging. Never exposed in production.
if (import.meta.env.DEV) {
  (window as unknown as { __testVisitNotify?: typeof notifyVisit }).__testVisitNotify = notifyVisit;
}
