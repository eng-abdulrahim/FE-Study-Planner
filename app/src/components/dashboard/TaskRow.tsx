import { usePlanner } from "../../state/PlannerContext";
import { Badge } from "../common/Badge";
import { TASK_TYPE_LABEL, TASK_TYPE_TONE } from "../../lib/labels";
import { formatMinutes } from "../../lib/util";
import type { DailyStudyTask } from "../../types/planner";

/**
 * One block of a day's plan: type, title, minutes, and a short instruction.
 * By default it also shows the per-block actions (Done / Skip, or Undo) used by
 * the expanded weekly day. The Today card renders it `readOnly` - the blocks are
 * a calm overview there and a single "Mark Done" handles the whole day - so the
 * card stays uncluttered. Done/Skip persist and trigger the cloud auto-push.
 */
export function TaskRow({
  date,
  task,
  readOnly = false,
}: {
  date: string;
  task: DailyStudyTask;
  readOnly?: boolean;
}) {
  const { actions } = usePlanner();
  const done = task.status === "done";
  const skipped = task.status === "skipped";

  return (
    <li className={`task-row ${done ? "is-done" : ""} ${skipped ? "is-skipped" : ""}`}>
      <div className="task-lead">
        <Badge tone={TASK_TYPE_TONE[task.type]}>{TASK_TYPE_LABEL[task.type]}</Badge>
        <span className="task-time">{formatMinutes(task.plannedMinutes)}</span>
      </div>

      <div className="task-body">
        <span className="task-title">{task.title}</span>
        {task.section && <span className="task-section">{task.section}</span>}
        <span className="task-reason">{task.reason}</span>
      </div>

      {!readOnly && (
        <div className="task-actions">
          {done || skipped ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              aria-label={`Undo ${task.title}`}
              onClick={() => actions.resetTask(task)}
            >
              Undo
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-sm btn-success"
                aria-label={`Mark ${task.title} done`}
                onClick={() => actions.setTaskDone(date, task)}
              >
                Done
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-label={`Skip ${task.title}`}
                onClick={() => actions.skipTask(task)}
              >
                Skip
              </button>
            </>
          )}
          {task.noteUrl && (
            <a className="btn btn-sm" href={task.noteUrl} target="_blank" rel="noopener noreferrer">
              Note
            </a>
          )}
        </div>
      )}
    </li>
  );
}
