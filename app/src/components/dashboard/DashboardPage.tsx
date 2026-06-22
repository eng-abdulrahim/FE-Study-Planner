import { usePlanner } from "../../state/PlannerContext";
import { TodayCard } from "./TodayCard";
import { ExamDateCard } from "./ExamDateCard";
import { GentleReminderCard } from "./GentleReminderCard";
import { SummaryCards } from "./SummaryCards";
import { WeeklyPlanPreview } from "./WeeklyPlanPreview";
import { ChartsSection } from "./ChartsSection";

export function DashboardPage() {
  const { state } = usePlanner();

  return (
    <div>
      <div className="content-bar">
        <p className="content-sub">Your study overview for {state.examName}.</p>
      </div>

      <div className="dash-grid">
        <div className="db-area db-today">
          <TodayCard />
        </div>
        {/* Right column stack: exam date on top, the gentle reminder fills the
            space that used to sit empty beneath it. */}
        <div className="db-area db-side">
          <ExamDateCard />
          <GentleReminderCard />
        </div>
        <div className="db-area db-summary">
          <SummaryCards />
        </div>
        <div className="db-area db-weekly">
          <WeeklyPlanPreview />
        </div>
      </div>

      <ChartsSection />
    </div>
  );
}
