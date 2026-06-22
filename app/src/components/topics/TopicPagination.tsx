const PAGE_SIZES = [10, 25, 50];

export function TopicPagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize;
  const end = Math.min(start + pageSize, total);

  return (
    <div className="pagination">
      <div className="pg-info">
        Showing {total === 0 ? 0 : start + 1}&ndash;{end} of {total} topics
      </div>
      <div className="pg-right">
        <label className="pg-size">
          Rows per page
          <select
            className="select"
            value={pageSize}
            aria-label="Rows per page"
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="pg-controls">
          <button className="btn btn-sm pg-edge" disabled={page <= 1} onClick={() => onPage(1)}>
            First
          </button>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Prev
          </button>
          <span className="pg-current">
            Page {page} of {totalPages}
          </span>
          <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
            Next
          </button>
          <button className="btn btn-sm pg-edge" disabled={page >= totalPages} onClick={() => onPage(totalPages)}>
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
