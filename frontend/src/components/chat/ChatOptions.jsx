export function ChatOptions({ options, onSelect, disabled }) {
  return (
    <div className="ml-11 flex flex-col gap-2">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(option)}
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-3 text-left text-[14px] text-[var(--text-body)] transition-all duration-200 hover:border-[var(--accent-primary)] hover:bg-[var(--bg-card)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="font-medium">{option.label}</span>
          {option.description && (
            <span className="mt-1 block text-[12px] text-[var(--text-muted)]">
              {option.description}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
