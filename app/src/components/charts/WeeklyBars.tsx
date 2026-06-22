export interface WeekBar {
  day: string;
  planned: number; // minutes
  completed: number; // minutes
}

export function WeeklyBars({ data }: { data: WeekBar[] }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.planned, d.completed]));
  return (
    <div className="weekbars">
      <div className="weekbars-plot">
        {data.map((d, i) => (
          <div className="weekbars-col" key={i}>
            <div className="weekbars-bars">
              <span
                className="weekbars-bar planned"
                style={{ height: `${(d.planned / max) * 100}%` }}
                title={`Planned ${d.planned} min`}
              />
              <span
                className="weekbars-bar completed"
                style={{ height: `${(d.completed / max) * 100}%` }}
                title={`Completed ${d.completed} min`}
              />
            </div>
            <div className="weekbars-day">{d.day}</div>
          </div>
        ))}
      </div>
      <div className="weekbars-legend">
        <span className="legend-item">
          <span className="legend-swatch planned" /> Planned
        </span>
        <span className="legend-item">
          <span className="legend-swatch completed" /> Completed
        </span>
      </div>
    </div>
  );
}
