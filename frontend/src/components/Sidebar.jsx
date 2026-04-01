import { NavLink, useNavigate } from "react-router-dom";
import { ProductLogo } from "./ProductLogo";
import {
  LayoutDashboard,
  ArrowRightLeft,
  TrendingDown,
  Eye,
  ListChecks,
  Code,
  PlusCircle,
} from "lucide-react";
import { useAnalysisStore } from "../stores/analysisStore";

const navItems = [
  { path: "/app/dashboard", end: true, label: "Overview", icon: LayoutDashboard },
  { path: "/app/dashboard/migration", label: "Migration", icon: ArrowRightLeft },
  { path: "/app/dashboard/finops", label: "FinOps", icon: TrendingDown },
  { path: "/app/dashboard/watchdog", label: "Watchdog", icon: Eye },
  { path: "/app/dashboard/runbook", label: "Runbook", icon: ListChecks },
  { path: "/app/dashboard/iac", label: "IaC Output", icon: Code },
];

export function Sidebar() {
  const navigate = useNavigate();
  const resetForNewAnalysis = useAnalysisStore((s) => s.resetForNewAnalysis);

  const handleNewAnalysis = () => {
    resetForNewAnalysis();
    navigate("/app/onboarding");
  };

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-[var(--border-default)] bg-[var(--bg-secondary)]/95 backdrop-blur-sm">
      <div className="border-b border-[var(--border-default)] px-3 py-4">
        <NavLink
          to="/app/dashboard"
          aria-label="RADCloud — Overview"
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-secondary)]"
        >
          <ProductLogo heightClass="h-8" decorative />
        </NavLink>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-3">
        {navItems.map((item) => {
          const NavIcon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "border-l-2 border-[var(--accent-primary)] bg-[var(--bg-tertiary)] pl-[10px] text-[var(--accent-primary)]"
                    : "border-l-2 border-transparent pl-3 text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-body)]",
                ].join(" ")
              }
            >
              <NavIcon className="size-[18px] shrink-0" aria-hidden />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border-default)] p-3">
        <button
          type="button"
          onClick={handleNewAnalysis}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-default)] py-2.5 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
        >
          <PlusCircle className="size-4" aria-hidden />
          New analysis
        </button>
      </div>
    </aside>
  );
}
