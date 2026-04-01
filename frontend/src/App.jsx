import { useCallback, useEffect, useState } from "react";
import { InputPanel } from "./components/InputPanel";
import { StatusBar } from "./components/StatusBar";
import { ResultsPanel } from "./components/ResultsPanel";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const PIPELINE_KEYS = ["discovery", "mapping", "risk", "finops", "runbook", "watchdog"];

async function loadSampleTerraform() {
  const r = await fetch("/demo/sample.tf");
  if (!r.ok) throw new Error("Could not load sample Terraform");
  return r.text();
}

async function loadSampleBillingFile() {
  const r = await fetch("/demo/sample_billing.csv");
  if (!r.ok) throw new Error("Could not load sample billing CSV");
  const text = await r.text();
  return new File([text], "sample_billing.csv", { type: "text/csv" });
}

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [completedAgents, setCompletedAgents] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleTrySample = useCallback(async (setTerraform, setBillingFile) => {
    setError(null);
    try {
      const [tf, billing] = await Promise.all([
        loadSampleTerraform(),
        loadSampleBillingFile(),
      ]);
      setTerraform(tf);
      setBillingFile(billing);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }, []);

  useEffect(() => {
    if (!isLoading) return undefined;
    let step = 0;
    setCurrentAgent(PIPELINE_KEYS[0]);
    setCompletedAgents([]);
    const id = window.setInterval(() => {
      step += 1;
      if (step < PIPELINE_KEYS.length) {
        setCompletedAgents(PIPELINE_KEYS.slice(0, step));
        setCurrentAgent(PIPELINE_KEYS[step]);
      }
    }, 750);
    return () => window.clearInterval(id);
  }, [isLoading]);

  const handleAnalyze = async (formData) => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setCompletedAgents([]);
    setCurrentAgent("discovery");

    try {
      const response = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const data = await response.json();
      setResult(data);
      setCompletedAgents(PIPELINE_KEYS);
      setCurrentAgent(null);
    } catch (e) {
      setError(e.message ?? String(e));
      setCurrentAgent(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-blue-950 px-4 py-6 text-white shadow-md">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">RADCloud</h1>
          <p className="mt-1 text-sm text-blue-100">
            Migration-native FinOps — orchestrated analysis pipeline
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <InputPanel
          onSubmit={handleAnalyze}
          isLoading={isLoading}
          onTrySample={handleTrySample}
        />

        <section aria-label="Pipeline status">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </h2>
          <StatusBar currentAgent={currentAgent} completedAgents={completedAgents} />
        </section>

        {error && (
          <div
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {error}
          </div>
        )}

        {result?.errors?.length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Partial run — agent errors</p>
            <ul className="mt-2 list-inside list-disc">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.agent}: {e.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <section aria-label="Results">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Results
          </h2>
          <ResultsPanel result={result} />
        </section>
      </main>
    </div>
  );
}
