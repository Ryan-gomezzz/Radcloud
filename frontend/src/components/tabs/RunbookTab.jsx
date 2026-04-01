import { useState } from "react";

function PhaseCard({ phase }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-900 text-sm font-bold text-white">
          {phase.phase_number}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{phase.name}</p>
          <p className="text-sm text-slate-500">{phase.duration} · {phase.steps?.length ?? 0} steps</p>
        </div>
        <span className="flex-shrink-0 text-slate-400 transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
          ▾
        </span>
      </button>

      {expanded && phase.steps?.length > 0 && (
        <div className="border-t border-slate-100">
          <div className="divide-y divide-slate-100">
            {phase.steps.map((step, i) => (
              <div key={i} className="px-5 py-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                    Step {step.step_number ?? i + 1}
                  </span>
                  {step.responsible && (
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                      {step.responsible}
                    </span>
                  )}
                  {step.estimated_hours != null && (
                    <span className="text-xs text-slate-500">
                      ~{step.estimated_hours}h
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-800">{step.action}</p>

                {(step.dependencies?.length > 0 || step.rollback || step.notes) && (
                  <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                    {step.dependencies?.length > 0 && (
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold">Depends on:</span>{" "}
                        {step.dependencies.join(", ")}
                      </p>
                    )}
                    {step.rollback && (
                      <p className="text-xs text-slate-600">
                        <span className="font-semibold text-red-700">Rollback:</span>{" "}
                        {step.rollback}
                      </p>
                    )}
                    {step.notes && (
                      <p className="text-xs text-slate-500 italic">
                        {step.notes}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RunbookTab({ runbook }) {
  if (!runbook) {
    return <p className="text-slate-500">No runbook yet.</p>;
  }

  // Handle legacy string format
  if (typeof runbook === "string") {
    return <p className="whitespace-pre-wrap text-sm text-slate-800">{runbook}</p>;
  }

  // Handle legacy array format (simple steps list)
  if (Array.isArray(runbook)) {
    return (
      <ol className="list-decimal space-y-4 pl-5 text-sm text-slate-800">
        {runbook.map((step, i) => (
          <li key={i} className="pl-1">
            <span className="font-semibold">{step.title ?? `Step ${step.step ?? i + 1}`}</span>
            {step.detail && <p className="mt-1 text-slate-600">{step.detail}</p>}
          </li>
        ))}
      </ol>
    );
  }

  // Structured runbook with phases
  const { title, estimated_total_duration, phases, rollback_plan, success_criteria } = runbook;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-slate-900">{title ?? "GCP to AWS Migration Runbook"}</h3>
        {estimated_total_duration && (
          <p className="mt-1 text-sm text-slate-600">
            Estimated duration: <span className="font-semibold text-blue-900">{estimated_total_duration}</span>
          </p>
        )}
      </div>

      {/* Phases */}
      {phases?.length > 0 && (
        <div className="space-y-3">
          {phases.map((phase, i) => (
            <PhaseCard key={i} phase={phase} />
          ))}
        </div>
      )}

      {/* Rollback plan */}
      {rollback_plan && (
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-5">
          <h4 className="mb-2 text-sm font-bold text-red-900">Rollback Plan</h4>
          <p className="text-sm leading-relaxed text-red-800">{rollback_plan}</p>
        </div>
      )}

      {/* Success criteria */}
      {success_criteria?.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5">
          <h4 className="mb-3 text-sm font-bold text-emerald-900">Success Criteria</h4>
          <ul className="space-y-2">
            {success_criteria.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                <span className="mt-0.5 flex-shrink-0 text-emerald-500">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
