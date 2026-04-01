import { useMemo, useState } from "react";

export function DataTable({
  columns,
  rows,
  getRowKey,
  emptyMessage = "No data",
}) {
  const [sort, setSort] = useState({ key: null, dir: "asc" });

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortable) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dir;
      }
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, columns, sort]);

  const toggleSort = (key) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortable) return;
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  if (!rows?.length) {
    return (
      <p className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-8 text-center text-sm text-[var(--text-muted)]">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] ${
                  col.sortable
                    ? "cursor-pointer select-none hover:text-[var(--text-body)]"
                    : ""
                }`}
                onClick={() => col.sortable && toggleSort(col.key)}
              >
                {col.label}
                {sort.key === col.key && (
                  <span className="ml-1 text-[var(--accent-primary)]">
                    {sort.dir === "asc" ? "^" : "v"}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, i) => (
            <tr
              key={getRowKey(row, i)}
              className="border-b border-[var(--border-default)] even:bg-[var(--bg-tertiary)]"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className="px-4 py-3 text-[var(--text-body)]"
                >
                  {col.render
                    ? col.render(row)
                    : String(col.accessor(row) ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
