import { useEffect, useState } from "react";
import { usePlanner } from "../../state/PlannerContext";
import { Button } from "../common/Button";
import { CONFIDENCE_OPTIONS, TOPIC_STATUS_OPTIONS } from "../../data/topicOptions";
import { isValidNoteUrl } from "../../lib/validation";
import type { ComputedTopic, TopicStatus } from "../../types/planner";

export function TopicEditDrawer({ topic, onClose }: { topic: ComputedTopic; onClose: () => void }) {
  const { actions } = usePlanner();
  const { seed, state } = topic;

  const [status, setStatus] = useState<TopicStatus>(state.status);
  const [confidence, setConfidence] = useState<number>(state.confidence);
  const [completed, setCompleted] = useState<string>(String(state.completedHours));
  const [noteUrl, setNoteUrl] = useState<string>(state.noteUrl);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const noteValid = isValidNoteUrl(noteUrl);

  const save = () => {
    if (!noteValid) return;
    const completedNum = Number(completed);
    actions.updateTopic(seed.id, {
      status,
      confidence,
      completedHours: Number.isFinite(completedNum) ? Math.max(0, completedNum) : 0,
    });
    actions.setNoteUrl(seed.id, noteUrl.trim());
    onClose();
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${seed.topicName}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <div>
            <span className="eyebrow">Edit topic</span>
            <h3>{seed.topicName}</h3>
          </div>
          <button className="drawer-close" aria-label="Close" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer-body">
          <div className="info-grid">
            <div className="info">
              <span className="field-label">Section</span>
              <span>{seed.section}</span>
            </div>
            <div className="info">
              <span className="field-label">Tier</span>
              <span>Tier {seed.tier}</span>
            </div>
            <div className="info">
              <span className="field-label">Planned hours</span>
              <span>{seed.plannedHours}h</span>
            </div>
          </div>

          <label className="form-row">
            <span className="field-label">Status</span>
            <select className="select" value={status} onChange={(e) => setStatus(e.target.value as TopicStatus)}>
              {TOPIC_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span className="field-label">Confidence</span>
            <select className="select" value={confidence} onChange={(e) => setConfidence(Number(e.target.value))}>
              {CONFIDENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="form-row">
            <span className="field-label">Completed hours</span>
            <input
              className="input"
              type="number"
              min={0}
              step={0.5}
              value={completed}
              onChange={(e) => setCompleted(e.target.value)}
            />
          </label>

          <label className="form-row">
            <span className="field-label">Note URL</span>
            <input
              className={`input ${noteValid ? "" : "invalid"}`}
              type="url"
              inputMode="url"
              placeholder="https://..."
              value={noteUrl}
              onChange={(e) => setNoteUrl(e.target.value)}
            />
            {!noteValid && <span className="help-text error">Enter a valid http(s) link or leave it empty.</span>}
          </label>
        </div>

        <div className="drawer-foot">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!noteValid} onClick={save}>
            Save
          </Button>
        </div>
      </aside>
    </div>
  );
}
