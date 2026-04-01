import { Bot, User } from "lucide-react";

export function ChatMessageAI({ children }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--accent-gradient)" }}
      >
        <Bot className="size-4" style={{ color: "var(--logo-fg)" }} aria-hidden />
      </div>
      <div className="max-w-[80%] rounded-xl rounded-tl-sm border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-3 shadow-sm">
        <div className="text-[15px] leading-relaxed text-[var(--text-body)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function ChatMessageUser({ children }) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[80%] rounded-xl rounded-tr-sm border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
        <p className="text-[15px] text-[var(--text-body)]">{children}</p>
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]">
        <User className="size-4 text-[var(--text-muted)]" aria-hidden />
      </div>
    </div>
  );
}
