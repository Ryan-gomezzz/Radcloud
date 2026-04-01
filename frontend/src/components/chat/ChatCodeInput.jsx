import { FileCode } from "lucide-react";

export function ChatCodeInput({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder = 'resource "google_compute_instance" "web_server" { ... }',
}) {
  return (
    <div className="ml-11 space-y-3">
      <div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-3 py-2">
          <FileCode className="size-3.5 text-[var(--text-muted)]" aria-hidden />
          <span className="text-[12px] text-[var(--text-muted)]">
            Terraform / YAML configuration
          </span>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="min-h-[200px] w-full resize-none bg-transparent p-4 font-mono text-[13px] text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:outline-none"
          placeholder={placeholder}
        />
      </div>
      <button
        type="button"
        disabled={disabled || !value?.trim()}
        onClick={onSubmit}
        className="btn-primary text-sm"
      >
        Submit configuration
      </button>
    </div>
  );
}
