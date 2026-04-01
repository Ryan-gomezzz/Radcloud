const severityClass = {
  high: "bg-red-100 text-red-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-emerald-100 text-emerald-800",
};

export function RisksTab({ risks }) {
  if (!risks?.length) {
    return <p className="text-slate-500">No risks reported yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {risks.map((r, i) => (
        <li
          key={i}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${
                severityClass[r.severity?.toLowerCase?.()] ?? "bg-slate-100 text-slate-700"
              }`}
            >
              {r.severity ?? "—"}
            </span>
            <span className="font-medium text-slate-800">{r.category}</span>
          </div>
          <p className="text-sm text-slate-700">{r.description}</p>
          {r.mitigation && (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium">Mitigation:</span> {r.mitigation}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
