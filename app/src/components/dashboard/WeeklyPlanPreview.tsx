import { useEffect, useRef, useState } from "react";
import { usePlanner } from "../../state/PlannerContext";
import { Popover } from "../common/Popover";
import { WeeklyDaySummary } from "./WeeklyDaySummary";
import { round1 } from "../../lib/util";
import type { PlanTuning } from "../../types/planner";

const TUNING_OPTIONS: { key: keyof PlanTuning; label: string; hint: string }[] = [
  { key: "lightDay", label: "Light day", hint: "Shorten today into a calm session" },
  { key: "morePractice", label: "More practice", hint: "Add an extra practice block" },
  { key: "moreReview", label: "More review", hint: "Add an extra review block" },
  { key: "focusWeak", label: "Focus weak topics", hint: "Prefer low-confidence topics" },
  { key: "includeAll", label: "Include all topics", hint: "Pull in untouched topics faster" },
];

/**
 * The rolling 7-day plan, one calm summary per day. Each day expands to its full
 * block list. Totals and coverage recompute live from the engine; the Manage
 * menu shapes the plan (nudges), regenerates, or clears manual changes.
 */
export function WeeklyPlanPreview() {
  const { state, model, actions } = usePlanner();
  const week = model.weekStudyPlans;
  const coverage = model.coverage;
  const tuning = state.planTuning;
  const anyNudge = Object.values(tuning).some(Boolean);

  const dates = week.map((d) => d.date);
  const plannedHours = week.reduce((s, d) => s + d.totalPlannedMinutes, 0) / 60;

  // Show a brief "Plan refreshed" note whenever the plan is regenerated. Driven
  // by planSeed so it fires for ANY Regenerate control (week menu or per-day),
  // and is announced to screen readers via the persistent aria-live region.
  const seed = state.planSeed;
  const mounted = useRef(false);
  const [regenNote, setRegenNote] = useState("");
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    setRegenNote("Plan refreshed");
    const id = window.setTimeout(() => setRegenNote(""), 2400);
    return () => window.clearTimeout(id);
  }, [seed]);

  return (
    <section className="panel">
      <div className="panel-head">
        <h3>This week</h3>
        <div className="wk-head-right">
          <span className="wk-regen-note" role="status" aria-live="polite">
            {regenNote}
          </span>
          <span className="muted">{round1(plannedHours)}h planned</span>
          <Popover ariaLabel="Manage week" label="Manage" panelClassName="plan-controls">
            {(close) => (
              <div className="menu-view">
                <span className="menu-view-title">Shape the plan</span>
                <div className="plan-toggles">
                  {TUNING_OPTIONS.map((o) => (
                    <label key={o.key} className="plan-toggle">
                      <input
                        type="checkbox"
                        checked={tuning[o.key]}
                        onChange={(e) => actions.setPlanTuning({ [o.key]: e.target.checked })}
                      />
                      <span className="plan-toggle-text">
                        <span className="plan-toggle-label">{o.label}</span>
                        <span className="plan-toggle-hint">{o.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="menu-divider" />

                <div className="menu-list">
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      actions.regeneratePlan();
                      close();
                    }}
                  >
                    Regenerate week
                  </button>
                  <button
                    type="button"
                    className="menu-item"
                    onClick={() => {
                      actions.clearWeekOverrides(dates);
                      close();
                    }}
                  >
                    Clear manual changes
                  </button>
                  {anyNudge && (
                    <button type="button" className="menu-item" onClick={() => actions.resetPlanTuning()}>
                      Clear nudges
                    </button>
                  )}
                  <p className="menu-note">
                    Regenerate reshuffles topics and keeps locked days, day modes, and anything done.
                  </p>
                </div>
              </div>
            )}
          </Popover>
        </div>
      </div>

      <p className="wk-coverage">
        {coverage.coveredTopics} of {coverage.totalTopics} topics covered
        {coverage.remainingTopics > 0 && ` \u00b7 ${coverage.remainingTopics} remaining`}
        {coverage.weakRemaining > 0 && ` \u00b7 ${coverage.weakRemaining} to strengthen`}
      </p>

      <ul className="week-list">
        {week.map((d) => (
          <WeeklyDaySummary key={d.date} plan={d} />
        ))}
      </ul>
    </section>
  );
}
