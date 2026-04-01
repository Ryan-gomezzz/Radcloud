const variants = {
  direct:
    "border border-[color-mix(in_srgb,var(--color-success)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--color-success)_14%,var(--bg-secondary))] text-[var(--color-success)]",
  partial:
    "border border-[color-mix(in_srgb,var(--color-warning)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--bg-secondary))] text-[var(--color-warning)]",
  none:
    "border border-[color-mix(in_srgb,var(--color-danger)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--color-danger)_14%,var(--bg-secondary))] text-[var(--color-danger)]",
  high:
    "border border-[color-mix(in_srgb,var(--color-danger)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--color-danger)_14%,var(--bg-secondary))] text-[var(--color-danger)]",
  medium:
    "border border-[color-mix(in_srgb,var(--color-warning)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--bg-secondary))] text-[var(--color-warning)]",
  low:
    "border border-[var(--border-default)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]",
  steady_state:
    "border border-[color-mix(in_srgb,var(--color-success)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--color-success)_14%,var(--bg-secondary))] text-[var(--color-success)]",
  predictable:
    "border border-[color-mix(in_srgb,var(--accent-blue)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--accent-blue)_14%,var(--bg-secondary))] text-[var(--accent-blue)]",
  bursty:
    "border border-[color-mix(in_srgb,var(--color-warning)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--color-warning)_14%,var(--bg-secondary))] text-[var(--color-warning)]",
  info:
    "border border-[color-mix(in_srgb,var(--accent-blue)_40%,var(--border-default))] bg-[color-mix(in_srgb,var(--accent-blue)_14%,var(--bg-secondary))] text-[var(--accent-blue)]",
};

export function Badge({ children, variant = "info", className = "" }) {
  const cls = variants[variant] || variants.info;
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls} ${className}`}
    >
      {children}
    </span>
  );
}
