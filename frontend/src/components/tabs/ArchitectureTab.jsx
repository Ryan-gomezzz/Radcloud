function ConfidenceDot({ confidence }) {
  const c = (confidence || "").toLowerCase();
  const color =
    c === "direct" ? "#00d4aa" : c === "partial" ? "#f59e0b" : "#ef4444";
  const label =
    c === "direct" ? "Direct" : c === "partial" ? "Partial" : "No equivalent";
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <span className="text-sm text-[#d1d5db]">{label}</span>
    </div>
  );
}

function formatAwsConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return "—";
  return Object.entries(cfg)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(", ");
}

export function ArchitectureTab({ awsMapping, awsArchitecture }) {
  const arch = awsArchitecture;
  const summaryText =
    typeof arch === "string"
      ? arch
      : arch?.summary ?? "";

  const paragraphs = summaryText
    ? summaryText.split(/\n\n+/).filter(Boolean)
    : [];

  return (
    <div className="space-y-8">
      {paragraphs.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#f9fafb]">Architecture summary</h3>
          <div className="space-y-3 rounded-lg border border-[#2a2a3e] bg-[#12121a] p-5">
            {paragraphs.map((p, i) => (
              <p key={i} className="text-sm leading-relaxed text-[#d1d5db]">
                {p}
              </p>
            ))}
          </div>
        </div>
      )}

      {arch && typeof arch === "object" && (
        <div className="flex flex-wrap gap-3 text-sm">
          {[
            ["Direct", arch.direct_mappings, "#00d4aa"],
            ["Partial", arch.partial_mappings, "#f59e0b"],
            ["No equivalent", arch.no_equivalent, "#ef4444"],
          ].map(([label, val, col]) => (
            <div
              key={label}
              className="rounded-lg border border-[#2a2a3e] bg-[#12121a] px-4 py-2"
            >
              <span className="text-[#6b7280]">{label}:</span>{" "}
              <span className="font-semibold" style={{ color: col }}>
                {val ?? "—"}
              </span>
            </div>
          ))}
          {arch.total_resources != null && (
            <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] px-4 py-2">
              <span className="text-[#6b7280]">Total resources:</span>{" "}
              <span className="font-semibold text-[#f9fafb]">{arch.total_resources}</span>
            </div>
          )}
        </div>
      )}

      {arch?.services_used?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[#f9fafb]">Services used</h3>
          <div className="flex flex-wrap gap-2">
            {arch.services_used.map((s) => (
              <span
                key={s}
                className="rounded-md border border-[#2a2a3e] bg-[#12121a] px-3 py-1 text-xs text-[#d1d5db]"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {awsMapping?.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold text-[#f9fafb]">Service mapping</h3>
          <div className="overflow-x-auto rounded-lg border border-[#2a2a3e]">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#2a2a3e] text-[#6b7280]">
                  <th className="px-3 py-3">GCP service</th>
                  <th className="px-3 py-3">GCP config</th>
                  <th className="px-2 py-3 w-8">→</th>
                  <th className="px-3 py-3">AWS service</th>
                  <th className="px-3 py-3">AWS config</th>
                  <th className="px-3 py-3">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {awsMapping.map((row, i) => (
                  <tr
                    key={row.gcp_resource_id || i}
                    className={`border-b border-[#2a2a3e]/70 ${
                      row.gap_flag ? "bg-[rgba(245,158,11,0.06)]" : ""
                    }`}
                  >
                    <td className="px-3 py-2 align-top text-[#d1d5db]">
                      <div className="font-medium text-[#f9fafb]">{row.gcp_service}</div>
                      <div className="text-xs text-[#6b7280]">{row.gcp_resource_id}</div>
                    </td>
                    <td className="px-3 py-2 align-top text-xs text-[#9ca3af]">
                      {row.gcp_config_summary || "—"}
                    </td>
                    <td className="px-2 py-2 text-[#00d4aa]">→</td>
                    <td className="px-3 py-2 align-top text-[#d1d5db]">{row.aws_service}</td>
                    <td className="px-3 py-2 align-top text-xs text-[#9ca3af]">
                      {formatAwsConfig(row.aws_config)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <ConfidenceDot confidence={row.mapping_confidence} />
                      {row.gap_notes && (
                        <p className="mt-2 text-xs text-[#f59e0b]">{row.gap_notes}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!awsMapping?.length && !summaryText && (
        <p className="text-[#6b7280]">No mapping output yet.</p>
      )}
    </div>
  );
}
