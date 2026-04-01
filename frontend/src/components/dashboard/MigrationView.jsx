import { useAnalysisStore } from "../../stores/analysisStore";
import { ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";

export function MigrationView() {
  const results = useAnalysisStore((s) => s.results);
  const mapping = results?.aws_mapping || [];
  const arch = results?.aws_architecture || {};
  const date = new Date().toLocaleString();

  const direct = arch.direct_mappings ?? 0;
  const partial = arch.partial_mappings ?? 0;
  const noEq = arch.no_equivalent ?? 0;
  const total = direct + partial + noEq || 1;

  // Group mappings by categories
  const categories = {
    Compute: mapping.filter(m => m.gcp_service?.toLowerCase().includes("compute") || m.gcp_service?.toLowerCase().includes("function") || m.gcp_service?.toLowerCase().includes("run")),
    Database: mapping.filter(m => m.gcp_service?.toLowerCase().includes("sql") || m.gcp_service?.toLowerCase().includes("database") || m.gcp_service?.toLowerCase().includes("memorystore")),
    Storage: mapping.filter(m => m.gcp_service?.toLowerCase().includes("storage") || m.gcp_service?.toLowerCase().includes("bucket")),
    Network: mapping.filter(m => m.gcp_service?.toLowerCase().includes("vpc") || m.gcp_service?.toLowerCase().includes("network") || m.gcp_service?.toLowerCase().includes("firewall")),
    Other: [],
  };

  // Put others nicely
  const assigned = new Set();
  ["Compute", "Database", "Storage", "Network"].forEach(k => categories[k].forEach(m => assigned.add(m)));
  categories.Other = mapping.filter(m => !assigned.has(m));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#d1d5db]">Architecture Mapping</h1>
          <p className="text-[14px] text-[#6b7280]">Target AWS state and resource equivalents</p>
        </div>
        <span className="text-[12px] text-[#4b5563]">Completed at {date}</span>
      </div>

      <div className="rounded-xl border border-[#2a2a3e] bg-[#16161f] overflow-hidden">
         <img src="/images/arch-diagram.png" alt="AWS Architecture" className="w-full object-cover max-h-[400px] border-b border-[#2a2a3e] opacity-90" />
         <div className="p-6">
           <p className="text-[#d1d5db] text-[15px] leading-relaxed max-w-4xl">{arch.summary || "Architecture analysis completed successfully."}</p>
         </div>
      </div>

      {["Compute", "Database", "Storage", "Network", "Other"].map(cat => {
         const items = categories[cat];
         if (!items || items.length === 0) return null;
         return (
           <div key={cat} className="space-y-4">
             <h2 className="text-[14px] font-semibold uppercase tracking-wider text-[#d1d5db] border-b border-[#2a2a3e] pb-2">{cat} ({items.length})</h2>
             <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
               {items.map((m, i) => {
                 const isGap = m.gap_flag || m.mapping_confidence === "none";
                 const borderColor = isGap ? 'border-[#ef4444]/50' : m.mapping_confidence === "partial" ? 'border-[#f59e0b]/50' : 'border-[#2a2a3e]';
                 const accentColor = isGap ? 'bg-[#ef4444]' : m.mapping_confidence === "partial" ? 'bg-[#f59e0b]' : 'bg-[#00d4aa]';

                 return (
                   <div key={i} className={`bg-[#16161f] rounded-xl border ${borderColor} p-4 hover:bg-[#1a1a2e] transition-colors relative overflow-hidden flex flex-col justify-between`}>
                     <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentColor}`} />
                     
                     <div className="ml-2">
                       <div className="flex justify-between items-start mb-4">
                         <div>
                           <span className="text-[11px] uppercase tracking-wider text-[#6b7280] block mb-1">GCP Source</span>
                           <h3 className="font-semibold text-[#d1d5db] text-[15px] truncate max-w-[180px]">{m.gcp_service}</h3>
                           <p className="text-[12px] text-[#6b7280] mt-1 font-mono truncate max-w-[180px]">{m.gcp_config_summary}</p>
                         </div>
                       </div>
                       
                       <div className="flex items-center text-[#4b5563] my-3 ml-2">
                          <ArrowRight size={16} />
                       </div>

                       <div>
                         <span className="text-[11px] uppercase tracking-wider text-[#6b7280] block mb-1">AWS Target</span>
                         <h3 className={`font-semibold text-[15px] ${isGap ? 'text-[#ef4444]' : 'text-[#d1d5db]'}`}>{m.aws_service || 'No Equivalent'}</h3>
                         <p className="text-[12px] text-[#6b7280] mt-1 font-mono truncate max-w-[200px]">{JSON.stringify(m.aws_config || {})}</p>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
           </div>
         );
      })}

      <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl overflow-hidden p-6 mt-8">
         <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-6">Mapping Confidence</h2>
         <div className="h-3 rounded-full overflow-hidden bg-[#12121a] flex w-full">
            {direct > 0 && <div style={{ width: `${(direct / total) * 100}%` }} className="bg-[#00d4aa]" />}
            {partial > 0 && <div style={{ width: `${(partial / total) * 100}%` }} className="bg-[#f59e0b]" />}
            {noEq > 0 && <div style={{ width: `${(noEq / total) * 100}%` }} className="bg-[#ef4444]" />}
         </div>
         
         <div className="mt-8 space-y-3">
            <h3 className="text-[#d1d5db] font-medium text-[14px] mb-4">Gap Details</h3>
            {itemsWithGaps(mapping).length === 0 ? (
               <div className="flex items-center gap-2 text-[#6b7280] text-sm">
                 <CheckCircle2 size={16} className="text-[#00d4aa]" /> No mapping gaps detected.
               </div>
            ) : itemsWithGaps(mapping).map((m, i) => (
              <details key={i} className="group bg-[#12121a] border border-[#2a2a3e] rounded-lg cursor-pointer">
                <summary className="flex items-center gap-3 p-4 font-medium text-[#d1d5db] focus:outline-none">
                   <AlertCircle size={16} className="text-[#f59e0b] group-open:text-[#ef4444] transition-colors" />
                   {m.gcp_service} — {m.mapping_confidence === "none" ? "No direct equivalent" : "Requires redesign"}
                </summary>
                <div className="px-10 pb-4 text-[13px] text-[#6b7280] leading-relaxed">
                  The GCP resource <strong className="text-[#d1d5db]">{m.gcp_service}</strong> configured as <code className="font-mono text-[#a855f7] bg-[#16161f] px-1 rounded">{m.gcp_config_summary}</code> cannot be directly mapped. {m.notes || "Consider re-architecting using native AWS alternatives or SaaS solutions."}
                </div>
              </details>
            ))}
         </div>
      </div>
    </div>
  );
}

function itemsWithGaps(mapping) {
  return mapping.filter(m => m.gap_flag || m.mapping_confidence === "none" || m.mapping_confidence === "partial");
}
