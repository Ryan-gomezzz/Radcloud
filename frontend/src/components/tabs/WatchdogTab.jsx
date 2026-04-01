const impactClass = {
  high: "bg-red-100 text-red-800 border-red-200",
  medium: "bg-amber-100 text-amber-800 border-amber-200",
  low: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const modeClass = {
  suggested: "bg-blue-50 text-blue-700 border-blue-200",
  simulated: "bg-violet-50 text-violet-700 border-violet-200",
  executable: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const stageIcons = {
  detect: "🔍",
  evaluate: "⚖️",
  apply: "⚡",
  verify: "✅",
};

export function WatchdogTab({ watchdog }) {
  if (!watchdog) {
    return <p className="text-slate-500">No Watchdog output yet.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Headline metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Projected monthly AWS spend"
          value={`$${(watchdog.projected_monthly_aws_spend ?? 0).toLocaleString()}`}
          color="blue"
        />
        <MetricCard
          label="Projected annual savings"
          value={`$${(watchdog.projected_annual_savings ?? 0).toLocaleString()}`}
          color="emerald"
        />
        <MetricCard
          label="Watchdog status"
          value={watchdog.status === "active" ? "Active" : watchdog.status ?? "—"}
          sub={`Scans every ${watchdog.scan_frequency ?? "15m"} · ${watchdog.anomaly_threshold_pct ?? 12}% anomaly threshold`}
          color="violet"
        />
      </div>

      {/* Optimization opportunities */}
      {watchdog.optimization_opportunities?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">
            Optimization Opportunities
          </h3>
          <div className="space-y-3">
            {watchdog.optimization_opportunities.map((opp, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        impactClass[opp.impact] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {opp.impact} impact
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        modeClass[opp.auto_fix_mode] ?? "bg-slate-50 text-slate-600"
                      }`}
                    >
                      {opp.auto_fix_mode}
                    </span>
                    {opp.confidence != null && (
                      <span className="text-xs text-slate-400">
                        {Math.round(opp.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-slate-900">{opp.title}</p>
                  {opp.details && (
                    <p className="mt-1 text-sm text-slate-600">{opp.details}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-lg font-bold text-emerald-700">
                    ${(opp.estimated_monthly_savings ?? 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">/month</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-remediation pipeline */}
      {watchdog.auto_remediation_pipeline?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-600">
            Auto-Remediation Pipeline
          </h3>
          <div className="flex flex-col gap-1 sm:flex-row sm:gap-0">
            {watchdog.auto_remediation_pipeline.map((stage, i) => (
              <div key={i} className="flex flex-1 items-center">
                <div className="flex-1 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 text-center shadow-sm">
                  <div className="mb-1 text-2xl">{stageIcons[stage.stage] ?? "⚙️"}</div>
                  <p className="text-sm font-bold capitalize text-slate-900">{stage.stage}</p>
                  <p className="mt-1 text-xs leading-snug text-slate-500">{stage.description}</p>
                </div>
                {i < watchdog.auto_remediation_pipeline.length - 1 && (
                  <span className="hidden px-2 text-slate-300 sm:inline">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active agents */}
      {watchdog.active_agents?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
            Active agents
          </p>
          <div className="flex flex-wrap gap-2">
            {watchdog.active_agents.map((a) => (
              <span
                key={a}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold capitalize text-emerald-800"
              >
                ● {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub, color }) {
  const colors = {
    blue: "from-blue-50 to-white border-blue-100",
    emerald: "from-emerald-50 to-white border-emerald-100",
    violet: "from-violet-50 to-white border-violet-100",
  };
  const valueColors = {
    blue: "text-blue-900",
    emerald: "text-emerald-900",
    violet: "text-violet-900",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 shadow-sm ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${valueColors[color] ?? "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}
