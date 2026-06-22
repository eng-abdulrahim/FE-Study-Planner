import { usePlanner } from "../../state/PlannerContext";
import { Donut } from "../charts/Donut";
import { BarList } from "../charts/BarList";
import type { BarItem } from "../charts/BarList";
import { WeeklyBars } from "../charts/WeeklyBars";
import { STATUS_VALUES } from "../../data/topicOptions";
import { STATUS_TONE, TIER_TONE, getStatusLabel } from "../../lib/labels";
import { formatPercent } from "../../lib/util";
import type { Tier } from "../../types/planner";

export function ChartsSection() {
  const { model, state } = usePlanner();

  const statusItems: BarItem[] = STATUS_VALUES.map((s) => ({
    key: s,
    label: getStatusLabel(s),
    value: model.statusDistribution[s],
    tone: STATUS_TONE[s],
  })).filter((i) => i.value > 0);

  const tierItems: BarItem[] = ([1, 2, 3] as Tier[]).map((t) => ({
    key: `tier-${t}`,
    label: `Tier ${t}`,
    value: model.tierDistribution[t],
    tone: TIER_TONE[t],
  }));

  const weekData = model.weekStudyPlans.map((d) => ({
    day: d.dayName.slice(0, 3),
    planned: d.totalPlannedMinutes,
    completed: state.studyLog
      .filter((e) => e.date === d.date)
      .reduce((s, e) => s + e.minutes, 0),
  }));

  // Section coverage: done vs total planned topics per section. Sorted by most
  // remaining work first, so the sections that still need attention sit on top.
  const sectionAgg = new Map<string, { total: number; done: number }>();
  for (const t of model.computed) {
    if (t.state.include === "No") continue;
    const cur = sectionAgg.get(t.seed.section) ?? { total: 0, done: 0 };
    cur.total += 1;
    if (t.state.status === "done") cur.done += 1;
    sectionAgg.set(t.seed.section, cur);
  }
  const sectionItems: BarItem[] = [...sectionAgg.entries()]
    .map(([name, { total, done }]) => ({
      name,
      total,
      done,
      pct: total > 0 ? Math.round((done / total) * 100) : 0,
    }))
    .sort(
      (a, b) =>
        b.total - b.done - (a.total - a.done) || b.total - a.total || a.name.localeCompare(b.name),
    )
    .map((s) => ({
      key: s.name,
      label: s.name,
      value: s.pct,
      tone: s.pct >= 100 ? "success" : "primary",
      valueLabel: `${s.done} / ${s.total}`,
    }));

  return (
    <section className="charts">
      <h3 className="charts-title">Charts</h3>
      <div className="charts-grid">
        <div className="panel chart-card chart-progress">
          <h4 className="chart-head">Overall progress</h4>
          <Donut
            value={model.progressPct}
            centerLabel={formatPercent(model.progressPct)}
            sublabel="hours done"
          />
        </div>

        <div className="panel chart-card">
          <h4 className="chart-head">Status distribution</h4>
          <BarList items={statusItems} />
        </div>

        <div className="panel chart-card">
          <h4 className="chart-head">Tier distribution</h4>
          <BarList items={tierItems} />
        </div>

        <div className="panel chart-card">
          <h4 className="chart-head">Section coverage</h4>
          {sectionItems.length === 0 ? (
            <p className="muted chart-empty">No sections in your plan yet.</p>
          ) : (
            <div className="chart-scroll section-coverage">
              <BarList items={sectionItems} max={100} />
            </div>
          )}
        </div>

        <div className="panel chart-card span-2">
          <h4 className="chart-head">Weekly minutes: planned vs completed</h4>
          <WeeklyBars data={weekData} />
        </div>
      </div>
    </section>
  );
}
