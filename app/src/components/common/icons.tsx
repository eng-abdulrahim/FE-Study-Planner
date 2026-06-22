// Inline SVG icons (no emojis). Stroke-based, inherit currentColor.
import type { SVGProps } from "react";

function Base(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function IconDashboard(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </Base>
  );
}

export function IconTopics(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </Base>
  );
}

export function IconPanel(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </Base>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  );
}

export function IconSync(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.5-4" />
      <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.5 4" />
      <path d="M21 4v4h-4" />
      <path d="M3 20v-4h4" />
    </Base>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Base>
  );
}

export function IconKey(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="m10.7 12.3 8.3-8.3" />
      <path d="m16 5 3 3" />
      <path d="m19 3 2 2" />
    </Base>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="m6 9 6 6 6-6" />
    </Base>
  );
}
