import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useThemeStore } from "./stores/themeStore";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RootRedirect } from "./components/RootRedirect";
import { LoginPage } from "./components/auth/LoginPage";
import { SignupPage } from "./components/auth/SignupPage";
import { AppLayout } from "./components/AppLayout";
import { DashboardLayout } from "./components/DashboardLayout";
import { ChatOnboarding } from "./components/chat/ChatOnboarding";
import { OverviewView } from "./components/dashboard/OverviewView";
import { MigrationView } from "./components/dashboard/MigrationView";
import { FinOpsView } from "./components/dashboard/FinOpsView";
import { WatchdogView } from "./components/dashboard/WatchdogView";
import { RunbookView } from "./components/dashboard/RunbookView";
import { IaCOutputView } from "./components/dashboard/IaCOutputView";

function AuthHydrate({ children }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return children;
}

function ThemeHydrate({ children }) {
  const hydrate = useThemeStore((s) => s.hydrate);
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeHydrate>
        <AuthHydrate>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />

          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="onboarding" replace />} />
            <Route path="onboarding" element={<ChatOnboarding />} />
            <Route path="dashboard" element={<DashboardLayout />}>
              <Route index element={<OverviewView />} />
              <Route path="migration" element={<MigrationView />} />
              <Route path="finops" element={<FinOpsView />} />
              <Route path="watchdog" element={<WatchdogView />} />
              <Route path="runbook" element={<RunbookView />} />
              <Route path="iac" element={<IaCOutputView />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </AuthHydrate>
      </ThemeHydrate>
    </BrowserRouter>
  );
}
