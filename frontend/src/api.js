import cachedResponse from "./data/cachedResponse.json";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const VITE_DEMO = import.meta.env.VITE_DEMO_MODE === "true";

/**
 * POST /analyze with FormData. Uses cached JSON when VITE_DEMO_MODE=true or on network failure.
 */
export async function analyzeInfrastructure(formData) {
  if (VITE_DEMO) {
    return { ...cachedResponse, demo_mode: true, client_demo: true };
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
    return {
      ...cachedResponse,
      demo_mode: true,
      client_fallback: true,
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
