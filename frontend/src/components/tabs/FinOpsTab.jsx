import { useCountUp } from "../../hooks/useCountUp";

export function FinOpsTab({ finops }) {
  const yearSave = finops?.total_first_year_savings;
  const { display: yearDisplay } = useCountUp(
    typeof yearSave === "number" ? yearSave : 0,
    1600,
    Boolean(finops && typeof yearSave === "number"),
    0,
  );

  if (!finops) {
    return <p className="text-[#6b7280]">No FinOps analysis yet.</p>;
  }

  const gcp = finops.gcp_monthly_total;
  const ond = finops.aws_monthly_ondemand;
  const opt = finops.aws_monthly_optimized;
  const obsWaste = finops.savings_vs_observation_window;

  const pctVsGcp = (a, b) => {
    if (typeof a !== "number" || typeof b !== "number" || !b) return null;
    return (((a - b) / b) * 100).toFixed(1);
  };
  const ondPct = pctVsGcp(ond, gcp);
  const savingsVsOnd =
    typeof ond === "number" && typeof opt === "number" && ond
      ? (((ond - opt) / ond) * 100).toFixed(1)
      : null;

  return (
    <div className="space-y-8">
      <div
        className="relative overflow-hidden rounded-xl border border-[rgba(0,212,170,0.25)] p-10 text-center animate-hero-number"
        style={{
          background:
            "linear-gradient(145deg, rgba(0,212,170,0.12) 0%, rgba(74,158,255,0.08) 100%)",
        }}
      >
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
          Day-0 FinOps savings
        </p>
        <p className="mt-2 text-5xl font-bold leading-none text-[#00d4aa] md:text-[56px]">
          ${yearDisplay}
          <span className="ml-2 text-xl font-semibold text-[#d1d5db] md:text-2xl">/year</span>
        </p>
        <p className="mt-4 max-w-xl mx-auto text-sm text-[#9ca3af]">
          vs. waiting for traditional 90-day observation window
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
            GCP monthly
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#f9fafb]">
            ${typeof gcp === "number" ? gcp.toLocaleString() : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
            AWS on-demand
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#f9fafb]">
            ${typeof ond === "number" ? ond.toLocaleString() : "—"}
          </p>
          {ondPct != null && (
            <p className="mt-1 text-sm text-[#ef4444]">+{ondPct}% vs GCP baseline</p>
          )}
        </div>
        <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
            AWS optimized
          </p>
          <p className="mt-2 text-2xl font-semibold text-[#f9fafb]">
            ${typeof opt === "number" ? opt.toLocaleString() : "—"}
          </p>
          {savingsVsOnd != null && (
            <p className="mt-1 text-sm text-[#00d4aa]">-{savingsVsOnd}% vs on-demand AWS</p>
          )}
        </div>
      </div>

      {finops.ri_recommendations?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#f9fafb]">RI recommendations</h3>
          <div className="overflow-x-auto rounded-lg border border-[#2a2a3e]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a3e] text-[#6b7280]">
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">On-demand / mo</th>
                  <th className="px-4 py-3">RI cost / mo</th>
                  <th className="px-4 py-3 text-[#00d4aa]">Annual savings</th>
                </tr>
              </thead>
              <tbody>
                {finops.ri_recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-[#2a2a3e]/80">
                    <td className="px-4 py-3 font-medium text-[#e5e7eb]">
                      {r.aws_service} · {r.instance_type} ×{r.quantity ?? 1}
                    </td>
                    <td className="px-4 py-3 text-[#d1d5db]">
                      ${r.monthly_ondemand_cost?.toLocaleString?.() ?? r.monthly_ondemand_cost}
                    </td>
                    <td className="px-4 py-3 text-[#d1d5db]">
                      ${r.monthly_ri_cost?.toLocaleString?.() ?? r.monthly_ri_cost}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#00d4aa]">
                      ${r.annual_savings?.toLocaleString?.() ?? r.annual_savings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div
        className="rounded-xl border border-[rgba(245,158,11,0.35)] p-5"
        style={{ background: "rgba(245, 158, 11, 0.08)" }}
      >
        <p className="text-sm font-semibold text-[#f59e0b]">Observation window warning</p>
        <p className="mt-2 text-sm leading-relaxed text-[#d1d5db]">
          Traditional FinOps tools require 90 days. You&apos;d waste{" "}
          <span className="font-semibold text-[#f59e0b]">
            ${typeof obsWaste === "number" ? obsWaste.toLocaleString() : obsWaste ?? "—"}
          </span>{" "}
          waiting while identical optimization signals already exist in your billing + config data.
        </p>
      </div>

      {finops.cost_comparison?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#f9fafb]">Monthly cost comparison</h3>
          <div className="overflow-x-auto rounded-lg border border-[#2a2a3e]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a3e] text-[#6b7280]">
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2">GCP</th>
                  <th className="px-4 py-2">AWS on-demand</th>
                  <th className="px-4 py-2 text-[#00d4aa]">AWS optimized</th>
                </tr>
              </thead>
              <tbody>
                {finops.cost_comparison.map((row, i) => (
                  <tr key={i} className="border-b border-[#2a2a3e]/60">
                    <td className="px-4 py-2">{row.month}</td>
                    <td className="px-4 py-2">${row.gcp_cost?.toLocaleString?.() ?? row.gcp_cost}</td>
                    <td className="px-4 py-2">
                      ${row.aws_ondemand?.toLocaleString?.() ?? row.aws_ondemand}
                    </td>
                    <td className="px-4 py-2 text-[#00d4aa]">
                      ${row.aws_optimized?.toLocaleString?.() ?? row.aws_optimized}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {finops.usage_patterns?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#f9fafb]">Usage patterns</h3>
          <ul className="space-y-2 text-sm text-[#d1d5db]">
            {finops.usage_patterns.map((u, i) => (
              <li
                key={i}
                className="rounded-lg border border-[#2a2a3e] bg-[#12121a] px-4 py-3"
              >
                <span className="font-medium text-[#f9fafb]">{u.gcp_service}</span> —{" "}
                {u.pattern} · ${u.avg_monthly_cost?.toLocaleString?.() ?? u.avg_monthly_cost}/mo ·{" "}
                <span className="text-[#4a9eff]">{u.recommendation}</span>
                {u.description && (
                  <span className="mt-1 block text-[#9ca3af]">{u.description}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {finops.summary && (
        <p className="text-sm leading-relaxed text-[#9ca3af]">{finops.summary}</p>
      )}
    </div>
  );
}
