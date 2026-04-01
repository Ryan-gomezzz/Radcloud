import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";

function formatMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function ChatResultsCard({ results }) {
  const navigate = useNavigate();
  const inv = results?.gcp_inventory?.length ?? 0;
  const totalRisks = results?.risk_summary?.total_risks ?? results?.risks?.length ?? 0;
  const savings = results?.finops?.total_first_year_savings ?? 0;

  return (
    <div
      className="ml-11 rounded-xl border border-[color-mix(in_srgb,var(--accent-primary)_35%,transparent)] p-5"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), color-mix(in srgb, var(--accent-secondary) 6%, transparent))",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle className="size-[18px] text-[var(--accent-primary)]" aria-hidden />
        <span className="text-[15px] font-medium text-[var(--text-heading)]">
          Analysis complete
        </span>
      </div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--bg-primary)_65%,transparent)] p-3">
          <p className="text-[11px] uppercase text-[var(--text-muted)]">Resources</p>
          <p className="text-[20px] font-semibold text-[var(--text-heading)]">{inv}</p>
        </div>
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--bg-primary)_65%,transparent)] p-3">
          <p className="text-[11px] uppercase text-[var(--text-muted)]">Risks found</p>
          <p className="text-[20px] font-semibold text-[var(--warning)]">{totalRisks}</p>
        </div>
        <div className="rounded-lg bg-[color-mix(in_srgb,var(--bg-primary)_65%,transparent)] p-3">
          <p className="text-[11px] uppercase text-[var(--text-muted)]">Annual savings</p>
          <p className="text-[20px] font-semibold text-[var(--accent-primary)]">
            {formatMoney(savings)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate("/app/dashboard")}
        className="btn-primary w-full py-3 text-[14px]"
      >
        View full dashboard
      </button>
    </div>
  );
}
