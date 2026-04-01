import { useState } from "react";

export function InputPanel({ onSubmit, isLoading, onTrySample }) {
  const [terraform, setTerraform] = useState("");
  const [billingFile, setBillingFile] = useState(null);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("terraform_config", terraform);
    if (billingFile) formData.append("billing_csv", billingFile);
    onSubmit(formData);
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block text-sm font-medium text-slate-700">
        Terraform / YAML
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
          placeholder="Paste your GCP Terraform or YAML config here..."
          value={terraform}
          onChange={(e) => setTerraform(e.target.value)}
          rows={12}
        />
      </label>
      <div className="flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium text-slate-700">
          Billing CSV (optional)
          <input
            type="file"
            accept=".csv"
            className="mt-1 block text-sm text-slate-600"
            onChange={(e) => setBillingFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <div className="ml-auto flex gap-2">
          {onTrySample && (
            <button
              type="button"
              onClick={() => onTrySample(setTerraform, setBillingFile)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Try sample data
            </button>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !terraform.trim()}
            className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? "Analyzing…" : "Analyze"}
          </button>
        </div>
      </div>
    </div>
  );
}
