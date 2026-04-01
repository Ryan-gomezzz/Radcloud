import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { ThemeToggle } from "../ThemeToggle";
import { VisualBrandPanel } from "../VisualBrandPanel";
import { ProductLogo } from "../ProductLogo";

const inputClass =
  "w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)] py-2.5 pl-10 pr-4 text-[15px] text-[var(--text-body)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await login(email || "demo@example.com", password || "changeme");
      navigate("/app/onboarding", { replace: true });
    } catch (err) {
      setError(err?.message || "Sign in failed");
    }
  };

  return (
    <div className="rad-shell relative min-h-screen px-4 py-10 md:px-8">
      <div className="absolute right-4 top-4 z-20 md:right-8 md:top-8">
        <ThemeToggle />
      </div>
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2 lg:items-stretch lg:gap-12">
        <VisualBrandPanel />

        <div className="flex flex-col justify-center">
          <div className="mb-8 lg:hidden">
            <div className="mb-3">
              <ProductLogo heightClass="h-12" decorative />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-heading)]">
              RADCloud
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Migration-native FinOps
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-8 shadow-xl">
            <h2 className="font-display mb-2 text-xl font-semibold text-[var(--text-heading)]">
              Welcome back
            </h2>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              Sign in to launch the guided analysis console.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@company.com"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-muted)]"
                    aria-hidden
                  />
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Password"
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full">
                Sign in
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="font-medium text-[var(--accent-secondary)] hover:text-[var(--accent-primary)]"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
