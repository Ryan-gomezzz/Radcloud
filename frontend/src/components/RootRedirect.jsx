import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

export function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/app/onboarding" replace />;
  }
  return <Navigate to="/login" replace />;
}
