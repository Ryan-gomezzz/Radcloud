import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { API_BASE, authHeaders } from "../../api";
import { useSessionStore } from "../../stores/sessionStore";
import {
  ArrowRight,
  X,
  Send,
  ThumbsUp,
  MessageSquare,
  Ban,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { Badge } from "../shared/Badge";
import { ChartWrapper } from "../shared/ChartWrapper";
import { MetricCard } from "../shared/MetricCard";
import { useChartTheme } from "../../hooks/useChartTheme";

const MOCK_PLAN = {
  plan_id: "plan-001",
  phases: [
    {
      id: "p1",
      name: "Infrastructure Setup",
      duration_days: 5,
      resources: ["VPC", "Subnets", "Security groups"],
    },
    {
      id: "p2",
      name: "Compute Migration",
      duration_days: 8,
      resources: ["GCE", "MIG", "Load balancers"],
    },
    {
      id: "p3",
      name: "Database Migration",
      duration_days: 12,
      resources: ["Cloud SQL", "Memorystore"],
    },
    {
      id: "p4",
      name: "Storage + CDN",
      duration_days: 4,
      resources: ["GCS", "Cloud CDN"],
    },
    {
      id: "p5",
      name: "Verification & Cutover",
      duration_days: 3,
      resources: ["DNS", "Monitoring"],
    },
  ],
  estimated_cost_delta: 312,
  risk_count_high: 2,
  architecture_mappings: [
    {
      phase_id: "p1",
      gcp: "VPC Network",
      aws: "Amazon VPC",
      confidence: "direct",
    },
    {
      phase_id: "p1",
      gcp: "Cloud NAT",
      aws: "NAT Gateway",
      confidence: "direct",
    },
    {
      phase_id: "p2",
      gcp: "Compute Engine",
      aws: "EC2 + ASG",
      confidence: "direct",
    },
    {
      phase_id: "p2",
      gcp: "Cloud Load Balancing",
      aws: "ALB",
      confidence: "partial",
    },
    {
      phase_id: "p3",
      gcp: "Cloud SQL (PostgreSQL)",
      aws: "Amazon RDS",
      confidence: "direct",
    },
    {
      phase_id: "p3",
      gcp: "Memorystore Redis",
      aws: "ElastiCache",
      confidence: "partial",
    },
    {
      phase_id: "p4",
      gcp: "Cloud Storage",
      aws: "S3",
      confidence: "direct",
    },
    {
      phase_id: "p4",
      gcp: "Cloud CDN",
      aws: "CloudFront",
      confidence: "direct",
    },
    {
      phase_id: "p5",
      gcp: "Cloud DNS",
      aws: "Route 53",
      confidence: "direct",
    },
    {
      phase_id: "p2",
      gcp: "Cloud Run",
      aws: "ECS Fargate",
      confidence: "none",
    },
  ],
  cost_categories: [
    { category: "Compute", before: 4200, after: 4512 },
    { category: "Database", before: 1800, after: 1950 },
    { category: "Storage", before: 890, after: 920 },
    { category: "Networking", before: 640, after: 710 },
    { category: "Other", before: 310, after: 330 },
  ],
  risks: [
    {
      id: "r1",
      title: "Cloud Spanner has no direct AWS equivalent",
      description:
        "Requires Aurora Global Database with manual schema migration and extended cutover window.",
      severity: "high",
    },
    {
      id: "r2",
      title: "Committed use discount expiry",
      description:
        "GCP CUD expires in 45 days; align AWS RI purchase to avoid a cost spike.",
      severity: "high",
    },
    {
      id: "r3",
      title: "Cross-region replication lag",
      description:
        "Initial RDS read replica may lag under bulk load; throttle migration batches.",
      severity: "medium",
    },
    {
      id: "r4",
      title: "IAM role trust chain",
      description:
        "Verify external ID and role session duration for CI/CD pipelines.",
      severity: "low",
    },
  ],
};

const PHASE_COLORS = [
  "#38bdf8",
  "#2dd4bf",
  "#fbbf24",
  "#a78bfa",
  "#f472b6",
];

const TABS = [
  { id: "architecture", label: "Architecture" },
  { id: "timeline", label: "Timeline" },
  { id: "cost", label: "Cost" },
  { id: "risks", label: "Risks" },
];

function confidenceVariant(c) {
  const x = String(c || "").toLowerCase();
  if (x === "direct") return "direct";
  if (x === "partial") return "partial";
  return "none";
}

function riskVariant(s) {
  const x = String(s || "").toLowerCase();
  if (x === "high") return "high";
  if (x === "medium") return "medium";
  return "low";
}

function normalizePlan(apiPlan) {
  const base = { ...MOCK_PLAN };
  if (!apiPlan || typeof apiPlan !== "object") return base;
  return {
    ...base,
    ...apiPlan,
    phases: Array.isArray(apiPlan.phases) ? apiPlan.phases : base.phases,
    architecture_mappings: Array.isArray(apiPlan.architecture_mappings)
      ? apiPlan.architecture_mappings
      : base.architecture_mappings,
    cost_categories: Array.isArray(apiPlan.cost_categories)
      ? apiPlan.cost_categories
      : base.cost_categories,
    risks: Array.isArray(apiPlan.risks) ? apiPlan.risks : base.risks,
  };
}

export function PlanReviewPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const chart = useChartTheme();
  const [tab, setTab] = useState("architecture");
  const [activePhaseId, setActivePhaseId] = useState(MOCK_PLAN.phases[0]?.id);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changesText, setChangesText] = useState("");
  const archRefs = useRef({});
  const [plan, setPlan] = useState(MOCK_PLAN);

  useEffect(() => {
    const id = planId || MOCK_PLAN.plan_id;
    let cancel = false;
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/pipeline/plan/${encodeURIComponent(id)}`,
          { headers: { ...authHeaders() } }
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancel) setPlan(normalizePlan(data));
          return;
        }
      } catch {
        /* fallback */
      }
      try {
        const raw = sessionStorage.getItem(`radcloud_plan_${id}`);
        if (raw) {
          const data = JSON.parse(raw);
          if (!cancel) setPlan(normalizePlan(data));
          return;
        }
      } catch {
        /* ignore */
      }
      if (!cancel) setPlan(normalizePlan(MOCK_PLAN));
    })();
    return () => {
      cancel = true;
    };
  }, [planId]);

  useEffect(() => {
    const first = plan.phases?.[0]?.id;
    if (first) setActivePhaseId(first);
  }, [plan.plan_id]);

  const displayId = planId || plan.plan_id;

  const timelineData = useMemo(
    () =>
      (plan.phases ?? []).map((p, i) => ({
        name: p.name,
        days: p.duration_days,
        fill: PHASE_COLORS[i % PHASE_COLORS.length],
      })),
    [plan.phases]
  );

  const scrollToPhase = (phaseId) => {
    setActivePhaseId(phaseId);
    setTab("architecture");
    window.requestAnimationFrame(() => {
      archRefs.current[phaseId]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const categories = plan.cost_categories ?? [];
  const currentMonthly = categories.reduce((s, c) => s + (c.before ?? 0), 0);
  const projectedMonthly = categories.reduce((s, c) => s + (c.after ?? 0), 0);

  return (
    <div className="relative flex min-h-[calc(100vh-60px)] flex-col bg-[#0a0a0f]">
      <div className="flex min-h-0 flex-1">
        <aside className="w-[240px] shrink-0 border-r border-[#1e293b] bg-[#12121a]">
          <div className="border-b border-[#1e293b] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
              Plan
            </p>
            <p className="mt-1 font-mono text-sm text-[#22d3ee]">{displayId}</p>
            <p className="mt-2 text-xs text-[#6b7280]">
              {`${(plan.phases ?? []).length} phases · +$${plan.estimated_cost_delta ?? 0}/mo est.`}
            </p>
          </div>
          <nav className="p-2">
                {(plan.phases ?? []).map((ph) => (
              <button
                key={ph.id}
                type="button"
                onClick={() => scrollToPhase(ph.id)}
                className={`mb-0.5 w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  activePhaseId === ph.id
                    ? "border-l-2 border-[#22d3ee] bg-[#16161f] pl-[10px] text-[#22d3ee]"
                    : "border-l-2 border-transparent pl-3 text-[#6b7280] hover:bg-[#16161f]/60 hover:text-[#d1d5db]"
                }`}
              >
                <span className="block font-medium">{ph.name}</span>
                <span className="text-xs text-[#4b5563]">
                  {ph.duration_days} days
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 overflow-auto pb-28">
          <div className="border-b border-[#1e293b] bg-[#12121a]/80 px-6 py-4">
            <div className="flex flex-wrap gap-2">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    tab === t.id
                      ? "bg-[#22d3ee]/15 text-[#22d3ee]"
                      : "text-[#6b7280] hover:text-[#d1d5db]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 md:p-8">
            {tab === "architecture" && (
              <div className="space-y-10">
                {(plan.phases ?? []).map((ph) => {
                  const maps = (plan.architecture_mappings ?? []).filter(
                    (m) => m.phase_id === ph.id
                  );
                  return (
                    <section
                      key={ph.id}
                      ref={(el) => {
                        archRefs.current[ph.id] = el;
                      }}
                      className="scroll-mt-6"
                    >
                      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#6b7280]">
                        {ph.name}
                      </h2>
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {maps.map((m, idx) => (
                          <div
                            key={`${ph.id}-${idx}`}
                            className="flex flex-col rounded-xl border border-[#1e293b] bg-[#12121a] p-4"
                          >
                            <div className="flex flex-1 items-center gap-3">
                              <span className="flex-1 text-sm font-medium text-[#d1d5db]">
                                {m.gcp}
                              </span>
                              <ArrowRight
                                className="size-4 shrink-0 text-[#4b5563]"
                                aria-hidden
                              />
                              <span className="flex-1 text-sm font-medium text-[#d1d5db]">
                                {m.aws}
                              </span>
                            </div>
                            <div className="mt-3">
                              <Badge variant={confidenceVariant(m.confidence)}>
                                {m.confidence}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}

            {tab === "timeline" && (
              <div>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#6b7280]">
                  Phase durations (days)
                </h2>
                <ChartWrapper height={320}>
                  <BarChart data={timelineData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" />
                    <XAxis type="number" tick={chart.axisTick} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={148}
                      tick={chart.axisTick}
                    />
                    <Tooltip contentStyle={chart.tooltipStyle} />
                    <Bar dataKey="days" radius={[0, 4, 4, 0]}>
                      {timelineData.map((e, i) => (
                        <Cell key={i} fill={e.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartWrapper>
              </div>
            )}

            {tab === "cost" && (
              <div className="space-y-8">
                <div className="grid gap-4 sm:grid-cols-3">
                  <MetricCard
                    label="Current monthly (est.)"
                    value={`$${currentMonthly.toLocaleString()}`}
                  />
                  <MetricCard
                    label="Projected monthly"
                    value={`$${projectedMonthly.toLocaleString()}`}
                  />
                  <MetricCard
                    label="Delta"
                    value={`+$${plan.estimated_cost_delta}/mo`}
                    accentBorder
                  />
                </div>
                <div>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#6b7280]">
                    Before vs after by category
                  </h2>
                  <ChartWrapper height={300}>
                    <BarChart data={categories}>
                      <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" />
                      <XAxis dataKey="category" tick={chart.axisTick} />
                      <YAxis tick={chart.axisTick} />
                      <Tooltip contentStyle={chart.tooltipStyle} />
                      <Legend wrapperStyle={{ color: chart.legendColor }} />
                      <Bar
                        dataKey="before"
                        name="Current"
                        fill="#6b7280"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="after"
                        name="Projected"
                        fill="#22d3ee"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ChartWrapper>
                </div>
                <div>
                  <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#6b7280]">
                    Cost trend (illustrative)
                  </h2>
                  <ChartWrapper height={260}>
                    <AreaChart
                      data={[
                        { m: "M1", gcp: 7200, aws: 7400 },
                        { m: "M2", gcp: 7300, aws: 7520 },
                        { m: "M3", gcp: 7280, aws: 7680 },
                        { m: "M4", gcp: 7350, aws: 7750 },
                        { m: "M5", gcp: 7400, aws: 7820 },
                        { m: "M6", gcp: 7420, aws: 7922 },
                      ]}
                    >
                      <defs>
                        <linearGradient id="planCostCyan" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" />
                      <XAxis dataKey="m" tick={chart.axisTick} />
                      <YAxis tick={chart.axisTick} />
                      <Tooltip contentStyle={chart.tooltipStyle} />
                      <Area
                        type="monotone"
                        dataKey="gcp"
                        name="GCP baseline"
                        stroke="#6b7280"
                        fill="transparent"
                        strokeDasharray="4 4"
                      />
                      <Area
                        type="monotone"
                        dataKey="aws"
                        name="AWS projected"
                        stroke="#22d3ee"
                        fill="url(#planCostCyan)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ChartWrapper>
                </div>
              </div>
            )}

            {tab === "risks" && (
              <div className="space-y-3">
                <p className="text-sm text-[#6b7280]">
                  {plan.risk_count_high} high-severity items require review before
                  execution.
                </p>
                {(plan.risks ?? []).map((risk) => (
                  <div
                    key={risk.id}
                    className="rounded-lg border border-[#1e293b] bg-[#12121a] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={riskVariant(risk.severity)}>
                        {risk.severity}
                      </Badge>
                      <span className="font-medium text-[#d1d5db]">
                        {risk.title}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#9ca3af]">
                      {risk.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#1e293b] bg-[#12121a]/95 px-4 py-4 backdrop-blur-md md:left-[240px]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={async () => {
              const sid = useSessionStore.getState().sessionId;
              try {
                await fetch(
                  `${API_BASE}/pipeline/plan/${encodeURIComponent(plan.plan_id)}/reject`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...authHeaders(),
                    },
                    body: JSON.stringify({ session_id: sid }),
                  }
                );
              } catch {
                /* still navigate */
              }
              navigate("/app/onboarding");
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ef4444]/40 px-4 py-2.5 text-sm font-medium text-[#ef4444] transition-colors hover:bg-[#ef4444]/10"
          >
            <Ban className="size-4" aria-hidden />
            Reject
          </button>
          <button
            type="button"
            onClick={() => setChangesOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#1e293b] px-4 py-2.5 text-sm font-medium text-[#d1d5db] transition-colors hover:border-[#22d3ee]/50"
          >
            <MessageSquare className="size-4" aria-hidden />
            Request changes
          </button>
          <button
            type="button"
            onClick={async () => {
              const sid = useSessionStore.getState().sessionId;
              try {
                await fetch(
                  `${API_BASE}/pipeline/plan/${encodeURIComponent(plan.plan_id)}/approve`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...authHeaders(),
                    },
                    body: JSON.stringify({ session_id: sid }),
                  }
                );
              } catch {
                /* still navigate */
              }
              navigate("/app/execution");
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#00d4aa] px-5 py-2.5 text-sm font-semibold text-[#0a0a0f] shadow-lg shadow-[#00d4aa]/20 transition-opacity hover:opacity-90"
          >
            <ThumbsUp className="size-4" aria-hidden />
            Approve plan
          </button>
        </div>
      </div>

      {changesOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="changes-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#1e293b] bg-[#12121a] p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <h2 id="changes-title" className="text-lg font-semibold text-[#d1d5db]">
                Request changes
              </h2>
              <button
                type="button"
                onClick={() => setChangesOpen(false)}
                className="rounded-lg p-1 text-[#6b7280] hover:bg-[#16161f] hover:text-[#d1d5db]"
                aria-label="Close"
              >
                <X className="size-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-[#6b7280]">
              Describe what should be adjusted in the migration plan. Your team
              will be notified.
            </p>
            <textarea
              value={changesText}
              onChange={(e) => setChangesText(e.target.value)}
              rows={5}
              className="mt-4 w-full rounded-lg border border-[#1e293b] bg-[#0a0a0f] px-3 py-2 text-sm text-[#d1d5db] placeholder:text-[#4b5563] focus:border-[#22d3ee] focus:outline-none focus:ring-1 focus:ring-[#22d3ee]/40"
              placeholder="e.g. Delay database cutover by one week; add read replica in us-west-2…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setChangesOpen(false)}
                className="rounded-lg border border-[#1e293b] px-4 py-2 text-sm text-[#d1d5db] hover:border-[#22d3ee]/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const sid = useSessionStore.getState().sessionId;
                  try {
                    await fetch(
                      `${API_BASE}/pipeline/plan/${encodeURIComponent(plan.plan_id)}/modify`,
                      {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          ...authHeaders(),
                        },
                        body: JSON.stringify({
                          notes: changesText,
                          session_id: sid,
                        }),
                      }
                    );
                  } catch {
                    /* ignore */
                  }
                  setChangesOpen(false);
                  setChangesText("");
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#22d3ee] px-4 py-2 text-sm font-semibold text-[#0a0a0f]"
              >
                <Send className="size-4" aria-hidden />
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
