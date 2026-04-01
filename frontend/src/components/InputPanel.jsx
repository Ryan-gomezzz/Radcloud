import { useCallback, useState } from "react";

export function InputPanel({
  terraform,
  onTerraformChange,
  billingFile,
  onBillingFileChange,
  onSubmit,
  isLoading,
  onTrySample,
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f && f.name.endsWith(".csv")) onBillingFileChange(f);
    },
    [onBillingFileChange],
  );

  const handleSubmit = () => {
    const formData = new FormData();
    formData.append("terraform_config", terraform);
    if (billingFile) formData.append("billing_csv", billingFile);
    onSubmit(formData);
  };

  return (
    <div className="rad-card space-y-5">
      <div>
        <label className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
          GCP Infrastructure Config
        </label>
        <textarea
          className="font-mono-code mt-2 w-full resize-y rounded-lg border border-[#2a2a3e] bg-[#12121a] px-3 py-3 text-sm text-[#d1d5db] placeholder:text-[#6b7280] focus:border-[#00d4aa] focus:outline-none focus:ring-[3px] focus:ring-[rgba(0,212,170,0.1)]"
          placeholder="Paste your GCP Terraform or YAML config here..."
          value={terraform}
          onChange={(e) => onTerraformChange(e.target.value)}
          rows={14}
          spellCheck={false}
        />
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-widest text-[#6b7280]">
          Billing export (CSV)
        </p>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && document.getElementById("billing-input")?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
            dragOver
              ? "border-[#00d4aa] bg-[rgba(0,212,170,0.06)]"
              : "border-[#2a2a3e] bg-[#12121a] hover:border-[#3a3a5e]"
          }`}
          onClick={() => document.getElementById("billing-input")?.click()}
        >
          <span className="text-2xl" aria-hidden>
            📂
          </span>
          <p className="mt-2 text-center text-sm text-[#d1d5db]">
            Drop billing CSV or browse — GCP billing export (12 months)
          </p>
          {billingFile && (
            <p className="mt-2 text-xs text-[#00d4aa]">{billingFile.name}</p>
          )}
          <input
            id="billing-input"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => onBillingFileChange(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {onTrySample && (
          <button type="button" className="btn-outline text-sm" onClick={onTrySample}>
            Try sample data
          </button>
        )}
        <button
          type="button"
          className="btn-primary text-sm"
          onClick={handleSubmit}
          disabled={isLoading || !terraform.trim()}
        >
          {isLoading ? "Analyzing…" : "Analyze infrastructure"}
        </button>
      </div>
    </div>
  );
}
