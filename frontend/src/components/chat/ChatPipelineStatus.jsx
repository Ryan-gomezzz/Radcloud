import { Check, Loader2, ChevronRight } from "lucide-react";

export function ChatPipelineStatus({ agents, currentMessage }) {
  return (
    <div className="ml-11 rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        Analysis pipeline
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {agents.map((agent, i) => (
          <div key={agent.name} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-medium ${
                agent.status === "complete"
                  ? "border-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent-primary)_12%,transparent)] text-[var(--accent-primary)]"
                  : ""
              } ${
                agent.status === "running"
                  ? "animate-pulse border-[color-mix(in_srgb,var(--accent-secondary)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent-secondary)_12%,transparent)] text-[var(--accent-secondary)]"
                  : ""
              } ${
                agent.status === "pending"
                  ? "border-[var(--border-default)] bg-[var(--bg-secondary)] text-[var(--text-faint)]"
                  : ""
              }`}
            >
              {agent.status === "complete" && (
                <Check className="size-3 shrink-0" aria-hidden />
              )}
              {agent.status === "running" && (
                <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden />
              )}
              {agent.name}
            </div>
            {i < agents.length - 1 && (
              <ChevronRight className="size-3.5 text-[var(--text-faint)]" aria-hidden />
            )}
          </div>
        ))}
      </div>
      {currentMessage && (
        <p className="mt-3 text-[13px] text-[var(--accent-secondary)]">{currentMessage}</p>
      )}
    </div>
  );
}
