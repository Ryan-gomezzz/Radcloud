function categoryStyle(service) {
  const s = (service || "").toLowerCase();
  if (s.includes("compute") || s.includes("engine")) return "border-l-[#4a9eff]";
  if (s.includes("sql") || s.includes("memorystore")) return "border-l-[#a855f7]";
  if (s.includes("storage")) return "border-l-[#00d4aa]";
  if (s.includes("run") || s.includes("function")) return "border-l-[#f59e0b]";
  if (s.includes("vpc") || s.includes("firewall") || s.includes("network")) return "border-l-[#6b7280]";
  return "border-l-[#4a9eff]";
}

function regionFromConfig(cfg) {
  if (!cfg) return "—";
  return cfg.region || cfg.zone || cfg.location || "—";
}

function keyConfigSummary(cfg) {
  if (!cfg || typeof cfg !== "object") return "—";
  const skip = new Set(["labels"]);
  return Object.entries(cfg)
    .filter(([k]) => !skip.has(k))
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
    .join(" · ");
}

export function AssetMapTab({ inventory }) {
  if (!inventory?.length) {
    return <p className="text-[#6b7280]">No inventory yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
          Total resources
        </p>
        <p className="mt-1 text-3xl font-bold text-[#f9fafb]">{inventory.length}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#2a2a3e]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-[#2a2a3e] text-[#6b7280]">
              <th className="px-4 py-3">Service</th>
              <th className="px-4 py-3">Resource name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Key config</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((row, i) => {
              const cfg = row.config || {};
              return (
                <tr
                  key={row.resource_id || row.name || i}
                  className={`border-b border-[#2a2a3e]/60 border-l-4 bg-[#16161f] ${categoryStyle(row.service)}`}
                >
                  <td className="px-4 py-3 font-medium text-[#e5e7eb]">{row.service}</td>
                  <td className="px-4 py-3 text-[#d1d5db]">{row.name || row.resource_id}</td>
                  <td className="px-4 py-3 text-[#9ca3af]">{row.resource_type}</td>
                  <td className="px-4 py-3 text-[#9ca3af]">{regionFromConfig(cfg)}</td>
                  <td className="max-w-md px-4 py-3 text-xs text-[#9ca3af]">
                    {keyConfigSummary(cfg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
