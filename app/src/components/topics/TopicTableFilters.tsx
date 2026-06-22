import { useState } from "react";
import { TOPIC_STATUS_OPTIONS } from "../../data/topicOptions";

export function TopicTableFilters({
  query,
  onQuery,
  section,
  onSection,
  sectionOptions,
  tier,
  onTier,
  status,
  onStatus,
}: {
  query: string;
  onQuery: (v: string) => void;
  section: string;
  onSection: (v: string) => void;
  sectionOptions: string[];
  tier: string;
  onTier: (v: string) => void;
  status: string;
  onStatus: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="topics-toolbar">
      <div className="toolbar-top">
        <input
          className="input search"
          type="search"
          placeholder="Search topic or section"
          aria-label="Search topics"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
        <button
          className="btn filter-toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          Filters
        </button>
      </div>

      <div className={`filter-controls ${open ? "open" : ""}`}>
        <select className="select" aria-label="Section" value={section} onChange={(e) => onSection(e.target.value)}>
          <option value="all">All sections</option>
          {sectionOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="select" aria-label="Tier" value={tier} onChange={(e) => onTier(e.target.value)}>
          <option value="all">All tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <select className="select" aria-label="Status" value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {TOPIC_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
