import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { AppShell } from "../layout/AppShell";
import { Spinner } from "../components/ui";

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
