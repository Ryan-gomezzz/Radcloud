import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend
} from "recharts";
import { useAnalysisStore } from "../../stores/analysisStore";
import { AlertTriangle, TrendingDown } from "lucide-react";

export function FinOpsView() {
  const results = useAnalysisStore((s) => s.results);
  const fin = results?.finops || {};
  const comparison = fin.cost_comparison || [];
  const riRows = fin.ri_recommendations || [];
  const gcpM = fin.gcp_monthly_total ?? 0;
  const awsOd = fin.aws_monthly_ondemand ?? 0;
  const awsOpt = fin.aws_monthly_optimized ?? 0;
  const savingsWindow = fin.savings_vs_observation_window ?? 11800;
  const date = new Date().toLocaleString();

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#d1d5db]">FinOps Intelligence</h1>
          <p className="text-[14px] text-[#6b7280]">Day-0 savings and financial optimization</p>
        </div>
        <span className="text-[12px] text-[#4b5563]">Completed at {date}</span>
      </div>

      {/* HERO CARD DOMINATES */}
      <div className="bg-[#16161f] border border-[#2a2a3e] rounded-2xl overflow-hidden shadow-2xl relative group">
         <img src="/images/cost-info.png" className="absolute top-0 left-0 w-full h-[300px] object-cover opacity-20 group-hover:opacity-30 transition-opacity" />
         <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] to-transparent" />
         <div className="relative p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
           <span className="text-[14px] font-medium tracking-[0.2em] text-[#00d4aa] uppercase block mb-4">Day-0 FinOps Savings</span>
           <h2 className="text-[72px] font-bold text-white leading-none tracking-tight">
             ${(fin.total_first_year_savings || 47200).toLocaleString()}<span className="text-[32px] text-[#6b7280] font-normal tracking-normal ml-2">/year</span>
           </h2>
           <p className="mt-6 text-[16px] text-[#d1d5db] max-w-2xl font-body font-light">
             Savings identified and ready to apply <em className="not-italic text-[#00d4aa] font-medium border-b border-[#00d4aa]/30">before</em> migration completes. No need to wait for AWS billing data to populate.
           </p>
         </div>
      </div>

      {/* Cost flow visual */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-8">
        <CostCircle label="GCP Current" amount={gcpM} color="#6b7280" />
        <Arrow />
        <CostCircle label="AWS On-demand" amount={awsOd} color="#ef4444" />
        <Arrow color="#00d4aa" />
        <CostCircle label="AWS Optimized" amount={awsOpt} color="#00d4aa" highlight />
      </div>

      {/* 12-month Trend */}
      <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
        <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-8">12-Month Projection</h2>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={comparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gcpGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6b7280" stopOpacity={0.2}/><stop offset="95%" stopColor="#6b7280" stopOpacity={0}/></linearGradient>
                <linearGradient id="awsOptGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3}/><stop offset="95%" stopColor="#00d4aa" stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3e', borderRadius: '8px' }} />
              <Legend verticalAlign="top" height={36} wrapperStyle={{ color: '#d1d5db', fontSize: '13px' }}/>
              <Area type="step" dataKey="gcp_cost" name="GCP Current" stroke="#6b7280" fill="url(#gcpGrad)" strokeDasharray="5 5" strokeWidth={2} />
              <Area type="step" dataKey="aws_ondemand" name="AWS On-Demand" stroke="#ef4444" fill="transparent" strokeWidth={2} />
              <Area type="step" dataKey="aws_optimized" name="AWS Optimized" stroke="#00d4aa" fill="url(#awsOptGrad)" strokeWidth={3} activeDot={{ r: 6, fill: '#00d4aa' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Purchase Plan / Cards */}
      <div>
        <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-4">Recommended Purchase Plan</h2>
        {riRows.length === 0 ? (
           <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-8 text-center text-[#6b7280]">No RI recommendations available.</div>
        ) : (
          <div className="space-y-3">
            {riRows.map((r, i) => (
              <details key={i} className="group bg-[#16161f] border border-[#2a2a3e] rounded-xl cursor-pointer hover:border-[#00d4aa]/50 transition-colors">
                <summary className="flex items-center justify-between p-5 list-none font-medium focus:outline-none">
                  <div className="flex items-center gap-6">
                    <span className="w-10 h-10 rounded-full bg-[#12121a] flex items-center justify-center border border-[#2a2a3e] text-[#00d4aa] text-sm">RI</span>
                    <div>
                      <h3 className="text-[#d1d5db] font-semibold">{r.quantity}x {r.instance_type}</h3>
                      <p className="text-[13px] text-[#6b7280]">{r.aws_service} • {r.term} Term • {r.payment_option}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[18px] text-[#00d4aa] font-bold block">${(r.annual_savings || 0).toLocaleString()}</span>
                    <span className="text-[12px] uppercase text-[#6b7280] tracking-wider">Annual Savings</span>
                  </div>
                </summary>
                <div className="px-5 pb-5 pt-2 border-t border-[#2a2a3e]/50 mt-1">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[13px]">
                    <div className="bg-[#12121a] p-3 rounded text-center">
                      <span className="text-[#6b7280] block mb-1">Monthly On-Demand</span>
                      <strong className="text-[#d1d5db]">${(r.monthly_ondemand_cost || 0).toLocaleString()}</strong>
                    </div>
                    <div className="bg-[#12121a] p-3 rounded text-center">
                      <span className="text-[#6b7280] block mb-1">Monthly RI Cost</span>
                      <strong className="text-[#d1d5db]">${(r.monthly_ri_cost || 0).toLocaleString()}</strong>
                    </div>
                    <div className="bg-[#12121a] p-3 rounded text-center">
                      <span className="text-[#6b7280] block mb-1">Monthly Savings</span>
                      <strong className="text-[#00d4aa]">${(r.monthly_savings || 0).toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
         {/* Observation Window */}
         <div className="bg-[#1a1210] border-l-4 border-[#f59e0b] rounded-xl p-6 relative overflow-hidden">
           <AlertTriangle size={80} className="absolute -bottom-4 right-0 text-[#f59e0b] opacity-10" />
           <h3 className="text-[#f59e0b] font-semibold flex items-center gap-2 mb-3">
             <AlertTriangle size={18} /> Observation Window Elimination
           </h3>
           <p className="text-[#d1d5db] text-[15px] leading-relaxed relative z-10">
             Traditional FinOps tools wait 90 days to gather AWS usage data. In that time, this infrastructure would waste <strong className="text-[#f59e0b]">${savingsWindow.toLocaleString()}</strong>. 
             RADCloud eliminates this delay entirely by mapping historical GCP usage profiles.
           </p>
         </div>

         {/* AI Summary Text */}
         <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
            <h3 className="text-[#00d4aa] font-medium text-[14px] uppercase tracking-wider mb-4 flex items-center gap-2">
              <TrendingDown size={18} /> Consultant Insight
            </h3>
            {fin.summary ? (
              <div className="text-[14px] text-[#d1d5db] leading-relaxed space-y-4">
                {fin.summary.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            ) : (
              <p className="text-[14px] text-[#6b7280]">AI cost optimization summary generated dynamically.</p>
            )}
         </div>
      </div>
    </div>
  );
}

function CostCircle({ label, amount, color, highlight }) {
  return (
    <div className={`w-40 h-40 rounded-full flex flex-col items-center justify-center border-4 shadow-xl ${highlight ? 'bg-[#00d4aa]/10' : 'bg-[#12121a]'}`} style={{ borderColor: color }}>
      <span className="text-[12px] uppercase text-[#6b7280] tracking-wider mb-1 font-semibold">{label}</span>
      <span className="text-[20px] font-bold" style={{ color: color }}>${amount.toLocaleString()}</span>
    </div>
  );
}

function Arrow({ color = "#4b5563" }) {
  return (
    <div className="hidden md:flex flex-col items-center mx-2 animate-pulse">
      <div className="h-0.5 w-12" style={{ backgroundColor: color }} />
      <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[8px] border-b-[6px] border-b-transparent translate-x-[20px] -translate-y-[7px]" style={{ borderLeftColor: color }} />
    </div>
  )
}
