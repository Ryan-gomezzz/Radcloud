export function FinOpsTab({ finops }) {
  if (!finops) return <p className="text-slate-500">No FinOps analysis yet.</p>;

  const savings = finops.total_first_year_savings;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-emerald-700">Day-0 FinOps savings</p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-emerald-900 md:text-5xl">
          {typeof savings === "number"
            ? `$${savings.toLocaleString()}`
            : "—"}
        </p>
        <p className="mt-3 text-sm text-emerald-700">
          Estimated first-year savings vs. waiting for a traditional FinOps observation period.
        </p>
      </div>

      {finops.summary && (
        <p className="text-sm leading-relaxed text-slate-700">{finops.summary}</p>
      )}

      {finops.cost_comparison?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Cost comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="py-2 pr-4">Line</th>
                  <th className="py-2 pr-4">GCP (est.)</th>
                  <th className="py-2">AWS (est.)</th>
                </tr>
              </thead>
              <tbody>
                {finops.cost_comparison.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium">{row.line}</td>
                    <td className="py-2 pr-4">
                      ${typeof row.gcp_estimate === "number" ? row.gcp_estimate.toLocaleString() : row.gcp_estimate}
                    </td>
                    <td className="py-2">
                      ${typeof row.aws_estimate === "number" ? row.aws_estimate.toLocaleString() : row.aws_estimate}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {finops.ri_recommendations?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">RI recommendations</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
            {finops.ri_recommendations.map((r, i) => (
              <li key={i}>
                {r.service}: {r.coverage_pct}% coverage · {r.term}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
