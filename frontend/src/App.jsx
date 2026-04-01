import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeInfrastructure } from "./api";
import { InputPanel } from "./components/InputPanel";
import { StatusBar } from "./components/StatusBar";
import { ResultsPanel } from "./components/ResultsPanel";
import { ExecutiveSummary } from "./components/ExecutiveSummary";

const PIPELINE_KEYS = ["discovery", "mapping", "risk", "finops", "watchdog"];

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

function Header({ showTrySample, onTrySample, resultsMode, onNewAnalysis }) {
  return (
    <header className="border-b border-[#2a2a3e] bg-[#12121a]/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-5">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-lg font-bold text-[#0a0a0f]"
            style={{
              background: "linear-gradient(135deg, #00d4aa, #4a9eff)",
            }}
          >
            R
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#f9fafb] md:text-2xl">RADCloud</h1>
            <p className="text-xs text-[#6b7280] md:text-sm">Migration-native FinOps</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {resultsMode && (
            <>
              <span className="rounded-md border border-[rgba(0,212,170,0.35)] bg-[rgba(0,212,170,0.1)] px-3 py-1.5 text-xs font-medium text-[#00d4aa]">
                Analysis complete
              </span>
              <button type="button" className="btn-outline text-sm" onClick={onNewAnalysis}>
                New analysis
              </button>
            </>
          )}
          {showTrySample && (
            <button type="button" className="btn-outline text-sm" onClick={onTrySample}>
              Try sample data
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

export default function App() {
  const [appState, setAppState] = useState("input");
  const [terraform, setTerraform] = useState("");
  const [billingFile, setBillingFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [completedAgents, setCompletedAgents] = useState([]);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [resultsRunKey, setResultsRunKey] = useState(0);
  const progressTimerRef = useRef(null);

  const clearProgressTimer = () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  };

  useEffect(() => () => clearProgressTimer(), []);

  const startProgressSimulation = useCallback(() => {
    clearProgressTimer();
    let step = 0;
    setCurrentAgent(PIPELINE_KEYS[0]);
    setCompletedAgents([]);
    progressTimerRef.current = window.setInterval(() => {
      step += 1;
      if (step < PIPELINE_KEYS.length) {
        setCompletedAgents(PIPELINE_KEYS.slice(0, step));
        setCurrentAgent(PIPELINE_KEYS[step]);
      }
    }, 750);
  }, []);

  const handleTrySample = useCallback(async () => {
    setError(null);
    try {
      const [tf, billing] = await Promise.all([loadSampleTerraform(), loadSampleBillingFile()]);
      setTerraform(tf);
      setBillingFile(billing);
    } catch (e) {
      setError(e.message ?? String(e));
    }
  }, []);

  const handleAnalyze = async (formData) => {
    setIsLoading(true);
    setError(null);
    setResults(null);
    setAppState("processing");
    startProgressSimulation();

    try {
      const data = await analyzeInfrastructure(formData);
      setResults(data);
      setResultsRunKey((k) => k + 1);
      setAppState("results");
      setCompletedAgents([...PIPELINE_KEYS]);
      setCurrentAgent(null);
    } catch (e) {
      setError(e.message ?? String(e));
      setAppState("input");
      setCurrentAgent(null);
      setCompletedAgents([]);
    } finally {
      clearProgressTimer();
      setIsLoading(false);
    }
  };

  const handleNewAnalysis = () => {
    setAppState("input");
    setResults(null);
    setError(null);
    setCompletedAgents([]);
    setCurrentAgent(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#d1d5db]">
      <Header
        showTrySample
        onTrySample={handleTrySample}
        resultsMode={appState === "results"}
        onNewAnalysis={handleNewAnalysis}
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        {appState === "input" && (
          <>
            <section className="mb-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-[#f9fafb] md:text-3xl">
                Analyze your GCP infrastructure.
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-base text-[#9ca3af]">
                Get a complete AWS migration plan with Day-0 cost optimization.
              </p>
            </section>

            <InputPanel
              terraform={terraform}
              onTerraformChange={setTerraform}
              billingFile={billingFile}
              onBillingFileChange={setBillingFile}
              onSubmit={handleAnalyze}
              isLoading={isLoading}
              onTrySample={handleTrySample}
            />

            <section className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Discovery",
                  body: "Inventory Terraform, YAML, and billing to build a trustworthy GCP baseline.",
                  color: "#4a9eff",
                },
                {
                  title: "Day-0 FinOps",
                  body: "Pre-calculate RIs, savings plans, and right-sized targets before cutover.",
                  color: "#00d4aa",
                },
                {
                  title: "Risk intel",
                  body: "Surface compatibility gaps, cutover hazards, and mitigations ranked by severity.",
                  color: "#f59e0b",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rad-card hover:shadow-[0_0_20px_rgba(0,212,170,0.12)]"
                >
                  <div
                    className="mb-3 h-1 w-12 rounded-full"
                    style={{ background: card.color }}
                  />
                  <h3 className="font-semibold text-[#f9fafb]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#9ca3af]">{card.body}</p>
                </div>
              ))}
            </section>
          </>
        )}

        {appState === "processing" && (
          <div className="space-y-6">
            <StatusBar
              currentAgent={currentAgent}
              completedAgents={completedAgents}
              processing
            />
            <div className="grid grid-cols-3 gap-3 md:max-w-xl">
              {["Resources", "Mapped", "Gaps"].map((label) => (
                <div
                  key={label}
                  className="rounded-lg border border-[#2a2a3e] bg-[#12121a] px-4 py-6 text-center"
                >
                  <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
                    {label}
                  </p>
                  <p className="mt-2 animate-pulse text-lg text-[#4a9eff]">…</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {appState === "results" && results && (
          <>
            <ExecutiveSummary results={results} />
            <ResultsPanel key={resultsRunKey} result={results} initialTab="finops" />
          </>
        )}

        {error && (
          <div
            className="mt-6 rounded-lg border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[#fca5a5]"
            role="alert"
          >
            {error}
          </div>
        )}

        {results?.errors?.length > 0 && appState === "results" && (
          <div className="mt-6 rounded-lg border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-sm text-[#fcd34d]">
            <p className="font-semibold text-[#fbbf24]">Partial run — agent / client notes</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {results.errors.map((e, i) => (
                <li key={i}>
                  {e.agent}: {e.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
