import { create } from "zustand";

let simIntervalId = null;
let progressIntervalId = null;

const STAGE_DEFS = [
  { id: "discovery", label: "Discovery" },
  { id: "plan_approval", label: "Plan Approval" },
  { id: "tf_plan", label: "Terraform Plan" },
  { id: "tf_apply", label: "Terraform Apply" },
  { id: "data_migration", label: "Data Migration" },
  { id: "verification", label: "Verification" },
];

function emptyStages() {
  return STAGE_DEFS.map((d) => ({
    id: d.id,
    label: d.label,
    status: "pending",
    startedAt: null,
    completedAt: null,
    logs: [],
  }));
}

function logLine(stageIndex, lineIndex) {
  const templates = [
    ["[discovery] Scanning GCP projects…", "[discovery] Listing Compute instances…", "[discovery] Parsing IAM bindings…", "[discovery] Inventory snapshot complete."],
    ["[plan] Loading approved migration plan…", "[plan] Validating scope with stakeholders…", "[plan] Plan checksum verified.", "[plan] Gate cleared — proceeding to IaC."],
    ["[terraform] Initializing backend s3…", "[terraform] Running terraform plan…", "[terraform] Plan artifact stored.", "[terraform] Awaiting human approval."],
    ["[terraform] Plan approved — preparing apply…", "[terraform] Applying module.vpc…", "[terraform] Apply staged — confirmation required.", "[terraform] Awaiting apply approval."],
    ["[migrate] Starting DMS replication task…", "[migrate] Bulk load phase 2…", "[migrate] Storage sync job running…", "[migrate] Validating row counts…", "[migrate] Cutover window scheduled…", "[migrate] Replication steady state."],
    ["[verify] Running smoke tests…", "[verify] DNS propagation check…", "[verify] Cost anomaly scan…", "[verify] Execution complete."],
  ];
  const lines = templates[stageIndex] || ["tick"];
  return lines[Math.min(lineIndex, lines.length - 1)] ?? `[stage ${stageIndex}] …`;
}

const initialDb = {
  progress: 0,
  replicationLag: 240,
  rowsMigrated: 0,
  totalRows: 48_000_000,
};

const initialStorage = {
  transferredGB: 0,
  totalGB: 820,
  transferRate: 185,
  throughputHistory: [],
};

export const useExecutionStore = create((set, get) => ({
  stages: emptyStages(),
  activeStageIndex: 0,
  approvalGate: null,
  dbMigration: { ...initialDb },
  dataMigration: { ...initialStorage },
  simulationRunning: false,

  reset: () => {
    if (simIntervalId) {
      window.clearInterval(simIntervalId);
      simIntervalId = null;
    }
    if (progressIntervalId) {
      window.clearInterval(progressIntervalId);
      progressIntervalId = null;
    }
    set({
      stages: emptyStages(),
      activeStageIndex: 0,
      approvalGate: null,
      dbMigration: { ...initialDb },
      dataMigration: { ...initialStorage },
      simulationRunning: false,
    });
  },

  stopSimulation: () => {
    if (simIntervalId) {
      window.clearInterval(simIntervalId);
      simIntervalId = null;
    }
    if (progressIntervalId) {
      window.clearInterval(progressIntervalId);
      progressIntervalId = null;
    }
    set({ simulationRunning: false });
  },

  appendLog: (stageIndex, line) =>
    set((s) => {
      const stages = s.stages.map((st, i) =>
        i === stageIndex ? { ...st, logs: [...st.logs, line] } : st
      );
      return { stages };
    }),

  approveGate: () => {
    const { stages, activeStageIndex, approvalGate } = get();
    if (!approvalGate?.visible) return;

    const idx = activeStageIndex;
    const stage = stages[idx];
    if (stage.status !== "awaiting_approval") return;

    const nextStages = stages.map((st, i) =>
      i === idx
        ? { ...st, status: "completed", completedAt: Date.now() }
        : st
    );
    const next = idx + 1;
    if (next >= nextStages.length) {
      set({ stages: nextStages, approvalGate: null, simulationRunning: false });
      if (simIntervalId) {
        window.clearInterval(simIntervalId);
        simIntervalId = null;
      }
      if (progressIntervalId) {
        window.clearInterval(progressIntervalId);
        progressIntervalId = null;
      }
      return;
    }
    nextStages[next] = {
      ...nextStages[next],
      status: "running",
      startedAt: Date.now(),
    };
    set({
      stages: nextStages,
      activeStageIndex: next,
      approvalGate: null,
    });
  },

  rejectGate: () => {
    const { activeStageIndex, stages } = get();
    const idx = activeStageIndex;
    const nextStages = stages.map((st, i) =>
      i === idx ? { ...st, status: "failed", completedAt: Date.now() } : st
    );
    set({ stages: nextStages, approvalGate: null, simulationRunning: false });
    if (simIntervalId) {
      window.clearInterval(simIntervalId);
      simIntervalId = null;
    }
    if (progressIntervalId) {
      window.clearInterval(progressIntervalId);
      progressIntervalId = null;
    }
  },

  updateDbProgress: () =>
    set((s) => {
      if (s.activeStageIndex !== 4) return s;
      const jitter = () => (Math.random() > 0.5 ? -3 : 5);
      const nextProgress = Math.min(100, s.dbMigration.progress + 0.9);
      const nextLag = Math.max(
        8,
        Math.min(400, s.dbMigration.replicationLag + jitter())
      );
      const batch = 15_000 + Math.floor(Math.random() * 8000);
      const nextRows = Math.min(
        s.dbMigration.totalRows,
        s.dbMigration.rowsMigrated + batch
      );
      return {
        dbMigration: {
          ...s.dbMigration,
          progress: nextProgress,
          replicationLag: nextLag,
          rowsMigrated: nextRows,
        },
      };
    }),

  updateStorageProgress: () =>
    set((s) => {
      if (s.activeStageIndex !== 4) return s;
      const addGb = 0.12 + Math.random() * 0.08;
      const nextT = Math.min(
        s.dataMigration.totalGB,
        s.dataMigration.transferredGB + addGb
      );
      const mbps = 160 + Math.random() * 55;
      const point = { t: Date.now(), mbps: Math.round(mbps) };
      const throughputHistory = [
        ...s.dataMigration.throughputHistory.slice(-29),
        point,
      ];
      return {
        dataMigration: {
          ...s.dataMigration,
          transferredGB: nextT,
          transferRate: Math.round(mbps),
          throughputHistory,
        },
      };
    }),

  _simTick: () => {
    const state = get();
    if (!state.simulationRunning) return;
    if (state.approvalGate?.visible) return;

    const idx = state.activeStageIndex;
    const stages = [...state.stages];
    const stage = stages[idx];
    if (!stage) return;

    if (stage.status === "pending") {
      stages[idx] = {
        ...stage,
        status: "running",
        startedAt: Date.now(),
      };
      set({ stages });
      return;
    }

    if (stage.status === "awaiting_approval") {
      return;
    }

    if (stage.status === "failed" || stage.status === "completed") {
      return;
    }

    if (stage.status !== "running") return;

    const line = logLine(idx, stage.logs.length);
    const logs = [...stage.logs, line];

    const needGate =
      (idx === 2 && logs.length >= 3) || (idx === 3 && logs.length >= 3);
    if (needGate) {
      stages[idx] = {
        ...stage,
        logs,
        status: "awaiting_approval",
      };
      set({
        stages,
        approvalGate: {
          visible: true,
          message:
            idx === 2
              ? "Review Terraform plan output before apply."
              : "Confirm apply to production account.",
          costDelta: 312,
          resourceCount: 28,
        },
      });
      return;
    }

    const linesNeeded =
      idx === 0 || idx === 1
        ? 4
        : idx === 4
          ? 6
          : idx === 5
            ? 4
            : 10;

    if (logs.length < linesNeeded) {
      stages[idx] = { ...stage, logs };
      set({ stages });
      return;
    }

    stages[idx] = {
      ...stage,
      logs,
      status: "completed",
      completedAt: Date.now(),
    };
    const next = idx + 1;
    if (next >= stages.length) {
      set({ stages, simulationRunning: false });
      if (simIntervalId) {
        window.clearInterval(simIntervalId);
        simIntervalId = null;
      }
      if (progressIntervalId) {
        window.clearInterval(progressIntervalId);
        progressIntervalId = null;
      }
      return;
    }
    stages[next] = {
      ...stages[next],
      status: "running",
      startedAt: Date.now(),
    };
    set({ stages, activeStageIndex: next });
  },

  startExecution: () => {
    get().reset();
    const stages = emptyStages();
    stages[0] = {
      ...stages[0],
      status: "running",
      startedAt: Date.now(),
    };
    set({
      stages,
      activeStageIndex: 0,
      approvalGate: null,
      dbMigration: { ...initialDb },
      dataMigration: { ...initialStorage },
      simulationRunning: true,
    });

    if (simIntervalId) window.clearInterval(simIntervalId);
    simIntervalId = window.setInterval(() => get()._simTick(), 800);

    if (progressIntervalId) window.clearInterval(progressIntervalId);
    progressIntervalId = window.setInterval(() => {
      const s = get();
      if (s.activeStageIndex === 4 && s.simulationRunning) {
        get().updateDbProgress();
        get().updateStorageProgress();
      }
    }, 500);
  },

  /** Apply a single SSE event from POST /execution/start stream (server-driven run). */
  ingestSSE: (data) => {
    if (!data || typeof data !== "object") return;
    if (data.type === "log" && typeof data.stageIndex === "number") {
      get().appendLog(data.stageIndex, data.line ?? "");
      return;
    }
    if (data.type === "stage") {
      const idx = data.stageIndex;
      const status = data.status;
      set((s) => {
        const stages = s.stages.map((st, i) => {
          if (i === idx && status === "running") {
            return { ...st, status: "running", startedAt: st.startedAt ?? Date.now() };
          }
          if (i === idx && status === "completed") {
            return { ...st, status: "completed", completedAt: Date.now() };
          }
          return st;
        });
        return { stages, activeStageIndex: idx ?? s.activeStageIndex };
      });
      return;
    }
    if (data.type === "gate") {
      set((s) => {
        const stages = s.stages.map((st, i) =>
          i === data.stageIndex ? { ...st, status: "awaiting_approval" } : st
        );
        return {
          stages,
          activeStageIndex: data.stageIndex,
          approvalGate: {
            visible: true,
            message: data.message ?? "Approval required",
            costDelta: data.costDelta ?? 0,
            resourceCount: data.resourceCount ?? 0,
          },
          simulationRunning: true,
        };
      });
      return;
    }
    if (data.type === "db") {
      set((s) => ({
        dbMigration: {
          ...s.dbMigration,
          progress: data.progress ?? s.dbMigration.progress,
          replicationLag: data.replicationLag ?? s.dbMigration.replicationLag,
          rowsMigrated: data.rowsMigrated ?? s.dbMigration.rowsMigrated,
          totalRows: data.totalRows ?? s.dbMigration.totalRows,
        },
      }));
      return;
    }
    if (data.type === "storage") {
      set((s) => {
        const mbps = data.transferRate ?? s.dataMigration.transferRate;
        const point = { t: Date.now(), mbps: Math.round(mbps) };
        return {
          dataMigration: {
            ...s.dataMigration,
            transferredGB: data.transferredGB ?? s.dataMigration.transferredGB,
            totalGB: data.totalGB ?? s.dataMigration.totalGB,
            transferRate: Math.round(mbps),
            throughputHistory: [
              ...s.dataMigration.throughputHistory.slice(-29),
              point,
            ],
          },
        };
      });
      return;
    }
    if (data.type === "complete" || data.type === "failed") {
      get().stopSimulation();
      set({ simulationRunning: false, approvalGate: null });
    }
  },

  /** Start from a clean slate for SSE without local interval simulation. */
  startServerExecutionShell: () => {
    if (simIntervalId) {
      window.clearInterval(simIntervalId);
      simIntervalId = null;
    }
    if (progressIntervalId) {
      window.clearInterval(progressIntervalId);
      progressIntervalId = null;
    }
    const stages = emptyStages();
    set({
      stages,
      activeStageIndex: 0,
      approvalGate: null,
      dbMigration: { ...initialDb },
      dataMigration: { ...initialStorage },
      simulationRunning: true,
    });
  },
}));
