import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

export function WatchdogTab({ watchdog }) {
  if (!watchdog) {
    return <p className="text-[#6b7280]">No Watchdog dashboard yet.</p>;
  }

  const trend = watchdog.cost_trend || [];
  const spend = watchdog.spend_by_service || [];
  const opps = watchdog.optimization_opportunities || [];
  const pipe = watchdog.remediation_pipeline || {};

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Monthly AWS spend", value: watchdog.monthly_aws_spend, prefix: "$" },
          { label: "Savings identified", value: watchdog.savings_identified, prefix: "$" },
          {
            label: "Resources optimized",
            value: watchdog.resources_optimized_pct,
            suffix: "%",
          },
          { label: "Active agents", value: watchdog.active_agents },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4"
          >
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
              {m.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#f9fafb]">
              {m.prefix}
              {typeof m.value === "number" ? m.value.toLocaleString() : m.value ?? "—"}
              {m.suffix ?? ""}
            </p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-[#f9fafb]">
          Cost trend — 6 month projection
        </h3>
        <div className="h-72 w-full rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid stroke="#2a2a3e" strokeDasharray="3 3" />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
              <YAxis stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "#16161f",
                  border: "1px solid #2a2a3e",
                  borderRadius: 8,
                }}
                labelStyle={{ color: "#d1d5db" }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="traditional"
                name="Traditional"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="radcloud"
                name="RADCloud"
                stroke="#00d4aa"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-[#f9fafb]">Spend by service</h3>
        <div className="h-64 w-full rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spend} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="#2a2a3e" strokeDasharray="3 3" />
              <XAxis type="number" stroke="#6b7280" fontSize={12} />
              <YAxis dataKey="service" type="category" width={56} stroke="#6b7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  background: "#16161f",
                  border: "1px solid #2a2a3e",
                  borderRadius: 8,
                }}
              />
              <Bar dataKey="cost" fill="#4a9eff" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-[#f9fafb]">
          AI-detected optimization opportunities
        </h3>
        <p className="mb-4 text-xs text-[#6b7280]">Click a card to expand auto-fix steps (simulated).</p>
        <div className="grid gap-4 md:grid-cols-3">
          {opps.map((o) => (
            <OppCard key={o.id} opp={o} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-[#f9fafb]">
          Watchdog auto-remediation pipeline
        </h3>
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { title: "Detect", body: pipe.detect, icon: "◎" },
            { title: "Evaluate", body: pipe.evaluate, icon: "◇" },
            { title: "Apply", body: pipe.apply, icon: "▶" },
            { title: "Verify", body: pipe.verify, icon: "✓" },
          ].map((s) => (
            <div
              key={s.title}
              className="rounded-lg border border-[#2a2a3e] bg-[#12121a] p-4 transition-all hover:border-[#3a3a5e] hover:shadow-[0_0_20px_rgba(0,212,170,0.12)]"
            >
              <span className="text-lg text-[#00d4aa]">{s.icon}</span>
              <p className="mt-2 font-semibold text-[#f9fafb]">{s.title}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#9ca3af]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OppCard({ opp }) {
  const [open, setOpen] = useState(false);
  const impact = (opp.impact || "").toLowerCase();
  const badge =
    impact === "high"
      ? "bg-[rgba(239,68,68,0.15)] text-[#ef4444] border-[rgba(239,68,68,0.3)]"
      : "bg-[rgba(245,158,11,0.15)] text-[#f59e0b] border-[rgba(245,158,11,0.3)]";

  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={`w-full rounded-xl border p-4 text-left transition-all ${
        open
          ? "border-[#00d4aa] shadow-[0_0_20px_rgba(0,212,170,0.12)]"
          : "border-[#2a2a3e] hover:border-[#3a3a5e]"
      } bg-[#12121a]`}
    >
      <span
        className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${badge}`}
      >
        {opp.impact} impact
      </span>
      <h4 className="mt-3 font-semibold text-[#f9fafb]">{opp.title}</h4>
      <p className="mt-2 text-sm text-[#9ca3af]">{opp.description}</p>
      <p className="mt-3 text-sm font-medium text-[#00d4aa]">
        ${opp.monthly_savings?.toLocaleString?.() ?? opp.monthly_savings}/mo savings
      </p>
      {open && opp.auto_fix?.length > 0 && (
        <ul className="mt-4 list-inside list-disc space-y-1 border-t border-[#2a2a3e] pt-4 text-sm text-[#d1d5db]">
          {opp.auto_fix.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
          <li className="list-none pt-2 text-[#6b7280]">
            Confidence: {opp.confidence ?? "—"}%
          </li>
        </ul>
      )}
    </button>
  );
}
