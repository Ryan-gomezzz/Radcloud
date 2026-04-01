export function MetricCard({
  label,
  value,
  sublabel,
  accentBorder,
  className = "",
}) {
  return (
    <div
      className={`rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-5 ${
        accentBorder ? "border-l-4 border-l-[var(--accent-primary)]" : ""
      } ${className}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <p className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-[var(--text-heading)]">
        {value}
      </p>
      {sublabel != null && sublabel !== "" && (
        <div className="mt-1 text-xs text-[var(--text-muted)]">{sublabel}</div>
      )}
    </div>
  );
}
