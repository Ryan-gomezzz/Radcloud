import { create } from "zustand";
import { analyzeInfrastructure } from "../api";

export const PIPELINE_AGENTS = [
  "discovery",
  "mapping",
  "risk",
  "finops",
  "watchdog",
  "planner",
];

export const useAnalysisStore = create((set, get) => ({
  onboardingComplete: false,
  chatStep: "welcome",
  userGoal: null,
  sourceCloud: "gcp",
  targetCloud: "aws",
  hasExistingAWS: null,
  terraformConfig: "",
  billingCSV: null,
  billingFileName: null,
  useSampleInfra: false,
  useSampleBilling: false,
  analysisStatus: "idle",
  currentAgent: null,
  completedAgents: [],
  results: null,
  chatMessages: [],

  addMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, { id: crypto.randomUUID(), ...msg }],
    })),

  setUserGoal: (g) => set({ userGoal: g }),
  setHasExistingAWS: (v) => set({ hasExistingAWS: v }),
  setTerraformConfig: (t) => set({ terraformConfig: t, useSampleInfra: false }),
  setBillingCSV: (file, name) =>
    set({
      billingCSV: file,
      billingFileName: name,
      useSampleBilling: false,
    }),
  setUseSampleInfra: (v) => set({ useSampleInfra: v }),
  setUseSampleBilling: (v) => set({ useSampleBilling: v }),
  setChatStep: (step) => set({ chatStep: step }),
  setResults: (results) => set({ results, onboardingComplete: true }),

  runAnalysis: async () => {
    const { terraformConfig, billingCSV } = get();
    const formData = new FormData();
    formData.append("terraform_config", terraformConfig || "");
    if (billingCSV) {
      formData.append("billing_csv", billingCSV);
    }
    set({ analysisStatus: "running" });
    try {
      const data = await analyzeInfrastructure(formData);
      try {
        const pid = data?.migration_plan?.plan_id;
        if (pid) {
          sessionStorage.setItem(`radcloud_plan_${pid}`, JSON.stringify(data.migration_plan));
        }
      } catch {
        /* ignore */
      }
      set({
        results: data,
        analysisStatus: "complete",
        onboardingComplete: true,
      });
      return data;
    } catch (e) {
      set({ analysisStatus: "error" });
      throw e;
    }
  },

  resetForNewAnalysis: () =>
    set({
      onboardingComplete: false,
      chatStep: "welcome",
      userGoal: null,
      hasExistingAWS: null,
      terraformConfig: "",
      billingCSV: null,
      billingFileName: null,
      useSampleInfra: false,
      useSampleBilling: false,
      analysisStatus: "idle",
      currentAgent: null,
      completedAgents: [],
      results: null,
      chatMessages: [],
    }),
}));
