const AGENTS = ["Discovery", "Mapping", "Risk", "FinOps", "Runbook"];

export function StatusBar({ currentAgent, completedAgents }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      {AGENTS.map((agent, i) => {
        const key = agent.toLowerCase();
        const isComplete = completedAgents.includes(key);
        const isCurrent = currentAgent === key;
        return (
          <div key={agent} className="flex items-center gap-2">
            <div
              className={`rounded px-3 py-1 text-sm font-medium ${
                isComplete ? "bg-emerald-100 text-emerald-800" : ""
              } ${isCurrent ? "animate-pulse bg-blue-100 text-blue-900" : ""} ${
                !isComplete && !isCurrent ? "bg-slate-100 text-slate-400" : ""
              }`}
            >
              {isComplete ? "✓ " : ""}
              {agent}
            </div>
            {i < AGENTS.length - 1 && <span className="text-slate-300">→</span>}
          </div>
        );
      })}
    </div>
  );
}
