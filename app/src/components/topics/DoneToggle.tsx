import { usePlanner } from "../../state/PlannerContext";
import type { ComputedTopic } from "../../types/planner";

/**
 * Reversible Done control for a topic. Marking Done sets status "done"; toggling
 * it off reopens the topic (back into planning eligibility) AND clears any weekly
 * "done" blocks for it, so the weekly plan and this table never disagree.
 * Persists + triggers the debounced cloud auto-save through the normal actions.
 */
export function DoneToggle({ topic }: { topic: ComputedTopic }) {
  const { actions } = usePlanner();
  const isDone = topic.state.status === "done";

  const toggle = () => {
    if (isDone) actions.reopenTopic(topic.seed.id);
    else actions.markDone(topic.seed.id);
  };

  return (
    <button
      type="button"
      aria-pressed={isDone}
      className={`done-pill ${isDone ? "on" : ""}`}
      aria-label={isDone ? `Mark ${topic.seed.topicName} not done` : `Mark ${topic.seed.topicName} done`}
      title={isDone ? "Done - tap to reopen" : "Mark done"}
      onClick={toggle}
    >
      {isDone ? "Done" : "Mark done"}
    </button>
  );
}
