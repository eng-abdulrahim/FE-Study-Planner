import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Tiny accessible popover: a trigger button + a panel that closes on outside
 * click or Escape. `children` is a render prop receiving a `close` callback so
 * menu items can dismiss the panel after acting. No portal, no library.
 */
export function Popover({
  label,
  ariaLabel,
  buttonClassName = "btn btn-sm",
  panelClassName = "",
  align = "right",
  disabled = false,
  onOpenChange,
  children,
}: {
  label: ReactNode;
  ariaLabel: string;
  buttonClassName?: string;
  panelClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const set = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) set(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") set(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="popover" ref={ref}>
      <button
        type="button"
        className={buttonClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => set(!open)}
      >
        {label}
      </button>
      {open && (
        <div className={`popover-panel ${align === "left" ? "align-left" : "align-right"} ${panelClassName}`} role="menu">
          {children(() => set(false))}
        </div>
      )}
    </div>
  );
}
