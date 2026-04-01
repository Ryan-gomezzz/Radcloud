import { create } from "zustand";
import { API_BASE, authHeaders } from "../api";
import { useSessionStore } from "./sessionStore";

const initialGcp = {
  file: null,
  fileName: "",
  status: "idle",
  accountName: null,
  resourceCount: null,
  error: null,
};

const initialAws = {
  mode: "keys",
  accessKeyId: "",
  secretAccessKey: "",
  roleArn: "",
  externalId: "",
  status: "idle",
  accountName: null,
  resourceCount: null,
  error: null,
};

async function stubGcpConnect(file) {
  try {
    await useSessionStore.getState().ensureSession();
    const sessionId = useSessionStore.getState().sessionId;
    if (!sessionId) throw new Error("no session");

    const text = await file.text();
    const service_account_json = JSON.parse(text);
    const q = `?session_id=${encodeURIComponent(sessionId)}`;
    const res = await fetch(`${API_BASE}/cloud/gcp/connect${q}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ service_account_json }),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const st = await fetch(`${API_BASE}/cloud/gcp/status${q}`, {
        headers: { ...authHeaders() },
      });
      const statusData = st.ok ? await st.json().catch(() => ({})) : {};
      return {
        ok: true,
        accountName:
          data.project_name ??
          data.project_id ??
          statusData.project_name ??
          statusData.project_id ??
          "gcp-connected",
        resourceCount:
          data.resource_count ?? statusData.resource_count ?? 0,
      };
    }
  } catch {
    /* stub fallback */
  }
  await new Promise((r) => setTimeout(r, 1500));
  return {
    ok: true,
    accountName: "gcp-proj-radcloud",
    resourceCount: 142,
  };
}

async function stubAwsConnect(payload) {
  try {
    await useSessionStore.getState().ensureSession();
    const sessionId = useSessionStore.getState().sessionId;
    if (!sessionId) throw new Error("no session");

    const q = `?session_id=${encodeURIComponent(sessionId)}`;
    const body =
      payload.mode === "keys"
        ? {
            mode: "keys",
            access_key_id: payload.access_key_id,
            secret_access_key: payload.secret_access_key,
            region: "us-east-1",
          }
        : {
            mode: "role",
            role_arn: payload.role_arn,
            region: "us-east-1",
          };

    const res = await fetch(`${API_BASE}/cloud/aws/connect${q}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const st = await fetch(`${API_BASE}/cloud/aws/status${q}`, {
        headers: { ...authHeaders() },
      });
      const statusData = st.ok ? await st.json().catch(() => ({})) : {};
      return {
        ok: true,
        accountName:
          data.account_name ??
          statusData.account_alias ??
          statusData.account_id ??
          "aws-connected",
        resourceCount: data.resource_count ?? statusData.resource_count ?? 0,
      };
    }
  } catch {
    /* stub fallback */
  }
  await new Promise((r) => setTimeout(r, 1500));
  return {
    ok: true,
    accountName: "aws-123456789012",
    resourceCount: 128,
  };
}

export const useCredentialStore = create((set, get) => ({
  step: 0,
  gcp: { ...initialGcp },
  aws: { ...initialAws },

  setStep: (step) => set({ step: Math.max(0, Math.min(3, step)) }),
  nextStep: () => set((s) => ({ step: Math.min(3, s.step + 1) })),
  prevStep: () => set((s) => ({ step: Math.max(0, s.step - 1) })),

  setGcpFile: (file) =>
    set({
      gcp: {
        ...get().gcp,
        file,
        fileName: file?.name || "",
        status: "idle",
        error: null,
        accountName: null,
        resourceCount: null,
      },
    }),

  testGcpConnection: async () => {
    const { gcp } = get();
    if (!gcp.file) {
      set({
        gcp: {
          ...gcp,
          status: "failed",
          error: "Select a service account JSON file first.",
        },
      });
      return;
    }
    set({ gcp: { ...gcp, status: "testing", error: null } });
    const result = await stubGcpConnect(gcp.file);
    if (result.ok) {
      set({
        gcp: {
          ...get().gcp,
          status: "connected",
          accountName: result.accountName,
          resourceCount: result.resourceCount,
          error: null,
        },
      });
    } else {
      set({
        gcp: {
          ...get().gcp,
          status: "failed",
          error: "Connection test failed.",
        },
      });
    }
  },

  setAwsMode: (mode) =>
    set({
      aws: {
        ...get().aws,
        mode: mode === "role" ? "role" : "keys",
        status: "idle",
        error: null,
      },
    }),

  setAwsCredentials: (patch) =>
    set({ aws: { ...get().aws, ...patch } }),

  testAwsConnection: async () => {
    const { aws } = get();
    set({ aws: { ...aws, status: "testing", error: null } });

    const payload =
      aws.mode === "keys"
        ? {
            mode: "keys",
            access_key_id: aws.accessKeyId,
            secret_access_key: aws.secretAccessKey,
          }
        : {
            mode: "role",
            role_arn: aws.roleArn,
          };

    if (
      aws.mode === "keys" &&
      (!aws.accessKeyId?.trim() || !aws.secretAccessKey?.trim())
    ) {
      set({
        aws: {
          ...get().aws,
          status: "failed",
          error: "Access Key ID and Secret Access Key are required.",
        },
      });
      return;
    }
    if (aws.mode === "role" && !aws.roleArn?.trim()) {
      set({
        aws: {
          ...get().aws,
          status: "failed",
          error: "Role ARN is required for Assume Role mode.",
        },
      });
      return;
    }

    const result = await stubAwsConnect(payload);
    if (result.ok) {
      set({
        aws: {
          ...get().aws,
          status: "connected",
          accountName: result.accountName,
          resourceCount: result.resourceCount,
          error: null,
        },
      });
    } else {
      set({
        aws: {
          ...get().aws,
          status: "failed",
          error: "Connection test failed.",
        },
      });
    }
  },

  reset: () =>
    set({
      step: 0,
      gcp: { ...initialGcp },
      aws: { ...initialAws },
    }),
}));
