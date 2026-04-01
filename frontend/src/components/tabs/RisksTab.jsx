import { useState } from "react";

const severityClass = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const severityDot = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

function RiskCard({ risk, index }) {
  const [expanded, setExpanded] = useState(false);
  const sev = risk.severity?.toLowerCase?.() ?? "medium";

  return (
    <li className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <div className="mt-0.5 flex-shrink-0">
          <span
            className={`inline-block h-3 w-3 rounded-full ${severityDot[sev] ?? "bg-slate-400"}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-slate-400">{risk.id ?? `#${index + 1}`}</span>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                severityClass[sev] ?? "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {risk.severity ?? "—"}
            </span>
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {risk.category?.replace(/_/g, " ") ?? "general"}
            </span>
          </div>
          <p className="font-semibold text-slate-900">{risk.title ?? risk.description}</p>
          {risk.title && risk.description && (
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{risk.description}</p>
          )}
        </div>
        <span className="mt-1 flex-shrink-0 text-slate-400 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 pb-5 pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {risk.affected_resources?.length > 0 && (
              <Detail label="Affected resources">
                <div className="flex flex-wrap gap-1.5">
                  {risk.affected_resources.map((r, i) => (
                    <span key={i} className="rounded-md bg-slate-200/70 px-2 py-0.5 font-mono text-xs text-slate-700">
                      {r}
                    </span>
                  ))}
                </div>
              </Detail>
            )}
            {risk.aws_alternative && (
              <Detail label="AWS alternative">
                <span className="text-sm text-slate-700">{risk.aws_alternative}</span>
              </Detail>
            )}
            {risk.migration_impact && (
              <Detail label="Migration impact" full>
                <span className="text-sm text-slate-700">{risk.migration_impact}</span>
              </Detail>
            )}
            {risk.mitigation && (
              <Detail label="Mitigation" full>
                <span className="text-sm text-emerald-800">{risk.mitigation}</span>
              </Detail>
            )}
            {risk.estimated_effort_days != null && (
              <Detail label="Estimated effort">
                <span className="text-sm font-semibold text-slate-800">
                  {risk.estimated_effort_days} day{risk.estimated_effort_days !== 1 ? "s" : ""}
                </span>
              </Detail>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function Detail({ label, children, full }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {children}
    </div>
  );
}

export function RisksTab({ risks, riskSummary }) {
  if (!risks?.length) {
    return <p className="text-slate-500">No risks reported yet.</p>;
  }

  const summary = riskSummary;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      {summary && (
        <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold text-slate-900">{summary.total_risks}</p>
              <p className="text-xs font-medium text-slate-500">Total risks</p>
            </div>
            <div className="flex gap-3">
              {summary.high > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-red-800">{summary.high} high</span>
                </div>
              )}
              {summary.medium > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span className="text-sm font-semibold text-amber-800">{summary.medium} medium</span>
                </div>
              )}
              {summary.low > 0 && (
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-semibold text-emerald-800">{summary.low} low</span>
                </div>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{summary.overall_assessment}</p>
        </div>
      )}

      {/* Risk cards */}
      <ul className="space-y-3">
        {risks.map((r, i) => (
          <RiskCard key={r.id ?? i} risk={r} index={i} />
        ))}
      </ul>
    </div>
  );
}
