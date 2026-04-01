import { useState } from "react";

export function RunbookTab({ runbook }) {
  if (!runbook) {
    return <p className="text-[#6b7280]">No runbook yet.</p>;
  }

  if (typeof runbook === "string") {
    return <p className="whitespace-pre-wrap text-sm text-[#d1d5db]">{runbook}</p>;
  }

  if (Array.isArray(runbook) && runbook.length > 0) {
    return (
      <ol className="list-decimal space-y-4 pl-5 text-sm text-[#d1d5db]">
        {runbook.map((step, i) => (
          <li key={i} className="pl-1">
            <span className="font-semibold text-[#f9fafb]">
              {step.title ?? `Step ${step.step ?? i + 1}`}
            </span>
            {step.detail && <p className="mt-1 text-[#9ca3af]">{step.detail}</p>}
          </li>
        ))}
      </ol>
    );
  }

  const phases = runbook.phases;
  if (!phases?.length) {
    return <p className="text-[#6b7280]">No runbook phases.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-[#f9fafb]">{runbook.title}</h3>
        {runbook.estimated_total_duration && (
          <p className="mt-2 text-sm text-[#6b7280]">
            Estimated duration:{" "}
            <span className="text-[#00d4aa]">{runbook.estimated_total_duration}</span>
          </p>
        )}
      </div>

      <div className="relative space-y-4 border-l border-[#2a2a3e] pl-6">
        {phases.map((phase, idx) => (
          <PhaseBlock key={phase.phase_number ?? idx} phase={phase} defaultOpen={idx === 0} />
        ))}
      </div>

      {runbook.rollback_plan && (
        <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
            Rollback plan
          </p>
          <p className="mt-2 text-sm text-[#d1d5db]">{runbook.rollback_plan}</p>
        </div>
      )}

      {runbook.success_criteria?.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-semibold text-[#f9fafb]">Success criteria</h4>
          <ul className="space-y-2">
            {runbook.success_criteria.map((c, i) => (
              <li
                key={i}
                className="flex gap-2 text-sm text-[#d1d5db]"
              >
                <span className="text-[#00d4aa]">✓</span>
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PhaseBlock({ phase, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const steps = phase.steps || [];

  return (
    <div className="relative">
      <span className="absolute -left-[29px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-[#00d4aa] bg-[#0a0a0f] text-[10px] text-[#00d4aa]">
        {phase.phase_number ?? "•"}
      </span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-[#2a2a3e] bg-[#16161f] px-4 py-3 text-left transition-colors hover:border-[#3a3a5e]"
      >
        <div>
          <p className="font-semibold text-[#f9fafb]">{phase.name}</p>
          <p className="text-xs text-[#6b7280]">
            {phase.duration} · {steps.length} steps
          </p>
        </div>
        <span className="text-[#6b7280]">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="mt-3 space-y-3 pl-2">
          {steps.map((s) => (
            <li
              key={s.step_number}
              className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4 text-sm"
            >
              <p className="font-medium text-[#4a9eff]">
                Step {s.step_number}: {s.action}
              </p>
              <p className="mt-2 text-[#9ca3af]">
                <span className="text-[#6b7280]">Responsible:</span> {s.responsible}
              </p>
              <p className="mt-1 text-[#9ca3af]">
                <span className="text-[#6b7280]">Est. hours:</span> {s.estimated_hours ?? "—"}
              </p>
              {s.dependencies?.length > 0 && (
                <p className="mt-1 text-xs text-[#6b7280]">
                  Dependencies: {s.dependencies.join(", ")}
                </p>
              )}
              {s.rollback && (
                <p className="mt-2 rounded border border-[#2a2a3e] bg-[#0a0a0f] p-2 text-xs text-[#f59e0b]">
                  Rollback: {s.rollback}
                </p>
              )}
              {s.notes && <p className="mt-2 text-xs text-[#6b7280]">Note: {s.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
