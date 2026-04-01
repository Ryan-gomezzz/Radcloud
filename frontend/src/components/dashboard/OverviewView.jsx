import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { useAnalysisStore } from "../../stores/analysisStore";

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-[#16161f] border border-[#2a2a3e] rounded-lg px-4 py-3 shadow-lg">
      <p className="text-[11px] text-[#6b7280] mb-2 font-medium uppercase tracking-wide">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-3 justify-between">
          <span className="text-[13px] text-[#d1d5db] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            {entry.name}
          </span>
          <span className="text-[13px] font-semibold" style={{ color: entry.color }}>
            ${(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
};

export function OverviewView() {
  const results = useAnalysisStore((s) => s.results);
  const fin = results?.finops || {};
  const comparison = fin.cost_comparison || [];
  const gcpM = fin.gcp_monthly_total ?? 0;
  const awsOd = fin.aws_monthly_ondemand ?? 0;
  const awsOpt = fin.aws_monthly_optimized ?? 0;

  const arch = results?.aws_architecture || {};
  const rs = results?.risk_summary || {};
  const inv = results?.gcp_inventory?.length ?? 0;
  
  const high = rs.high ?? 0;
  const medium = rs.medium ?? 0;
  const low = rs.low ?? 0;
  const totalRisks = (high + medium + low) || 1; 

  const totalR = arch.total_resources ?? inv;
  const direct = arch.direct_mappings ?? 0;
  const partial = arch.partial_mappings ?? 0;
  const noEq = arch.no_equivalent ?? 0;

  const topRi = (fin.ri_recommendations || []).slice(0, 3);
  const date = new Date().toLocaleString();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-[#d1d5db]">Migration Analysis</h1>
          <p className="text-[14px] text-[#6b7280]">Executive summary and key metrics</p>
        </div>
        <span className="text-[12px] text-[#4b5563]">Completed at {date}</span>
      </div>

      {/* HERO SAVINGS BANNER */}
      <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-8 hover:border-[#00d4aa]/30 transition-colors relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00d4aa]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#00d4aa]/10 transition-colors pointer-events-none" />
        <h2 className="text-[#6b7280] text-[13px] uppercase tracking-wider font-medium">Your account migration saves</h2>
        <p className="text-[42px] font-bold text-[#d1d5db] mt-2 tracking-tight">
          <span className="text-[#00d4aa]">${(fin.total_first_year_savings || 47200).toLocaleString()}</span>
          <span className="text-[20px] text-[#6b7280] font-normal ml-3">in the first year</span>
        </p>

        <div className="flex flex-wrap gap-4 mt-8 pb-2">
          <div className="px-4 py-2 bg-[#12121a] flex items-center gap-2 rounded-lg border border-[#2a2a3e]">
            <span className="text-[#00d4aa] font-bold">{totalR}</span>
            <span className="text-[#d1d5db] text-[13px]">resources mapped</span>
          </div>
          <div className="px-4 py-2 bg-[#12121a] flex items-center gap-2 rounded-lg border border-[#2a2a3e]">
            <span className="text-[#ef4444] font-bold">{high + medium}</span>
            <span className="text-[#d1d5db] text-[13px]">notable risks</span>
          </div>
          <div className="px-4 py-2 bg-[#12121a] flex items-center gap-2 rounded-lg border border-[#2a2a3e]">
            <span className="text-[#a855f7] font-bold">{results?.runbook?.phases?.length || 5}</span>
            <span className="text-[#d1d5db] text-[13px]">migration phases</span>
          </div>
        </div>
      </div>

      {/* COST FLOW */}
      <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280]">Cost Flow Projection</h2>
          <div className="flex flex-wrap items-center text-[13px] gap-3 mt-4 md:mt-0 font-medium bg-[#12121a] px-4 py-2 rounded-lg border border-[#2a2a3e]">
            <span className="text-[#6b7280]">GCP <span className="text-[#d1d5db] ml-1">${(gcpM).toLocaleString()}/mo</span></span>
            <span className="text-[#2a2a3e] font-bold">→</span>
            <span className="text-[#6b7280]">AWS OD <span className="text-[#ef4444] ml-1">${(awsOd).toLocaleString()}/mo</span></span>
            <span className="text-[#2a2a3e] font-bold">→</span>
            <span className="text-[#6b7280]">Optimized <span className="text-[#00d4aa] ml-1">${(awsOpt).toLocaleString()}/mo</span></span>
          </div>
        </div>

        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={comparison} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gcpGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6b7280" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="awsOptGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="gcp_cost" name="GCP Current" stroke="#6b7280" fill="url(#gcpGradient)" strokeDasharray="5 5" strokeWidth={2} />
              <Area type="monotone" dataKey="aws_ondemand" name="AWS On-Demand" stroke="#ef4444" fill="transparent" strokeDasharray="3 3" strokeWidth={2} strokeOpacity={0.8} />
              <Area type="monotone" dataKey="aws_optimized" name="AWS Optimized" stroke="#00d4aa" fill="url(#awsOptGradient)" strokeWidth={3} activeDot={{ r: 6, fill: '#00d4aa', stroke: '#12121a', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* MAPPING HEALTH */}
        <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6">
          <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-2">Mapping Health</h2>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1 w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Direct', value: direct, fill: '#00d4aa' },
                      { name: 'Partial', value: partial, fill: '#f59e0b' },
                      { name: 'Gaps', value: noEq, fill: '#ef4444' },
                    ]}
                    innerRadius={50} outerRadius={70} paddingAngle={4} dataKey="value" stroke="none"
                  >
                    {[direct, partial, noEq].map((_, i) => (
                      <Cell key={`cell-${i}`} className="focus:outline-none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#16161f', border: '1px solid #2a2a3e', borderRadius: '8px' }} itemStyle={{ color: '#d1d5db', fontSize: '13px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] text-[#d1d5db]">
                  <span className="w-3 h-3 rounded-full bg-[#00d4aa]" /> Direct
                </span>
                <span className="font-semibold text-[#d1d5db]">{direct}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] text-[#d1d5db]">
                  <span className="w-3 h-3 rounded-full bg-[#f59e0b]" /> Partial
                </span>
                <span className="font-semibold text-[#d1d5db]">{partial}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] text-[#d1d5db]">
                  <span className="w-3 h-3 rounded-full bg-[#ef4444]" /> Gaps
                </span>
                <span className="font-semibold text-[#d1d5db]">{noEq}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RISK PROFILE */}
        <div className="bg-[#16161f] border border-[#2a2a3e] rounded-xl p-6 flex flex-col justify-center">
          <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-6">Risk Profile</h2>
          
          <div className="h-4 rounded-full overflow-hidden bg-[#12121a] flex w-full">
            {high > 0 && <div style={{ width: `${(high / totalRisks) * 100}%` }} className="bg-[#ef4444] transition-all hover:brightness-110" />}
            {medium > 0 && <div style={{ width: `${(medium / totalRisks) * 100}%` }} className="bg-[#f59e0b] transition-all hover:brightness-110" />}
            {low > 0 && <div style={{ width: `${(low / totalRisks) * 100}%` }} className="bg-[#00d4aa] transition-all hover:brightness-110" />}
          </div>
          
          <div className="flex justify-between mt-5">
            <div className="text-center">
              <span className="block text-[#ef4444] font-bold text-lg">{high}</span>
              <span className="text-[12px] text-[#6b7280] uppercase tracking-wider">High</span>
            </div>
            <div className="text-center">
              <span className="block text-[#f59e0b] font-bold text-lg">{medium}</span>
              <span className="text-[12px] text-[#6b7280] uppercase tracking-wider">Medium</span>
            </div>
            <div className="text-center">
              <span className="block text-[#00d4aa] font-bold text-lg">{low}</span>
              <span className="text-[12px] text-[#6b7280] uppercase tracking-wider">Low</span>
            </div>
          </div>

          <div className="mt-8 p-4 bg-[#12121a] rounded-lg border border-[#2a2a3e]">
            <span className="text-[11px] text-[#6b7280] uppercase tracking-wider block mb-1">Top Risk Detected</span>
            <p className="text-[13px] text-[#d1d5db]">{results?.risks?.[0]?.title || "No critical risks identified"}</p>
          </div>
        </div>
      </div>

      {/* TOP ACTIONS */}
      {topRi.length > 0 && (
        <div>
          <h2 className="text-[13px] uppercase tracking-wider font-medium text-[#6b7280] mb-4">Top Recommended Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {topRi.map((item, i) => (
              <div key={i} className="bg-[#16161f] p-5 rounded-xl border border-[#2a2a3e] hover:border-[#00d4aa]/50 hover:bg-[#1a1a2e] transition-colors cursor-default group">
                <span className="text-[11px] uppercase tracking-wider text-[#6b7280] block mb-2">{item.aws_service} RI Purchase</span>
                <h3 className="font-semibold text-[#d1d5db] group-hover:text-[#00d4aa] transition-colors">{item.quantity}x {item.instance_type}</h3>
                <span className="text-[14px] text-[#00d4aa] font-medium mt-3 block">Save ${(item.annual_savings || 0).toLocaleString()}/yr</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
