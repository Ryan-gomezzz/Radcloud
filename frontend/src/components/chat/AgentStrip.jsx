import {
  Search,
  ArrowRightLeft,
  AlertTriangle,
  TrendingDown,
  Eye,
} from "lucide-react";

const AGENTS = [
  { key: "discovery", label: "Discovery", Icon: Search, colorVar: "--agent-discovery" },
  { key: "mapping", label: "Mapping", Icon: ArrowRightLeft, colorVar: "--agent-mapping" },
  { key: "risk", label: "Risk", Icon: AlertTriangle, colorVar: "--agent-risk" },
  { key: "finops", label: "FinOps", Icon: TrendingDown, colorVar: "--agent-finops" },
  { key: "watchdog", label: "Watchdog", Icon: Eye, colorVar: "--agent-watchdog" },
];

export function AgentStrip({ activeKey = null, pulse = false }) {
  return (
    <div className="border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/90 px-4 py-3 backdrop-blur-sm">
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
        Five-agent pipeline
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
        {AGENTS.map((a, i) => {
          const Icon = a.Icon;
          const isActive = activeKey === a.key;
          return (
            <div key={a.key} className="flex items-center gap-2 md:gap-3">
              <div
                className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 md:px-3 ${
                  isActive
                    ? "border-[var(--accent-primary)] bg-[var(--bg-card)] shadow-[0_0_20px_var(--glow-cyan)]"
                    : "border-[var(--border-default)] bg-[var(--bg-card)]"
                } ${pulse && isActive ? "animate-pulse-soft" : ""}`}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `color-mix(in srgb, var(${a.colorVar}) 22%, transparent)`,
                    color: `var(${a.colorVar})`,
                  }}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="hidden text-xs font-medium text-[var(--text-heading)] sm:inline">
                  {a.label}
                </span>
              </div>
              {i < AGENTS.length - 1 && (
                <div
                  className="hidden h-px w-4 bg-[var(--border-hover)] sm:block md:w-6"
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
