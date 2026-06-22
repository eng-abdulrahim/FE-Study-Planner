import { useEffect, useMemo, useState } from "react";
import { usePlanner } from "../../state/PlannerContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { EmptyState } from "../common/EmptyState";
import { TopicTableFilters } from "./TopicTableFilters";
import { TopicsTable, SORT_OPTIONS } from "./TopicsTable";
import type { SortDir, SortKey } from "./TopicsTable";
import { TopicCards } from "./TopicCards";
import { TopicPagination } from "./TopicPagination";
import { TopicEditDrawer } from "./TopicEditDrawer";
import { STATUS_VALUES } from "../../data/topicOptions";
import type { ComputedTopic } from "../../types/planner";

function ratio(t: ComputedTopic): number {
  return t.seed.plannedHours > 0 ? t.state.completedHours / t.seed.plannedHours : 0;
}

function compare(a: ComputedTopic, b: ComputedTopic, key: SortKey): number {
  switch (key) {
    case "topic":
      return a.seed.topicName.localeCompare(b.seed.topicName);
    case "section":
      return a.seed.section.localeCompare(b.seed.section);
    case "tier":
      return a.seed.tier - b.seed.tier;
    case "status":
      return STATUS_VALUES.indexOf(a.state.status) - STATUS_VALUES.indexOf(b.state.status);
    case "progress":
      return ratio(a) - ratio(b);
  }
}

export function TopicsPage() {
  const { model } = usePlanner();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState("all");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [editingId, setEditingId] = useState<string | null>(null);
  const isCompact = useMediaQuery("(max-width: 720px)");

  const sectionOptions = useMemo(() => {
    const seen: string[] = [];
    for (const t of model.computed) if (!seen.includes(t.seed.section)) seen.push(t.seed.section);
    return seen;
  }, [model.computed]);

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = model.computed.filter((t) => {
      if (section !== "all" && t.seed.section !== section) return false;
      if (tier !== "all" && String(t.seed.tier) !== tier) return false;
      if (status !== "all" && t.state.status !== status) return false;
      if (q && !(t.seed.topicName.toLowerCase().includes(q) || t.seed.section.toLowerCase().includes(q)))
        return false;
      return true;
    });
    return filtered.sort((a, b) => {
      const base = compare(a, b, sortKey);
      const primary = sortDir === "asc" ? base : -base;
      return primary !== 0 ? primary : a.seed.rowOrder - b.seed.rowOrder;
    });
  }, [model.computed, query, section, tier, status, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [query, section, tier, status, pageSize]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "progress" ? "desc" : "asc");
    }
  };

  const onSortKey = (key: SortKey) => {
    setSortKey(key);
    setSortDir(key === "progress" ? "desc" : "asc");
  };
  const toggleSortDir = () => setSortDir((d) => (d === "asc" ? "desc" : "asc"));

  const editingTopic = editingId ? model.byId.get(editingId) : undefined;

  return (
    <div>
      <div className="content-bar">
        <p className="content-sub">
          {model.computed.length} topics. Use Edit to update a topic; changes save automatically.
        </p>
      </div>

      <div className="panel">
        <TopicTableFilters
          query={query}
          onQuery={setQuery}
          section={section}
          onSection={setSection}
          sectionOptions={sectionOptions}
          tier={tier}
          onTier={setTier}
          status={status}
          onStatus={setStatus}
        />

        {total === 0 ? (
          <EmptyState title="No topics match" description="Try clearing the search box or changing the filters." />
        ) : (
          <>
            {isCompact ? (
              <>
                <div className="topic-sort">
                  <label className="topic-sort-field">
                    <span className="field-label">Sort by</span>
                    <select
                      className="select"
                      value={sortKey}
                      aria-label="Sort topics by"
                      onChange={(e) => onSortKey(e.target.value as SortKey)}
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="btn topic-sort-dir"
                    onClick={toggleSortDir}
                    aria-label={`Sort ${sortDir === "asc" ? "ascending" : "descending"}, tap to reverse`}
                  >
                    <span className={`sort-ind ${sortDir}`} />
                    {sortDir === "asc" ? "Asc" : "Desc"}
                  </button>
                </div>
                <TopicCards rows={pageRows} startIndex={start} onEdit={setEditingId} />
              </>
            ) : (
              <TopicsTable
                rows={pageRows}
                startIndex={start}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                onEdit={setEditingId}
              />
            )}
            <TopicPagination
              page={safePage}
              pageSize={pageSize}
              total={total}
              onPage={setPage}
              onPageSize={setPageSize}
            />
          </>
        )}
      </div>

      {editingTopic && (
        <TopicEditDrawer key={editingTopic.seed.id} topic={editingTopic} onClose={() => setEditingId(null)} />
      )}
    </div>
  );
}
