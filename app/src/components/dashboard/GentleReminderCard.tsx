import { getDailyMotivationalMessage } from "../../data/motivationalMessages";

/**
 * A soft companion note that sits under the Exam date card in the upper grid.
 * It is intentionally NOT a metric - just a calm, supportive daily message in
 * readable body text. The wording comes from the same daily rotation as before
 * (getDailyMotivationalMessage); only its placement changed.
 */
export function GentleReminderCard() {
  const motivation = getDailyMotivationalMessage();

  return (
    <section className="panel reminder-card" aria-label="Gentle reminder">
      <span className="reminder-label">Gentle reminder</span>
      <div className="reminder-content">
        <p className="reminder-text">{motivation}</p>
      </div>
      <span className="reminder-sub">Today&rsquo;s study note</span>
    </section>
  );
}
