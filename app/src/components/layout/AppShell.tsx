import { useEffect, useState } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import type { PageId } from "./Sidebar";
import { DashboardPage } from "../dashboard/DashboardPage";
import { TopicsPage } from "../topics/TopicsPage";
import { useMediaQuery } from "../../hooks/useMediaQuery";

const COLLAPSE_KEY = "latifah-fe-sidebar-collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const isMobile = useMediaQuery("(max-width: 900px)");

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore persistence errors */
    }
  }, [collapsed]);

  // Close the mobile drawer when leaving the mobile breakpoint.
  useEffect(() => {
    if (!isMobile) setMenuOpen(false);
  }, [isMobile]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const go = (p: PageId) => {
    setPage(p);
    setMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${menuOpen ? "show" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <Sidebar
        open={menuOpen}
        collapsed={collapsed}
        active={page}
        onNavigate={go}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onClose={() => setMenuOpen(false)}
        mobileHidden={isMobile && !menuOpen}
      />
      <div className="app-content">
        <Header onMenu={() => setMenuOpen((o) => !o)} menuOpen={menuOpen} />
        <main className="app-main">
          <div key={page} className="page-fade">
            {page === "dashboard" ? <DashboardPage /> : <TopicsPage />}
          </div>
        </main>
      </div>
    </div>
  );
}
