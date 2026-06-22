import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { DoneToggle } from "./DoneToggle";
import {
  STATUS_TONE,
  TIER_TONE,
  getConfidenceShortLabel,
  getStatusLabel,
} from "../../lib/labels";
import { clamp, round1 } from "../../lib/util";
import type { ComputedTopic } from "../../types/planner";

/** Mobile/touch layout for the topics list: one readable card per topic
 *  instead of a horizontally scrolling table. */
export function TopicCards({
  rows,
  startIndex,
  onEdit,
}: {
  rows: ComputedTopic[];
  startIndex: number;
  onEdit: (id: string) => void;
}) {
  return (
    <ul className="topic-cards">
      {rows.map((t, i) => {
        const { seed, state } = t;
        const pct = seed.plannedHours > 0 ? clamp(state.completedHours / seed.plannedHours, 0, 1) : 0;
        return (
          <li className="topic-card" key={seed.id}>
            <div className="tc-top">
              <div className="tc-head">
                <span className="tc-num">{startIndex + i + 1}</span>
                <h3 className="tc-name">{seed.topicName}</h3>
                <span className="tc-section">{seed.section}</span>
              </div>
              <Button size="sm" onClick={() => onEdit(seed.id)} aria-label={`Edit ${seed.topicName}`}>
                Edit
              </Button>
            </div>

            <div className="tc-badges">
              <Badge tone={TIER_TONE[seed.tier]}>Tier {seed.tier}</Badge>
              <Badge tone={STATUS_TONE[state.status]}>{getStatusLabel(state.status)}</Badge>
              <span className="tc-chip">Confidence: {getConfidenceShortLabel(state.confidence)}</span>
              <DoneToggle topic={t} />
            </div>

            <div className="tc-progress">
              <span className="progress-track">
                <span className="progress-fill" style={{ width: `${pct * 100}%` }} />
              </span>
              <span className="progress-text">
                {round1(state.completedHours)}/{seed.plannedHours}h
              </span>
            </div>

            <div className="tc-foot">
              <span className="tc-priority">Priority {round1(t.priority)}</span>
              {state.noteUrl ? (
                <a className="link-btn" href={state.noteUrl} target="_blank" rel="noopener noreferrer">
                  Open note
                </a>
              ) : (
                <button className="link-btn subtle" onClick={() => onEdit(seed.id)}>
                  Add note
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
