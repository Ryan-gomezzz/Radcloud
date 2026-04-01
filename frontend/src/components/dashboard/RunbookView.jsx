import { useState } from "react";
import { ChevronDown, CheckCircle2 } from "lucide-react";
import { useAnalysisStore } from "../../stores/analysisStore";

export function RunbookView() {
  const results = useAnalysisStore((s) => s.results);
  const rb = results?.runbook || {};
  const phases = rb.phases || [];
  const date = new Date().toLocaleString();

  const [expanded, setExpanded] = useState(() => 
    Object.fromEntries(phases.map((_, i) => [i, i === 0]))
  );

  const toggle = (i) => setExpanded((e) => ({ ...e, [i]: !e[i] }));

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#d1d5db]">Migration Runbook</h1>
          <p className="text-[14px] text-[#6b7280]">Actionable timeline and execution plan</p>
        </div>
        <span className="text-[12px] text-[#4b5563]">Completed at {date}</span>
      </div>

      <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6 flex items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-6 divide-x divide-[#2a2a3e]">
          <div className="pr-6">
            <span className="text-[12px] uppercase tracking-wider text-[#6b7280] block mb-1">Total Duration</span>
            <span className="text-[20px] font-bold text-[#00d4aa]">{rb.estimated_total_duration || "4-6 weeks"}</span>
          </div>
          <div className="pl-6 pr-6">
            <span className="text-[12px] uppercase tracking-wider text-[#6b7280] block mb-1">Phases</span>
            <span className="text-[20px] font-bold text-[#d1d5db]">{phases.length}</span>
          </div>
          <div className="pl-6">
            <span className="text-[12px] uppercase tracking-wider text-[#6b7280] block mb-1">Total Steps</span>
            <span className="text-[20px] font-bold text-[#d1d5db]">{phases.reduce((acc, p) => acc + (p.steps?.length || 0), 0)}</span>
          </div>
        </div>
      </div>

      <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6 lg:p-8">
         <h2 className="text-[14px] font-medium text-[#d1d5db] mb-8">Execution Timeline</h2>
         <div className="relative border-l-2 border-[#2a2a3e] ml-4 md:ml-6 space-y-12">
            {phases.map((ph, i) => (
              <div key={i} className="relative pl-8 md:pl-10">
                 {/* Timeline Node */}
                 <div className={`absolute -left-[11px] top-1 w-5 h-5 rounded-full border-4 border-[#16161f] ${i === 0 ? 'bg-[#00d4aa]' : 'bg-[#4b5563]'}`} />
                 
                 <div className="group cursor-pointer" onClick={() => toggle(i)}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                       <div>
                          <span className="text-[11px] uppercase tracking-wider text-[#00d4aa] font-bold mb-1 block">Phase {ph.phase_number || i + 1}</span>
                          <h3 className="text-[18px] font-semibold text-[#d1d5db] group-hover:text-[#00d4aa] transition-colors">{ph.name}</h3>
                       </div>
                       <div className="flex items-center gap-3">
                          <span className="px-3 py-1 bg-[#12121a] border border-[#2a2a3e] rounded text-[#d1d5db] text-[12px]">{ph.duration}</span>
                          <span className="px-3 py-1 bg-[#1a1a2e] text-[#6b7280] rounded text-[12px]">{ph.steps?.length || 0} steps</span>
                          <ChevronDown size={18} className={`text-[#6b7280] transition-transform duration-300 ${expanded[i] ? "rotate-180" : ""}`} />
                       </div>
                    </div>
                 </div>

                 <div className={`overflow-hidden transition-all duration-300 ${expanded[i] ? "max-h-[1500px] opacity-100 mt-6" : "max-h-0 opacity-0"}`}>
                    <div className="bg-[#12121a] border border-[#2a2a3e] rounded-xl overflow-x-auto">
                       <table className="w-full text-left border-collapse min-w-[600px]">
                          <thead>
                             <tr className="border-b border-[#2a2a3e] bg-[#1a1a2e]">
                               <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#6b7280] font-medium">Step</th>
                               <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#6b7280] font-medium">Action</th>
                               <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#6b7280] font-medium">Owner</th>
                               <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-[#6b7280] font-medium">Est. Hours</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-[#2a2a3e]">
                             {(ph.steps || []).map((step, idx) => (
                                <tr key={idx} className="hover:bg-[#16161f] transition-colors group/row">
                                   <td className="px-4 py-3">
                                      <span className="w-6 h-6 rounded-full bg-[#1a1a2e] flex items-center justify-center text-[12px] text-[#d1d5db] font-medium border border-[#2a2a3e]">{step.step_number || idx + 1}</span>
                                   </td>
                                   <td className="px-4 py-3 text-[13px] text-[#d1d5db] leading-relaxed max-w-sm">
                                      {step.action}
                                      {step.notes && <p className="text-[12px] text-[#6b7280] mt-1">{step.notes}</p>}
                                   </td>
                                   <td className="px-4 py-3">
                                      <span className="px-2 py-1 rounded bg-[#1a1a2e] text-[11px] text-[#4a9eff] border border-[#4a9eff]/30 uppercase tracking-widest font-medium">
                                        {step.responsible || 'Cloud Eng'}
                                      </span>
                                   </td>
                                   <td className="px-4 py-3 text-[13px] text-[#6b7280] font-medium">
                                      <span className="flex items-center gap-1 group-hover/row:text-[#d1d5db] transition-colors">
                                        {step.estimated_hours} hrs
                                      </span>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 </div>
              </div>
            ))}
         </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
         <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
            <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-4">Rollback Plan</h2>
            <div className="p-4 bg-[#1a1a2e] border-l-2 border-[#ef4444] rounded text-[14px] text-[#d1d5db] leading-relaxed">
               {rb.rollback_plan || "Establish snapshots prior to final cutover. Ensure DNS TTL is lowered to 300s 48 hours before migration for rapid redirection if necessary."}
            </div>
         </div>

         <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
            <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-4">Success Criteria</h2>
            <ul className="space-y-3">
               {(rb.success_criteria || ["All workloads accessible on AWS", "Latency metrics within 5% of GCP baseline", "Zero data loss confirmed matching checksums"]).map((c, i) => (
                  <li key={i} className="flex items-start gap-3">
                     <CheckCircle2 size={18} className="text-[#00d4aa] mt-0.5 shrink-0" />
                     <span className="text-[14px] text-[#d1d5db]">{c}</span>
                  </li>
               ))}
            </ul>
         </div>
      </div>
    </div>
  );
}
