import { useCallback, useState } from "react";
import { UploadCloud } from "lucide-react";

export function ChatFileUpload({
  label,
  hint,
  onFile,
  onUseSample,
  disabled,
  accept = ".csv,text/csv",
}) {
  const [drag, setDrag] = useState(false);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDrag(false);
      if (disabled) return;
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [disabled, onFile]
  );

  return (
    <div className="ml-11 space-y-3">
      <label
        className={`block cursor-pointer rounded-lg border border-dashed border-[var(--border-default)] bg-[var(--bg-secondary)] p-4 transition-colors hover:border-[var(--accent-primary)] ${
          drag ? "border-[var(--accent-primary)] bg-[var(--bg-card)]" : ""
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept={accept}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <UploadCloud className="mb-2 size-5 text-[var(--text-muted)]" aria-hidden />
        <p className="text-[14px] text-[var(--text-body)]">{label}</p>
        <p className="mt-1 text-[12px] text-[var(--text-muted)]">{hint}</p>
      </label>
      {onUseSample && (
        <button
          type="button"
          disabled={disabled}
          onClick={onUseSample}
          className="w-full rounded-lg border border-[var(--border-default)] px-4 py-2.5 text-left text-sm font-medium text-[var(--accent-secondary)] transition-colors hover:border-[var(--accent-secondary)] hover:bg-[var(--bg-card)] disabled:opacity-50"
        >
          Use sample data (12-month billing)
        </button>
      )}
    </div>
  );
}
