import { ProductLogo } from "./ProductLogo";

/**
 * Visual panel for auth screens — evokes architecture flow without emoji.
 */
export function VisualBrandPanel() {
  return (
    <div className="relative hidden h-full min-h-[520px] flex-col justify-between overflow-hidden rounded-2xl border border-[var(--border-default)] bg-[var(--bg-secondary)] p-8 lg:flex">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 40%, var(--glow-cyan), transparent), radial-gradient(ellipse 60% 40% at 80% 60%, var(--glow-violet), transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border-default) 1px, transparent 1px), linear-gradient(to bottom, var(--border-default) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10">
        <div className="mb-5">
          <ProductLogo heightClass="h-16 sm:h-20" />
        </div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
          Architecture
        </p>
        <h2 className="font-display mt-2 text-3xl font-bold tracking-tight text-[var(--text-heading)]">
          Multi-agent intelligence
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--text-muted)]">
          Inputs flow through five specialized agents to produce migration runbooks,
          Terraform, and Day-0 FinOps — the same pipeline you run in this console.
        </p>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center py-6">
        <svg
          viewBox="0 0 400 200"
          className="h-auto w-full max-w-md text-[var(--text-muted)]"
          aria-hidden
        >
          <defs>
            <linearGradient id="flowLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
              <stop offset="50%" stopColor="var(--accent-secondary)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--accent-violet)" stopOpacity="0.2" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <line
            x1="40"
            y1="100"
            x2="360"
            y2="100"
            stroke="url(#flowLine)"
            strokeWidth="3"
            strokeLinecap="round"
          />

          <g filter="url(#glow)">
            <rect
              x="24"
              y="72"
              width="56"
              height="56"
              rx="12"
              fill="var(--bg-card)"
              stroke="var(--accent-primary)"
              strokeWidth="1.5"
            />
            <text
              x="52"
              y="108"
              textAnchor="middle"
              fill="var(--text-heading)"
              fontSize="10"
              fontWeight="700"
            >
              IN
            </text>
          </g>

          {[
            { x: 108, label: "1", color: "var(--agent-discovery)" },
            { x: 156, label: "2", color: "var(--agent-mapping)" },
            { x: 204, label: "3", color: "var(--agent-risk)" },
            { x: 252, label: "4", color: "var(--agent-finops)" },
            { x: 300, label: "5", color: "var(--agent-watchdog)" },
          ].map((node) => (
            <g key={node.x}>
              <circle
                cx={node.x}
                cy="100"
                r="14"
                fill="var(--bg-primary)"
                stroke={node.color}
                strokeWidth="2"
              />
              <text
                x={node.x}
                y="105"
                textAnchor="middle"
                fill="var(--text-heading)"
                fontSize="11"
                fontWeight="700"
              >
                {node.label}
              </text>
            </g>
          ))}

          <g filter="url(#glow)">
            <rect
              x="320"
              y="72"
              width="56"
              height="56"
              rx="12"
              fill="var(--bg-card)"
              stroke="var(--accent-violet)"
              strokeWidth="1.5"
            />
            <text
              x="348"
              y="108"
              textAnchor="middle"
              fill="var(--text-heading)"
              fontSize="10"
              fontWeight="700"
            >
              OUT
            </text>
          </g>

          <text
            x="200"
            y="168"
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize="11"
            letterSpacing="0.08em"
          >
            DISCOVERY TO WATCHDOG PIPELINE
          </text>
        </svg>
      </div>

      <div className="relative z-10 flex gap-3 border-t border-[var(--border-default)] pt-6">
        <div className="flex-1 rounded-lg bg-[var(--bg-card)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-secondary)]">
            Inputs
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Terraform, billing, context
          </p>
        </div>
        <div className="flex-1 rounded-lg bg-[var(--bg-card)] px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent-violet)]">
            Outputs
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            IaC, runbook, FinOps
          </p>
        </div>
      </div>
    </div>
  );
}
