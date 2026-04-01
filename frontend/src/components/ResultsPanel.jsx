import { useState } from "react";
import { AssetMapTab } from "./tabs/AssetMapTab";
import { ArchitectureTab } from "./tabs/ArchitectureTab";
import { RisksTab } from "./tabs/RisksTab";
import { FinOpsTab } from "./tabs/FinOpsTab";
import { RunbookTab } from "./tabs/RunbookTab";
import { WatchdogTab } from "./tabs/WatchdogTab";
import { IaCTab } from "./tabs/IaCTab";

const TABS = [
  { id: "assets", label: "Asset map", icon: "📦" },
  { id: "arch", label: "Architecture", icon: "🏗️" },
  { id: "risks", label: "Risks", icon: "⚠️" },
  { id: "finops", label: "FinOps plan", icon: "💰" },
  { id: "runbook", label: "Runbook", icon: "📋" },
  { id: "watchdog", label: "Watchdog", icon: "🐕" },
  { id: "iac", label: "IaC Output", icon: "🔧" },
];

export function ResultsPanel({ result }) {
  const [tab, setTab] = useState("finops");

  if (!result) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-slate-500">
        Run an analysis to see results here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-blue-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-white/80"
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {tab === "assets" && <AssetMapTab inventory={result.gcp_inventory} />}
        {tab === "arch" && (
          <ArchitectureTab
            awsMapping={result.aws_mapping}
            awsArchitecture={result.aws_architecture}
          />
        )}
        {tab === "risks" && (
          <RisksTab risks={result.risks} riskSummary={result.risk_summary} />
        )}
        {tab === "finops" && <FinOpsTab finops={result.finops} />}
        {tab === "runbook" && <RunbookTab runbook={result.runbook} />}
        {tab === "watchdog" && <WatchdogTab watchdog={result.watchdog} />}
        {tab === "iac" && <IaCTab iacBundle={result.iac_bundle} />}
      </div>
    </div>
  );
}
