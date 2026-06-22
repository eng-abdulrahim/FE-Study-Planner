import { usePlanner } from "../../state/PlannerContext";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Popover } from "../common/Popover";
import { TaskRow } from "./TaskRow";
import { DAY_MODE_TONE, getDayModeLabel } from "../../lib/labels";
import { DAY_MODE_OPTIONS } from "../../data/dayModes";
import { formatMinutes } from "../../lib/util";

/**
 * The emotional center of the dashboard: today's multi-block plan kept calm and
 * focused. It shows a supportive headline and the day's blocks (a read-only
 * overview), then exactly three controls:
 *
 *   [ Mark Done / Undo Done ]   [ Day mode ]   [ Skip today / Unskip today ]
 *
 * Granular per-block Done / Skip lives in the "This week" view (today is its
 * first day), so the Today card never feels like a control panel.
 */
export function TodayCard() {
  const { model, actions, today } = usePlanner();
  const plan = model.todayStudyPlan;
  const coverage = model.coverage;

  if (!plan) {
    return (
      <section className="panel today-card">
        <span className="eyebrow">Today&rsquo;s focus</span>
        <h2 className="today-topic">Nothing scheduled</h2>
        <p className="muted">No study day is planned for today. Rest easy and check back tomorrow.</p>
      </section>
    );
  }

  const hasTasks = plan.tasks.length > 0;
  const doneCount = plan.tasks.filter((t) => t.status === "done").length;
  const allDone = hasTasks && doneCount === plan.tasks.length;

  return (
    <section className="panel today-card">
      <div className="today-head">
        <span className="eyebrow">Today&rsquo;s focus</span>
        {plan.phase === "final-review" && <Badge tone="primary">Final review</Badge>}
      </div>

      <p className="today-focus">{plan.focusMessage}</p>

      {hasTasks ? (
        <>
          <div className="today-meta">
            <span>Total {formatMinutes(plan.totalPlannedMinutes)}</span>
            <span className="dot-sep" />
            <span>{plan.tasks.length} blocks</span>
            {doneCount > 0 && (
              <>
                <span className="dot-sep" />
                <span>{doneCount} done</span>
              </>
            )}
          </div>
          <ul className="task-list mode-fade" key={`${plan.date}-${plan.dayMode}`}>
            {plan.tasks.map((t) => (
              <TaskRow key={t.id} date={plan.date} task={t} readOnly />
            ))}
          </ul>
        </>
      ) : (
        <p className="today-empty-text muted">
          {plan.isRest
            ? "Rest day - recharge so your next session counts."
            : plan.isSkipped
              ? "Today is set aside. Pick back up whenever you are ready."
              : "No time blocked today. Add a few minutes whenever you can."}
        </p>
      )}

      <div className="today-actions">
        {hasTasks &&
          (allDone ? (
            <Button variant="primary" onClick={() => actions.resetDayDone(plan.tasks)}>
              Undo Done
            </Button>
          ) : (
            <Button variant="primary" onClick={() => actions.setDayDone(plan.date, plan.tasks)}>
              Mark Done
            </Button>
          ))}

        <div className="today-mode">
          <Popover ariaLabel="Day mode" label="Day mode" buttonClassName="btn" panelClassName="day-mode-menu">
            {(close) => (
              <div className="menu-view">
                <span className="menu-view-title">Day mode</span>
                <div className="menu-list">
                  {DAY_MODE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`menu-item ${plan.dayMode === o.value ? "is-active" : ""}`}
                      onClick={() => {
                        actions.setDayMode(today, o.value);
                        close();
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Popover>
          {plan.dayMode !== "normal" && (
            <Badge tone={DAY_MODE_TONE[plan.dayMode]}>{getDayModeLabel(plan.dayMode)}</Badge>
          )}
        </div>

        {plan.isSkipped ? (
          <Button variant="ghost" onClick={() => actions.unskipDay(today)}>
            Unskip today
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => actions.skipDay(today)}>
            Skip today
          </Button>
        )}
      </div>

      <p className="today-coverage">
        {coverage.coveredTopics} of {coverage.totalTopics} topics covered
        {coverage.remainingTopics > 0 ? ` \u00b7 ${coverage.remainingTopics} to go` : " \u00b7 all touched"}
      </p>
    </section>
  );
}
