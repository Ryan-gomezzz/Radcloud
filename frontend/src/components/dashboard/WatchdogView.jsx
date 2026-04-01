import { useState } from "react";
import {
  Line, XAxis, YAxis, Tooltip, CartesianGrid, ComposedChart, Area, Legend, ResponsiveContainer
} from "recharts";
import {
  Wrench, TrendingDown, ShieldCheck, ScanSearch, Scale, PlayCircle, ChevronRight, AlertTriangle
} from "lucide-react";
import { useAnalysisStore } from "../../stores/analysisStore";

const formatMoney = (n) => `$${(n || 0).toLocaleString()}`;

export function WatchdogView() {
  const results = useAnalysisStore((s) => s.results);
  const wd = results?.watchdog || {};
  const trend = wd.cost_trend || [];
  const spend = wd.spend_by_service || [];
  const opps = wd.optimization_opportunities || [];
  const pipe = wd.remediation_pipeline || {};
  const date = new Date().toLocaleString();

  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const maxCost = Math.max(...spend.map(s => s.cost), 1);

  const pipelineSteps = [
    { key: "detect", title: "Detect", text: pipe.detect, icon: ScanSearch, color: "#4a9eff" },
    { key: "evaluate", title: "Evaluate", text: pipe.evaluate, icon: Scale, color: "#f59e0b" },
    { key: "apply", title: "Apply", text: pipe.apply, icon: PlayCircle, color: "#00d4aa" },
    { key: "verify", title: "Verify", text: pipe.verify, icon: ShieldCheck, color: "#a855f7" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#d1d5db]">Watchdog Operations</h1>
          <p className="text-[14px] text-[#6b7280]">Continuous optimization and auto-remediation</p>
        </div>
        <span className="text-[12px] text-[#4b5563]">Completed at {date}</span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Monthly AWS Spend" value={wd.monthly_aws_spend} prefix="$" />
        <StatCard label="Savings Identified" value={wd.savings_identified} prefix="$" highlight />
        <StatCard label="Resources Optimized" value={wd.resources_optimized_pct} suffix="%" />
        <StatCard label="Active Agents" value={wd.active_agents} />
      </div>

      {/* Auto-remediation pipeline */}
      <div>
        <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-4">Remediation Pipeline</h2>
        <div className="flex flex-col md:flex-row items-stretch gap-4 relative">
           <div className="hidden md:block absolute top-[50%] left-0 right-0 h-0.5 bg-[#2a2a3e] -translate-y-1/2 z-0" />
           {pipelineSteps.map((step, i) => {
             const Icon = step.icon;
             return (
               <div key={i} className="flex-1 bg-[#16161f] border border-[#2a2a3e] rounded-xl p-5 relative z-10 shadow-lg hover:-translate-y-1 transition-transform group">
                 <div className="flex items-center gap-3 mb-3">
                   <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#12121a] border border-[#2a2a3e] group-hover:scale-110 transition-transform">
                     <Icon size={18} color={step.color} />
                   </div>
                   <h3 className="text-[#d1d5db] font-semibold">{step.title}</h3>
                 </div>
                 <p className="text-[13px] text-[#6b7280] leading-relaxed">{step.text}</p>
               </div>
             )
           })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Cost trend projection */}
        <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
          <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-6">Cost Trend Projection</h2>
          <div className="h-[280px]">
             <ResponsiveContainer width="100%" height="100%">
               <ComposedChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="savingsGrad" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.2} />
                     <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                   </linearGradient>
                 </defs>
                 <CartesianGrid stroke="#2a2a3e" strokeDasharray="3 3" vertical={false} />
                 <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                 <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `$${v / 1000}k`} axisLine={false} tickLine={false} />
                 <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3e', borderRadius: '8px' }} />
                 <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px', color: '#d1d5db' }}/>
                 <Area type="monotone" dataKey="traditional" name="Traditional" stroke="#6b7280" fill="transparent" strokeDasharray="5 5" strokeWidth={2} />
                 <Area type="monotone" dataKey="radcloud" name="RADCloud" stroke="#00d4aa" fill="url(#savingsGrad)" strokeWidth={2} activeDot={{ r: 6, fill: '#00d4aa' }} />
               </ComposedChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Spend by service */}
        <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
          <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-6">Spend by Service</h2>
          <div className="space-y-4">
             {spend.map((item, i) => (
                <div key={i} className="flex items-center gap-4 group">
                  <span className="text-[13px] text-[#6b7280] w-20 text-right font-medium truncate group-hover:text-[#d1d5db] transition-colors">{item.service}</span>
                  <div className="flex-1 h-[28px] bg-[#12121a] rounded flex items-center overflow-hidden border border-[#2a2a3e]/50">
                     <div 
                        className="h-full bg-gradient-to-r from-[#00d4aa]/80 to-[#4a9eff]/80 transition-all duration-1000 group-hover:brightness-110" 
                        style={{ width: `${(item.cost / maxCost) * 100}%` }} 
                     />
                  </div>
                  <span className="text-[13px] font-semibold text-[#d1d5db] w-20">${item.cost.toLocaleString()}</span>
                </div>
             ))}
          </div>
        </div>
      </div>

      {/* Optimization opportunities */}
      <div>
        <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-4">Optimization Opportunities</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
           {opps.map((o) => (
              <div key={o.id} className="bg-[#16161f] border border-[#2a2a3e] rounded-xl overflow-hidden shadow-lg flex flex-col hover:border-[#00d4aa]/30 transition-colors">
                <div className="p-5 flex-1 pb-2">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[11px] uppercase tracking-wider font-bold px-2 py-1 rounded bg-[#12121a] border ${o.impact === 'high' ? 'text-[#ef4444] border-[#ef4444]/30' : 'text-[#f59e0b] border-[#f59e0b]/30'}`}>
                      {o.impact} Impact
                    </span>
                    <span className="flex items-center gap-1 text-[12px] text-[#00d4aa]">
                       <ShieldCheck size={14} /> {o.confidence}% Confidence
                    </span>
                  </div>
                  <h3 className="text-[#d1d5db] font-semibold text-[15px] mb-2">{o.title}</h3>
                  <p className="text-[13px] text-[#6b7280] leading-relaxed mb-4">{o.description}</p>
                  
                  <div className="flex items-center gap-2 mt-auto">
                    <TrendingDown size={18} className="text-[#00d4aa]" />
                    <span className="text-[24px] font-bold text-[#d1d5db]">${(o.monthly_savings || 0).toLocaleString()}</span>
                    <span className="text-[13px] text-[#6b7280] mt-1 line-through">${(o.monthly_savings * 1.5 || 0).toLocaleString()}</span> 
                  </div>
                </div>

                <div className="border-t border-[#2a2a3e] bg-[#1a1a2e]">
                   <button onClick={() => toggle(o.id)} className="w-full text-left px-5 py-3 flex items-center justify-between text-[13px] text-[#00d4aa] font-medium hover:bg-[#12121a] transition-colors focus:outline-none">
                     <span>{expanded[o.id] ? "Hide" : "Review"} Auto-Fix Policy Steps</span>
                     <ChevronRight size={16} className={`transition-transform ${expanded[o.id] ? "rotate-90" : ""}`} />
                   </button>
                   
                   <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expanded[o.id] ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}>
                      <ol className="p-5 pt-1 space-y-3 list-decimal list-inside">
                        {(o.auto_fix || []).map((step, i) => (
                           <li key={i} className="text-[13px] text-[#d1d5db]">
                             <span className="ml-1 text-[#6b7280]">{step}</span>
                           </li>
                        ))}
                      </ol>
                   </div>
                </div>
              </div>
           ))}
           
           {opps.length === 0 && (
             <div className="col-span-full py-12 flex flex-col items-center justify-center bg-[#16161f] border border-[#2a2a3e] rounded-xl text-[#6b7280]">
               <ShieldCheck size={48} className="text-[#00d4aa]/30 mb-4" />
               <p className="text-[15px] font-medium text-[#d1d5db]">No optimization opportunities detected</p>
               <p className="text-[13px] mt-1">Infrastructure is running smoothly and optimally.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, prefix = "", suffix = "", highlight = false }) {
  return (
    <div className={`bg-[#16161f] border p-5 rounded-xl ${highlight ? 'border-[#00d4aa]/50 bg-[#00d4aa]/5' : 'border-[#2a2a3e]'}`}>
      <span className="text-[12px] uppercase tracking-wider text-[#6b7280] font-medium block mb-2">{label}</span>
      <span className={`text-[32px] font-bold ${highlight ? 'text-[#00d4aa]' : 'text-[#d1d5db]'}`}>
        <span className="text-[20px] font-normal mr-1">{prefix}</span>
        {(value || 0).toLocaleString()}
        <span className="text-[18px] font-medium ml-1 text-[#6b7280]">{suffix}</span>
      </span>
    </div>
  );
}
