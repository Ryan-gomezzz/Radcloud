import { Outlet } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import { ThemeToggle } from "./ThemeToggle";
import { ProductLogo } from "./ProductLogo";

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="rad-shell flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]/85 backdrop-blur-md">
        <div className="flex h-[60px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <ProductLogo heightClass="h-9" decorative />
            <div>
              <span className="font-display text-base font-semibold tracking-tight text-[var(--text-heading)]">
                RADCloud
              </span>
              <p className="hidden text-[11px] text-[var(--text-muted)] sm:block">
                Migration-native FinOps
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user?.company && (
              <span className="hidden max-w-[140px] truncate text-sm text-[var(--text-muted)] md:inline">
                {user.company}
              </span>
            )}
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-default)] bg-[var(--bg-tertiary)]"
              title={user?.name}
            >
              <User className="size-4 text-[var(--text-muted)]" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm font-medium text-[var(--text-body)] transition-colors hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
