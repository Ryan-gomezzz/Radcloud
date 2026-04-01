const severityStyles = {
  high: "bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.3)]",
  medium: "bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]",
  low: "bg-[rgba(0,212,170,0.15)] text-[#00d4aa] border-[rgba(0,212,170,0.3)]",
};

const order = { high: 0, medium: 1, low: 2 };

export function RisksTab({ risks, riskSummary }) {
  if (!risks?.length) {
    return <p className="text-[#6b7280]">No risks reported yet.</p>;
  }

  const sorted = [...risks].sort(
    (a, b) =>
      (order[(a.severity || "").toLowerCase()] ?? 3) -
      (order[(b.severity || "").toLowerCase()] ?? 3),
  );

  const rs = riskSummary || {};

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total risks", value: rs.total_risks, bg: "rgba(74,158,255,0.1)", c: "#4a9eff" },
          { label: "High", value: rs.high, bg: "rgba(239,68,68,0.1)", c: "#ef4444" },
          { label: "Medium", value: rs.medium, bg: "rgba(245,158,11,0.1)", c: "#f59e0b" },
          { label: "Low", value: rs.low, bg: "rgba(0,212,170,0.1)", c: "#00d4aa" },
        ].map((x) => (
          <div
            key={x.label}
            className="rounded-lg border border-[#2a2a3e] p-4"
            style={{ background: x.bg }}
          >
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
              {x.label}
            </p>
            <p className="mt-2 text-3xl font-bold" style={{ color: x.c }}>
              {x.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {rs.overall_assessment && (
        <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-5">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
            Overall assessment
          </p>
          <p className="mt-2 text-sm leading-relaxed text-[#d1d5db]">{rs.overall_assessment}</p>
          {rs.top_risk && (
            <p className="mt-3 text-sm text-[#f59e0b]">
              <span className="font-semibold">Top risk:</span> {rs.top_risk}
            </p>
          )}
        </div>
      )}

      <ul className="space-y-4">
        {sorted.map((r, idx) => {
          const sev = (r.severity || "").toLowerCase();
          const badge = severityStyles[sev] || "bg-[#2a2a3e] text-[#d1d5db] border-[#3a3a5e]";
          const glow =
            sev === "high"
              ? "hover:shadow-[0_0_20px_rgba(239,68,68,0.15)]"
              : sev === "medium"
                ? "hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]"
                : "hover:shadow-[0_0_20px_rgba(0,212,170,0.12)]";
          return (
            <li
              key={r.id || r.title || `risk-${idx}`}
              className={`rounded-xl border border-[#2a2a3e] bg-[#16161f] p-5 transition-all ${glow}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-md border px-2 py-0.5 text-xs font-semibold uppercase ${badge}`}>
                  {r.severity ?? "—"}
                </span>
                {r.category && (
                  <span className="text-xs uppercase tracking-wide text-[#6b7280]">{r.category}</span>
                )}
                {r.estimated_effort_days != null && (
                  <span className="ml-auto rounded-md border border-[#2a2a3e] px-2 py-0.5 text-xs text-[#9ca3af]">
                    ~{r.estimated_effort_days} days
                  </span>
                )}
              </div>
              <h4 className="mt-3 text-lg font-semibold text-[#f9fafb]">{r.title || r.category}</h4>
              <p className="mt-2 text-sm leading-relaxed text-[#d1d5db]">{r.description}</p>
              {r.affected_resources?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.affected_resources.map((ar) => (
                    <span
                      key={ar}
                      className="rounded-md bg-[#12121a] px-2 py-1 text-xs text-[#9ca3af]"
                    >
                      {ar}
                    </span>
                  ))}
                </div>
              )}
              {r.aws_alternative && (
                <p className="mt-3 text-sm text-[#4a9eff]">
                  <span className="font-medium">AWS alternative:</span> {r.aws_alternative}
                </p>
              )}
              {r.migration_impact && (
                <p className="mt-2 text-sm text-[#9ca3af]">
                  <span className="font-medium text-[#d1d5db]">Impact:</span> {r.migration_impact}
                </p>
              )}
              {r.mitigation && (
                <p className="mt-3 rounded-lg border border-[#2a2a3e] bg-[#12121a] p-3 text-sm text-[#9ca3af]">
                  <span className="font-medium text-[#00d4aa]">Mitigation:</span> {r.mitigation}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
