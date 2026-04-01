import cachedResponse from "./data/cachedResponse.json";

/** Empty in production (same origin); set VITE_API_URL=http://localhost:8000 for dev without proxy */
const API_BASE = import.meta.env.VITE_API_URL ?? "";
const VITE_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

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
    const response = await fetch(`${API_BASE}/sample-data`);
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
    return {
      ...cachedResponse,
      demo_mode: true,
      client_demo: true,
      gcp_config_raw: typeof tf === "string" ? tf : "",
    };
  }

  try {
    const response = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return await response.json();
  } catch {
    const tf = formData.get("terraform_config");
    return {
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
    };
  }
}

export { API_BASE, VITE_DEMO };
