import { useCallback, useEffect, useRef, useState } from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { useExecutionStore } from "../../stores/executionStore";
import { useSSE } from "../../hooks/useSSE";
import { API_BASE, authHeaders } from "../../api";
import { Badge } from "../shared/Badge";
import { useChartTheme } from "../../hooks/useChartTheme";

function formatDuration(ms) {
  if (ms == null || ms <= 0) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function StageDot({ status }) {
  const base = "size-2.5 shrink-0 rounded-full";
  if (status === "completed")
    return <span className={`${base} bg-[#00d4aa]`} aria-hidden />;
  if (status === "failed")
    return <span className={`${base} bg-[#ef4444]`} aria-hidden />;
  if (status === "awaiting_approval")
    return <span className={`${base} bg-[#fbbf24]`} aria-hidden />;
  if (status === "running")
    return (
      <span
        className={`${base} bg-[#22d3ee] shadow-[0_0_10px_rgba(34,211,238,0.7)] animate-pulse`}
        aria-hidden
      />
    );
  return <span className={`${base} bg-[#4b5563]`} aria-hidden />;
}

export function ExecutionDashboard() {
  const chart = useChartTheme();
  const logEndRef = useRef(null);
  const terminalRef = useRef(null);
  const executionIdRef = useRef(null);
  const fallbackOnceRef = useRef(false);

  const [sseUrl, setSseUrl] = useState("");

  const stages = useExecutionStore((s) => s.stages);
  const activeStageIndex = useExecutionStore((s) => s.activeStageIndex);
  const approvalGate = useExecutionStore((s) => s.approvalGate);
  const dbMigration = useExecutionStore((s) => s.dbMigration);
  const dataMigration = useExecutionStore((s) => s.dataMigration);
  const simulationRunning = useExecutionStore((s) => s.simulationRunning);
  const startExecution = useExecutionStore((s) => s.startExecution);
  const startServerExecutionShell = useExecutionStore((s) => s.startServerExecutionShell);
  const ingestSSE = useExecutionStore((s) => s.ingestSSE);
  const approveGate = useExecutionStore((s) => s.approveGate);
  const rejectGate = useExecutionStore((s) => s.rejectGate);
  const reset = useExecutionStore((s) => s.reset);

  const handleApprove = useCallback(async () => {
    const id = executionIdRef.current;
    const tok =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("radcloud_token")
        : null;
    if (id && tok) {
      await fetch(`${API_BASE}/execution/${id}/approve`, {
        method: "POST",
        headers: { ...authHeaders() },
      });
      return;
    }
    approveGate();
  }, [approveGate]);

  const handleReject = useCallback(async () => {
    const id = executionIdRef.current;
    const tok =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("radcloud_token")
        : null;
    if (id && tok) {
      await fetch(`${API_BASE}/execution/${id}/reject`, {
        method: "POST",
        headers: { ...authHeaders() },
      });
      return;
    }
    rejectGate();
  }, [rejectGate]);

  useSSE(sseUrl, {
    enabled: Boolean(sseUrl),
    onMessage: (data) => ingestSSE(data),
    onError: () => {
      if (fallbackOnceRef.current) return;
      fallbackOnceRef.current = true;
      executionIdRef.current = null;
      setSseUrl("");
      startExecution();
    },
  });

  useEffect(() => {
    let cancelled = false;
    fallbackOnceRef.current = false;
    executionIdRef.current = null;
    setSseUrl("");

    (async () => {
      const token =
        typeof localStorage !== "undefined"
          ? localStorage.getItem("radcloud_token")
          : null;
      if (!token) {
        if (!cancelled) startExecution();
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/execution/start`, {
          method: "POST",
          headers: { ...authHeaders() },
        });
        if (!res.ok) throw new Error("execution start failed");
        const body = await res.json();
        const eid = body.execution_id;
        if (!eid || cancelled) throw new Error("no execution id");
        executionIdRef.current = eid;
        startServerExecutionShell();
        const u = `${API_BASE}/execution/${eid}/stream?token=${encodeURIComponent(token)}`;
        setSseUrl(u);
      } catch {
        if (!cancelled) startExecution();
      }
    })();

    return () => {
      cancelled = true;
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount bootstrap
  }, []);

  const activeStage = stages[activeStageIndex];
  const logs = activeStage?.logs ?? [];
  const logCount = logs.length;

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logCount, activeStageIndex]);

  const radialData = [
    {
      name: "Progress",
      value: Math.round(dbMigration.progress),
      fill: "#22d3ee",
    },
  ];

  const storagePct =
    dataMigration.totalGB > 0
      ? Math.min(
          100,
          (dataMigration.transferredGB / dataMigration.totalGB) * 100
        )
      : 0;

  return (
    <div className="flex min-h-[calc(100vh-60px)] flex-col gap-4 bg-[#0a0a0f] p-4 md:flex-row md:p-6">
      <div className="flex w-full shrink-0 flex-col border border-[#1e293b] bg-[#12121a] md:w-[320px] md:rounded-xl">
        <div className="border-b border-[#1e293b] p-4">
          <h1 className="text-lg font-semibold text-[#d1d5db]">
            Execution
          </h1>
          <p className="mt-1 text-xs text-[#6b7280]">
            Live pipeline · simulated stream
          </p>
          {!simulationRunning && (
            <button
              type="button"
              onClick={() => {
                executionIdRef.current = null;
                setSseUrl("");
                startExecution();
              }}
              className="mt-3 rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#0a0a0f]"
            >
              Restart simulation
            </button>
          )}
        </div>
        <div className="flex-1 space-y-0 overflow-y-auto p-3">
          {stages.map((st, i) => {
            const elapsed =
              st.startedAt &&
              (st.completedAt
                ? st.completedAt - st.startedAt
                : st.status === "running" || st.status === "awaiting_approval"
                  ? Date.now() - st.startedAt
                  : null);
            const expanded = i === activeStageIndex;
            return (
              <div
                key={st.id}
                className={`border-b border-[#1e293b]/80 py-3 last:border-0 ${
                  expanded ? "bg-[#0a0a0f]/40" : ""
                }`}
              >
                <div className="flex items-start gap-3 px-1">
                  <StageDot status={st.status} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#d1d5db]">
                      {st.label}
                    </p>
                    <p className="text-[11px] text-[#6b7280]">
                      {formatDuration(elapsed)}
                    </p>
                  </div>
                </div>
                {expanded && (
                  <div
                    ref={terminalRef}
                    className="mt-3 max-h-[220px] overflow-y-auto rounded-lg border border-[#1e293b] bg-[#0a0a0f] p-3 font-mono text-[11px] leading-relaxed text-[#22d3ee]/95"
                  >
                    {logs.length === 0 && (
                      <span className="text-[#6b7280]">Waiting for output…</span>
                    )}
                    {logs.map((line, li) => (
                      <div key={li} className="text-[#94a3b8]">
                        <span className="text-[#22d3ee]">$</span> {line}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                )}
                {expanded && approvalGate?.visible && (
                  <div className="mt-3 rounded-lg border border-[#fbbf24]/35 bg-[#16161f] p-3">
                    <p className="text-xs text-[#d1d5db]">
                      Terraform will create{" "}
                      <span className="font-semibold text-[#22d3ee]">
                        {approvalGate.resourceCount}
                      </span>{" "}
                      resources. Cost delta:{" "}
                      <span className="font-semibold text-[#fbbf24]">
                        +${approvalGate.costDelta}/mo
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-[#6b7280]">
                      {approvalGate.message}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleApprove()}
                        className="rounded-lg bg-[#22d3ee] px-3 py-1.5 text-xs font-semibold text-[#0a0a0f]"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject()}
                        className="rounded-lg border border-[#ef4444]/50 px-3 py-1.5 text-xs font-medium text-[#ef4444]"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="rounded-xl border border-[#1e293b] bg-[#12121a] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#d1d5db]">
              Database migration
            </h2>
            <Badge
              variant={
                activeStageIndex >= 4 && simulationRunning
                  ? "direct"
                  : "low"
              }
            >
              {activeStageIndex >= 4 && simulationRunning
                ? "Replicating"
                : "Idle"}
            </Badge>
          </div>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="h-[180px] w-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="58%"
                  outerRadius="100%"
                  barSize={14}
                  data={radialData}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis
                    type="number"
                    domain={[0, 100]}
                    angleAxisId={0}
                    tick={false}
                  />
                  <RadialBar
                    background={{ fill: "#1e293b" }}
                    dataKey="value"
                    cornerRadius={6}
                    fill="#22d3ee"
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#6b7280]">
                  Replication lag
                </p>
                <p className="mt-1 text-xl font-bold text-[#22d3ee]">
                  {Math.round(dbMigration.replicationLag)} ms
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[#6b7280]">
                  Rows migrated
                </p>
                <p className="mt-1 font-mono text-sm text-[#d1d5db]">
                  {dbMigration.rowsMigrated.toLocaleString()} /{" "}
                  {dbMigration.totalRows.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#1e293b] bg-[#12121a] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#d1d5db]">
              Storage migration
            </h2>
            <Badge variant="info">
              {dataMigration.transferRate} MB/s
            </Badge>
          </div>
          <p className="mt-2 text-xs text-[#6b7280]">
            {dataMigration.transferredGB.toFixed(1)} GB /{" "}
            {dataMigration.totalGB} GB transferred
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#1e293b]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] to-[#00d4aa] transition-all duration-300"
              style={{ width: `${storagePct}%` }}
            />
          </div>
          <div className="mt-6 h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dataMigration.throughputHistory}>
                <defs>
                  <linearGradient id="execThroughput" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={chart.gridStroke} strokeDasharray="3 3" />
                <XAxis dataKey="t" tick={false} height={0} />
                <YAxis tick={chart.axisTick} width={36} />
                <Tooltip
                  contentStyle={chart.tooltipStyle}
                  formatter={(v) => [`${v} MB/s`, "Throughput"]}
                  labelFormatter={() => "Sample"}
                />
                <Area
                  type="monotone"
                  dataKey="mbps"
                  name="MB/s"
                  stroke="#22d3ee"
                  fill="url(#execThroughput)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
