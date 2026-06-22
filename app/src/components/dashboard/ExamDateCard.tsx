import { usePlanner } from "../../state/PlannerContext";
import { Badge } from "../common/Badge";
import { formatDisplayDate, isExamPassed, isExamToday } from "../../lib/dateUtils";

export function ExamDateCard() {
  const { state, model, actions } = usePlanner();
  const examDate = state.examDate;
  const passed = isExamPassed(examDate);
  const today = isExamToday(examDate);
  const reviewPhase = model.reviewPhase && !passed && !today;

  const status = passed
    ? "Exam date has passed. Update the exam date."
    : today
      ? "Exam is today."
      : `${model.pacing.daysRemaining} days remaining`;

  return (
    <section className="panel exam-card">
      <div className="panel-head">
        <h3>Exam date</h3>
        {reviewPhase ? <Badge tone="warning">Final review phase</Badge> : null}
      </div>
      <div className="exam-body">
        <div className="exam-display">
          <span className="exam-date-text">{formatDisplayDate(examDate)}</span>
          <span className={`exam-status ${passed ? "is-passed" : ""}`}>{status}</span>
        </div>
        <label className="exam-edit">
          <span className="field-label">Change exam date</span>
          <input
            className="input"
            type="date"
            value={examDate}
            onChange={(e) => e.target.value && actions.setExamDate(e.target.value)}
          />
        </label>
      </div>
    </section>
  );
}
