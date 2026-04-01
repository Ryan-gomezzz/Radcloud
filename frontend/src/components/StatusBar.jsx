const AGENTS = [
  { key: "discovery", label: "Discovery", color: "#4a9eff" },
  { key: "mapping", label: "Mapping", color: "#00d4aa" },
  { key: "risk", label: "Risk", color: "#f59e0b" },
  { key: "finops", label: "FinOps Intel", color: "#a855f7" },
  { key: "watchdog", label: "Watchdog", color: "#ec4899" },
];

const MESSAGES = {
  discovery: "Discovering GCP resources…",
  mapping: "Mapping to AWS equivalents…",
  risk: "Analyzing compatibility gaps…",
  finops: "Running Day-0 FinOps optimization…",
  watchdog: "Generating runbook, Watchdog plan, and IaC…",
};

export function StatusBar({ currentAgent, completedAgents, processing }) {
  const msg =
    currentAgent && MESSAGES[currentAgent]
      ? MESSAGES[currentAgent]
      : processing
        ? "Preparing analysis…"
        : "";

  return (
    <div className="rad-card space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
        Agent pipeline
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {AGENTS.map((agent, i) => {
          const isComplete = completedAgents.includes(agent.key);
          const isCurrent = currentAgent === agent.key;
          return (
            <div key={agent.key} className="flex items-center gap-2">
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-300 ${
                  isComplete
                    ? "border-[rgba(0,212,170,0.35)] bg-[rgba(0,212,170,0.12)] text-[#00d4aa]"
                    : isCurrent
                      ? "animate-pulse border-[rgba(74,158,255,0.4)] bg-[rgba(74,158,255,0.1)]"
                      : "border-[#2a2a3e] bg-[#12121a] text-[#6b7280]"
                }`}
                style={
                  isCurrent && !isComplete
                    ? { color: agent.color, boxShadow: `0 0 16px ${agent.color}22` }
                    : isComplete
                      ? {}
                      : {}
                }
              >
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: isComplete ? "#00d4aa" : isCurrent ? agent.color : "#4b5563",
                  }}
                />
                {isComplete ? "✓ " : ""}
                {agent.label}
              </div>
              {i < AGENTS.length - 1 && (
                <span className="text-[#2a2a3e] hidden sm:inline">→</span>
              )}
            </div>
          );
        })}
      </div>
      {msg && (
        <p className="text-sm text-[#4a9eff] transition-opacity duration-300" aria-live="polite">
          {msg}
        </p>
      )}
    </div>
  );
}
