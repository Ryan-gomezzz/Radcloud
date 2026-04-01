import { Outlet, Navigate } from "react-router-dom";
import { useAnalysisStore } from "../stores/analysisStore";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
  const results = useAnalysisStore((s) => s.results);

  if (!results) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return (
    <div className="flex min-h-[calc(100vh-60px)] bg-transparent">
      <Sidebar />
      <div className="min-w-0 flex-1 overflow-auto p-6 md:p-8">
        <div className="tab-panel-enter mx-auto max-w-6xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
