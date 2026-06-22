import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { DoneToggle } from "./DoneToggle";
import { STATUS_TONE, TIER_TONE, getStatusLabel } from "../../lib/labels";
import { clamp, round1 } from "../../lib/util";
import type { ComputedTopic } from "../../types/planner";

export function TopicRow({
  topic,
  index,
  onEdit,
}: {
  topic: ComputedTopic;
  index: number;
  onEdit: (id: string) => void;
}) {
  const { seed, state } = topic;
  const pct = seed.plannedHours > 0 ? clamp(state.completedHours / seed.plannedHours, 0, 1) : 0;

  return (
    <tr>
      <td className="col-num">{index}</td>
      <td className="col-topic">{seed.topicName}</td>
      <td className="col-section">{seed.section}</td>
      <td>
        <Badge tone={TIER_TONE[seed.tier]}>Tier {seed.tier}</Badge>
      </td>
      <td>
        <Badge tone={STATUS_TONE[state.status]}>{getStatusLabel(state.status)}</Badge>
      </td>
      <td className="col-done">
        <DoneToggle topic={topic} />
      </td>
      <td className="col-progress">
        <div className="progress">
          <span className="progress-track">
            <span className="progress-fill" style={{ width: `${pct * 100}%` }} />
          </span>
          <span className="progress-text">
            {round1(state.completedHours)}/{seed.plannedHours}h
          </span>
        </div>
      </td>
      <td className="col-notes">
        {state.noteUrl ? (
          <a className="link-btn" href={state.noteUrl} target="_blank" rel="noopener noreferrer">
            Open note
          </a>
        ) : (
          <button className="link-btn subtle" onClick={() => onEdit(seed.id)}>
            Add note
          </button>
        )}
      </td>
      <td className="col-actions">
        <Button size="sm" onClick={() => onEdit(seed.id)}>
          Edit
        </Button>
      </td>
    </tr>
  );
}
