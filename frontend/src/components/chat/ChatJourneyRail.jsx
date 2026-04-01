import { Check } from "lucide-react";

const STEPS = [
  { id: "goal", label: "Goal" },
  { id: "aws", label: "AWS footprint" },
  { id: "config", label: "Infrastructure" },
  { id: "billing", label: "Billing" },
  { id: "review", label: "Review" },
  { id: "analysis", label: "Analysis" },
];

function phaseToStepIndex(phase) {
  if (phase === "welcome") return 0;
  if (phase === "aws") return 1;
  if (phase === "config_choice" || phase === "config_paste") return 2;
  if (phase === "billing") return 3;
  if (phase === "confirm") return 4;
  if (phase === "running" || phase === "results") return 5;
  return 0;
}

export function ChatJourneyRail({ phase }) {
  const active = phaseToStepIndex(phase);

  return (
    <aside className="hidden w-[200px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-secondary)]/80 py-6 pl-4 pr-3 lg:flex">
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
        Your path
      </p>
      <ol className="flex flex-col gap-0">
        {STEPS.map((step, i) => {
          const done = i < active;
          const current = i === active;
          return (
            <li key={step.id} className="relative flex gap-3 pb-5 last:pb-0">
              {i < STEPS.length - 1 && (
                <div
                  className="absolute left-[15px] top-8 h-[calc(100%-8px)] w-px bg-[var(--border-default)]"
                  aria-hidden
                />
              )}
              <div
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                  done
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--logo-fg)]"
                    : current
                      ? "border-[var(--accent-secondary)] bg-[var(--bg-card)] text-[var(--accent-primary)] shadow-[0_0_0_4px_var(--glow-cyan)]"
                      : "border-[var(--border-default)] bg-[var(--bg-card)] text-[var(--text-faint)]"
                }`}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : i + 1}
              </div>
              <div className="min-w-0 pt-1">
                <p
                  className={`text-sm font-semibold leading-tight ${
                    current || done
                      ? "text-[var(--text-heading)]"
                      : "text-[var(--text-muted)]"
                  }`}
                >
                  {step.label}
                </p>
                {current && (
                  <p className="mt-0.5 text-[11px] text-[var(--accent-primary)] animate-pulse-soft">
                    In progress
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
