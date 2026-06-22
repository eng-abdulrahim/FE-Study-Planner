import { usePlanner } from "../../state/PlannerContext";
import { formatHours, formatMinutes, formatWeekProgress } from "../../lib/util";

/**
 * Lower metrics row. Numeric/stat cards only - the (non-metric) Gentle reminder
 * note now lives in the upper grid beside the Exam date card. Every value reads
 * from the one canonical `model.summary` (see lib/plannerLogic), which is
 * recomputed from planner state on every change - so marking a task Done,
 * undoing, changing the exam date, regenerating, importing or syncing all update
 * these numbers immediately, with no stale values and no per-card formula drift.
 */
export function SummaryCards() {
  const { model } = usePlanner();
  const s = model.summary;

  const cards: { label: string; value: string; sub: string }[] = [
    {
      label: "Days remaining",
      value: s.examPassed ? "Passed" : String(s.daysRemaining),
      sub: "until exam",
    },
    {
      label: "Completed",
      value: formatHours(s.completedHours),
      sub: `of ${formatHours(s.plannedTotalHours)}`,
    },
    {
      label: "Remaining",
      value: formatHours(s.remainingHours),
      sub: "still to cover",
    },
    {
      label: "Preparation",
      value: `${s.preparationPercent}%`,
      sub: s.preparationLabel,
    },
    {
      label: "This week",
      value: formatWeekProgress(s.weeklyCompletedCount, s.weeklyTotalCount),
      sub: `${formatMinutes(s.weeklyCompletedMinutes)} done`,
    },
  ];

  return (
    <section className="stat-grid">
      {cards.map((c) => (
        <div className="stat" key={c.label}>
          <span className="stat-label">{c.label}</span>
          <span className="stat-value">{c.value}</span>
          <span className="stat-sub">{c.sub}</span>
        </div>
      ))}
    </section>
  );
}
