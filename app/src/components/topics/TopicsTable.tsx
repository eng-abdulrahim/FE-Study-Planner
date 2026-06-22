import { TopicRow } from "./TopicRow";
import type { ComputedTopic } from "../../types/planner";

export type SortKey = "topic" | "section" | "tier" | "status" | "progress";
export type SortDir = "asc" | "desc";

interface Column {
  key?: SortKey;
  label: string;
  className?: string;
}

const COLUMNS: Column[] = [
  { label: "#", className: "col-num" },
  { key: "topic", label: "Topic", className: "col-topic" },
  { key: "section", label: "Section", className: "col-section" },
  { key: "tier", label: "Tier" },
  { key: "status", label: "Status" },
  { label: "Done", className: "col-done" },
  { key: "progress", label: "Progress", className: "col-progress" },
  { label: "Notes", className: "col-notes" },
  { label: "Actions", className: "col-actions" },
];

/** Sortable keys + labels, reused by the mobile sort control. */
export const SORT_OPTIONS: { key: SortKey; label: string }[] = COLUMNS.filter(
  (c): c is Column & { key: SortKey } => Boolean(c.key),
).map((c) => ({ key: c.key, label: c.label }));

function HeadCell({
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  col: Column;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  if (!col.key) {
    return <th className={col.className}>{col.label}</th>;
  }
  const active = sortKey === col.key;
  return (
    <th className={col.className} aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
      <button className="th-sort-btn" onClick={() => onSort(col.key!)}>
        {col.label}
        <span className={`sort-ind ${active ? sortDir : ""}`} />
      </button>
    </th>
  );
}

export function TopicsTable({
  rows,
  startIndex,
  sortKey,
  sortDir,
  onSort,
  onEdit,
}: {
  rows: ComputedTopic[];
  startIndex: number;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onEdit: (id: string) => void;
}) {
  return (
    <div className="table-wrap">
      <table className="topics-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <HeadCell key={col.label} col={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => (
            <TopicRow key={t.seed.id} topic={t} index={startIndex + i + 1} onEdit={onEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
