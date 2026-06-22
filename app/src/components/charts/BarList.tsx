import type { BadgeTone } from "../common/Badge";
import { toneVar } from "./colors";

export interface BarItem {
  key: string;
  label: string;
  value: number;
  tone?: BadgeTone;
  valueLabel?: string;
}

export function BarList({ items, max }: { items: BarItem[]; max?: number }) {
  const top = Math.max(1, max ?? Math.max(...items.map((i) => i.value), 0));
  return (
    <div className="barlist">
      {items.map((it) => {
        const pct = Math.round((it.value / top) * 100);
        return (
          <div className="barlist-row" key={it.key}>
            <span className="barlist-label" title={it.label}>
              {it.label}
            </span>
            <span className="barlist-track">
              <span
                className="barlist-fill"
                style={{ width: `${pct}%`, background: toneVar(it.tone ?? "primary") }}
              />
            </span>
            <span className="barlist-value">{it.valueLabel ?? it.value}</span>
          </div>
        );
      })}
    </div>
  );
}
