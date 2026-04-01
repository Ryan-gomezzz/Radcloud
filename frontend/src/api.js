import cachedResponse from "./data/cachedResponse.json";

/** Empty in production (same origin); set VITE_API_URL=http://localhost:8000 for dev without proxy */
const API_BASE = import.meta.env.VITE_API_URL ?? "";
const VITE_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

const DEMO_MIGRATION_PLAN = {
  plan_id: "plan-demo-001",
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
  architecture_mappings: [],
  cost_categories: [
    { category: "Compute", before: 4200, after: 4512 },
    { category: "Database", before: 1800, after: 1950 },
    { category: "Storage", before: 890, after: 920 },
    { category: "Networking", before: 640, after: 710 },
    { category: "Other", before: 310, after: 330 },
  ],
  risks: [],
};

/** JWT from signup/login for authenticated API calls. */
export function authHeaders() {
  try {
    const t = localStorage.getItem("radcloud_token");
    if (t) return { Authorization: `Bearer ${t}` };
  } catch {
    /* ignore */
  }
  return {};
}

function mergeMigrationPlan(data) {
  if (data?.migration_plan) return data;
  return { ...data, migration_plan: DEMO_MIGRATION_PLAN };
}

/**
 * GET /sample-data — Terraform + billing CSV text for demo flow.
 */
export async function getSampleData() {
  if (VITE_DEMO) {
    const [tfRes, csvRes] = await Promise.all([
      fetch("/demo/sample.tf"),
      fetch("/demo/sample_billing.csv"),
    ]);
    if (!tfRes.ok || !csvRes.ok) {
      throw new Error("Could not load bundled sample data");
    }
    return {
      terraform: await tfRes.text(),
      billing_csv: await csvRes.text(),
    };
  }

  try {
    const response = await fetch(`${API_BASE}/sample-data`, {
      headers: { ...authHeaders() },
    });
    if (!response.ok) {
      throw new Error(`sample-data failed: ${response.status}`);
    }
    return await response.json();
  } catch {
    const [tfRes, csvRes] = await Promise.all([
      fetch("/demo/sample.tf"),
      fetch("/demo/sample_billing.csv"),
    ]);
    if (tfRes.ok && csvRes.ok) {
      return {
        terraform: await tfRes.text(),
        billing_csv: await csvRes.text(),
      };
    }
    throw new Error("Could not load sample data");
  }
}

/**
 * POST /analyze with FormData: terraform_config, optional billing_csv.
 */
export async function analyzeInfrastructure(formData) {
  if (VITE_DEMO) {
    const tf = formData.get("terraform_config");
    return mergeMigrationPlan({
      ...cachedResponse,
      demo_mode: true,
      client_demo: true,
      gcp_config_raw: typeof tf === "string" ? tf : "",
    });
  }

  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { ...authHeaders() },
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    const json = await response.json();
    return mergeMigrationPlan(json);
  } catch {
    const tf = formData.get("terraform_config");
    return mergeMigrationPlan({
      ...cachedResponse,
      demo_mode: true,
      client_fallback: true,
      gcp_config_raw: typeof tf === "string" ? tf : cachedResponse.gcp_config_raw,
      errors: [
        ...(cachedResponse.errors || []),
        {
          agent: "client",
          error: "API unreachable — showing cached demo response.",
        },
      ],
    });
  }
}

export { API_BASE, VITE_DEMO };
