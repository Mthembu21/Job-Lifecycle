import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import { JobListPage } from "./features/jobs/JobListPage";
import { JobCreateForm } from "./features/jobs/JobCreateForm";
import { JobDetailPage } from "./features/jobs/JobDetailPage";
import { useAuth } from "./auth/AuthContext";

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "STOREMAN" ? "/jobs" : "/dashboard"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/jobs" element={<JobListPage />} />
        <Route path="/jobs/new" element={<JobCreateForm />} />
        <Route path="/jobs/:id" element={<JobDetailPage />} />
        <Route path="/" element={<HomeRedirect />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
