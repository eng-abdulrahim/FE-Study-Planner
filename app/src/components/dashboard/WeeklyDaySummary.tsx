import { useState } from "react";
import { usePlanner } from "../../state/PlannerContext";
import { Badge } from "../common/Badge";
import { TaskRow } from "./TaskRow";
import { DAY_MODE_TONE, getDayModeLabel } from "../../lib/labels";
import { DAY_MODE_OPTIONS } from "../../data/dayModes";
import { formatMinutes } from "../../lib/util";
import type { DailyStudyPlan, DayMode } from "../../types/planner";

/**
 * One day of the week shown as a calm summary: day, headline, total time, block
 * count. Expand to see the full block list (each with Done / Skip) and a compact
 * set of day controls (mode, skip, regenerate this day).
 */
export function WeeklyDaySummary({ plan }: { plan: DailyStudyPlan }) {
  const { actions } = usePlanner();
  const [open, setOpen] = useState(false);

  const hasTasks = plan.tasks.length > 0;
  const doneCount = plan.tasks.filter((t) => t.status === "done").length;
  const preview = plan.isRest
    ? "Rest day"
    : plan.isSkipped
      ? "Day off"
      : hasTasks
        ? plan.tasks.slice(0, 3).map((t) => t.title).join(" · ")
        : "Open day";

  const subText = hasTasks
    ? `${plan.tasks.length} ${plan.tasks.length === 1 ? "block" : "blocks"}${doneCount ? ` · ${doneCount} done` : ""}`
    : plan.focusMessage;

  const Head = (
    <>
      <span className="wk-day">{plan.dayName.slice(0, 3)}</span>
      <div className="wk-info">
        <span className="wk-topic">{preview}</span>
        <span className="wk-sub">
          {plan.isToday && <span className="today-tag">Today</span>}
          {plan.dayMode !== "normal" && (
            <Badge tone={DAY_MODE_TONE[plan.dayMode]}>{getDayModeLabel(plan.dayMode)}</Badge>
          )}
          <span className="wk-sub-text">{subText}</span>
        </span>
      </div>
      <span className="wk-time">{plan.totalPlannedMinutes > 0 ? formatMinutes(plan.totalPlannedMinutes) : "-"}</span>
      {hasTasks && <span className={`chev ${open ? "open" : ""}`} aria-hidden="true" />}
    </>
  );

  return (
    <li className={`wk-row ${plan.isToday ? "is-today" : ""} ${open ? "is-open" : ""}`}>
      {hasTasks ? (
        <button
          type="button"
          className="wk-summary"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {Head}
        </button>
      ) : (
        <div className="wk-summary wk-summary-static">{Head}</div>
      )}

      {open && hasTasks && (
        <div className="wk-expand">
          <p className="wk-focus">{plan.focusMessage}</p>
          <ul className="task-list">
            {plan.tasks.map((t) => (
              <TaskRow key={t.id} date={plan.date} task={t} />
            ))}
          </ul>
          <div className="wk-day-controls">
            <label className="wk-day-mode">
              <span className="menu-field-label">Mode</span>
              <select
                className="select select-sm"
                value={plan.dayMode}
                onChange={(e) => actions.setDayMode(plan.date, e.target.value as DayMode)}
              >
                {DAY_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="wk-day-buttons">
              {plan.isSkipped ? (
                <button type="button" className="btn btn-sm" onClick={() => actions.unskipDay(plan.date)}>
                  Unskip
                </button>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => actions.skipDay(plan.date)}>
                  Skip day
                </button>
              )}
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label="Regenerate the study plan"
                onClick={() => actions.regeneratePlan()}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}
