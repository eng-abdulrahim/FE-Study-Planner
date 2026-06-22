import { useThemeControls } from "../../state/ThemeProvider";
import type { ThemePreference } from "../../hooks/useTheme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const { preference, setPreference } = useThemeControls();
  return (
    <div className="segmented" role="group" aria-label="Theme">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          className={preference === o.value ? "active" : ""}
          aria-pressed={preference === o.value}
          onClick={() => setPreference(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
