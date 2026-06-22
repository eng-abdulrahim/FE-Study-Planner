import { useEffect, useRef } from "react";
import type { ComponentType, SVGProps } from "react";
import { IconDashboard, IconTopics, IconPanel, IconClose } from "../common/icons";

export type PageId = "dashboard" | "topics";

const ITEMS: { id: PageId; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: "dashboard", label: "Dashboard", Icon: IconDashboard },
  { id: "topics", label: "Topics", Icon: IconTopics },
];

export function Sidebar({
  open,
  collapsed,
  active,
  onNavigate,
  onToggleCollapse,
  onClose,
  mobileHidden = false,
}: {
  open: boolean;
  collapsed: boolean;
  active: PageId;
  onNavigate: (page: PageId) => void;
  onToggleCollapse: () => void;
  onClose?: () => void;
  /** True when the drawer is offscreen on mobile: keep it out of the tab order. */
  mobileHidden?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);

  // Use the native `inert` attribute (not typed on React 18 props) so the
  // offscreen drawer can't be focused/tabbed into on mobile.
  useEffect(() => {
    const el = ref.current;
    if (el) el.inert = mobileHidden;
  }, [mobileHidden]);

  return (
    <aside
      ref={ref}
      id="app-sidebar"
      className={`app-sidebar ${collapsed ? "collapsed" : ""} ${open ? "open" : ""}`}
      aria-label="Sidebar navigation"
    >
      <div className="side-brand">
        <div className="brand-mark">FE</div>
        <div className="side-brand-text">
          <div className="brand-title">Latifah FE Study Planner</div>
          <div className="brand-sub">Electrical &amp; Computer</div>
        </div>
        <button
          className="side-close icon-btn"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <IconClose width={18} height={18} />
        </button>
      </div>

      <nav className="side-nav">
        {ITEMS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`side-link ${active === id ? "active" : ""}`}
            aria-current={active === id ? "page" : undefined}
            title={collapsed ? label : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon className="side-icon" />
            <span className="label">{label}</span>
          </button>
        ))}
      </nav>

      <div className="side-foot">
        <button
          className="side-collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <IconPanel className="side-icon" />
          <span className="label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      </div>
    </aside>
  );
}
