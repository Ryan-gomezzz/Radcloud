import { useCountUp } from "../hooks/useCountUp";

function Stat({ label, value, suffix = "", prefix = "", accent }) {
  const num = typeof value === "number" ? value : null;
  const { display } = useCountUp(num ?? 0, 1200, num != null, 0);
  return (
    <div
      className="rounded-lg px-4 py-3 text-center"
      style={{ background: "var(--bg-secondary)" }}
    >
      <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">{label}</p>
      <p
        className="mt-1 text-xl font-semibold md:text-2xl"
        style={{ color: accent || "var(--text-heading)" }}
      >
        {num == null ? "—" : `${prefix}${display}${suffix}`}
      </p>
    </div>
  );
}

export function ExecutiveSummary({ results }) {
  const arch = results?.aws_architecture || {};
  const fin = results?.finops || {};
  const riskSum = results?.risk_summary || {};

  const total = arch.total_resources ?? results?.gcp_inventory?.length ?? 0;
  const direct = arch.direct_mappings ?? 0;
  const partial = arch.partial_mappings ?? 0;
  const high = riskSum.high ?? 0;
  const savings = fin.total_first_year_savings ?? 0;

  return (
    <div className="rad-card mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
      <Stat label="Resources" value={total} />
      <Stat label="Direct map" value={direct} accent="#00d4aa" />
      <Stat label="Partial" value={partial} accent="#f59e0b" />
      <Stat label="High risk" value={high} accent="#ef4444" />
      <Stat label="1st year savings" value={savings} prefix="$" accent="#00d4aa" />
    </div>
  );
}
