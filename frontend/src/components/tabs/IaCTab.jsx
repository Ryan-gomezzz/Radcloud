import { useState } from "react";

export function IaCTab({ iacBundle }) {
  const [selectedFile, setSelectedFile] = useState(0);

  if (!iacBundle) {
    return <p className="text-slate-500">No IaC output yet.</p>;
  }

  const files = iacBundle.files ?? [];
  const contents = iacBundle.terraform_contents ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-800">
            {iacBundle.format?.toUpperCase() ?? "TERRAFORM"}
          </span>
          <span className="rounded-md bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
            {iacBundle.mode?.replace(/_/g, " ") ?? "generated scaffold"}
          </span>
          <span className="text-sm text-slate-500">
            {files.length} file{files.length !== 1 ? "s" : ""} generated
          </span>
        </div>
        {iacBundle.deployment_notes && (
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            {iacBundle.deployment_notes}
          </p>
        )}
      </div>

      {/* File browser + code viewer */}
      {files.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
          {/* File tabs */}
          <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-800 px-2 pt-2">
            {files.map((f, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedFile(i)}
                className={`rounded-t-lg px-3 py-2 text-xs font-mono transition-colors ${
                  selectedFile === i
                    ? "bg-slate-900 text-emerald-400"
                    : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {f.path?.split("/").pop() ?? `file-${i + 1}`}
              </button>
            ))}
          </div>

          {/* File info bar */}
          <div className="flex items-center gap-3 border-b border-slate-700 bg-slate-900 px-4 py-2">
            <span className="font-mono text-xs text-slate-400">
              {files[selectedFile]?.path}
            </span>
            <span className="ml-auto text-xs text-slate-500">
              {files[selectedFile]?.description}
            </span>
          </div>

          {/* Code content */}
          <div className="max-h-[500px] overflow-auto bg-slate-950 p-4">
            {contents[files[selectedFile]?.path] ? (
              <pre className="font-mono text-xs leading-relaxed text-emerald-300 whitespace-pre">
                {contents[files[selectedFile].path]}
              </pre>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Scaffold generated — file content available after apply.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Assumptions */}
      {iacBundle.assumptions?.length > 0 && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-5">
          <h4 className="mb-3 text-sm font-bold text-amber-900">Assumptions</h4>
          <ul className="space-y-1.5">
            {iacBundle.assumptions.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-0.5 flex-shrink-0 text-amber-500">•</span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
