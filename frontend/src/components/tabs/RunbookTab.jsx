export function RunbookTab({ runbook }) {
  if (!runbook) {
    return <p className="text-slate-500">No runbook yet.</p>;
  }
  if (typeof runbook === "string") {
    return <p className="whitespace-pre-wrap text-sm text-slate-800">{runbook}</p>;
  }
  if (!Array.isArray(runbook) || runbook.length === 0) {
    return <p className="text-slate-500">No runbook steps.</p>;
  }
  return (
    <ol className="list-decimal space-y-4 pl-5 text-sm text-slate-800">
      {runbook.map((step, i) => (
        <li key={i} className="pl-1">
          <span className="font-semibold">{step.title ?? `Step ${step.step ?? i + 1}`}</span>
          {step.detail && <p className="mt-1 text-slate-600">{step.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
