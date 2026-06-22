import type { BadgeTone } from "../common/Badge";
import { toneVar } from "./colors";
import { clamp } from "../../lib/util";

export function Donut({
  value,
  centerLabel,
  sublabel,
  tone = "primary",
  size = 132,
}: {
  value: number; // 0..1
  centerLabel: string;
  sublabel?: string;
  tone?: BadgeTone;
  size?: number;
}) {
  const stroke = 13;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const pct = clamp(value, 0, 1);
  const dash = circ * pct;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="donut" role="img">
      <circle cx={center} cy={center} r={r} fill="none" stroke="var(--color-surface-muted)" strokeWidth={stroke} />
      <circle
        cx={center}
        cy={center}
        r={r}
        fill="none"
        stroke={toneVar(tone)}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ - dash}`}
        transform={`rotate(-90 ${center} ${center})`}
      />
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="donut-value">
        {centerLabel}
      </text>
      {sublabel && (
        <text x="50%" y="63%" textAnchor="middle" dominantBaseline="middle" className="donut-sub">
          {sublabel}
        </text>
      )}
    </svg>
  );
}
