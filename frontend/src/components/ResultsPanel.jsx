import { useState } from "react";
import { AssetMapTab } from "./tabs/AssetMapTab";
import { ArchitectureTab } from "./tabs/ArchitectureTab";
import { RisksTab } from "./tabs/RisksTab";
import { FinOpsTab } from "./tabs/FinOpsTab";
import { RunbookTab } from "./tabs/RunbookTab";
import { WatchdogTab } from "./tabs/WatchdogTab";
import { IaCOutputTab } from "./tabs/IaCOutputTab";

const TABS = [
  { id: "assets", label: "Asset map" },
  { id: "arch", label: "Architecture" },
  { id: "risks", label: "Risks" },
  { id: "finops", label: "FinOps plan" },
  { id: "runbook", label: "Runbook" },
  { id: "watchdog", label: "Watchdog" },
  { id: "iac", label: "IaC output" },
];

export function ResultsPanel({ result, initialTab = "finops" }) {
  const [tab, setTab] = useState(initialTab);

  if (!result) {
    return (
      <div className="rad-card border-dashed py-16 text-center text-[#6b7280]">
        Run an analysis to see results here.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#2a2a3e] bg-[#16161f]">
      <div className="flex flex-wrap gap-0 border-b border-[#2a2a3e] px-2 pt-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative px-4 py-3 text-sm font-medium transition-colors duration-200 ${
              tab === t.id
                ? "text-[#00d4aa]"
                : "text-[#6b7280] hover:text-[#d1d5db]"
            }`}
          >
            {t.label}
            {tab === t.id && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-[#00d4aa]" />
            )}
          </button>
        ))}
      </div>
      <div className="tab-panel-enter p-6">
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
        {tab === "iac" && <IaCOutputTab iacBundle={result.iac_bundle} />}
      </div>
    </div>
  );
}
