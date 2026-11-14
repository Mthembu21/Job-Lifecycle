import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";
import { PageSpinner } from "./components/ui";

// Each page is its own download, so e.g. the charting library is only fetched for the dashboard.
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const JobListPage = lazy(() => import("./features/jobs/JobListPage").then((m) => ({ default: m.JobListPage })));
const JobCreateForm = lazy(() => import("./features/jobs/JobCreateForm").then((m) => ({ default: m.JobCreateForm })));
const JobDetailPage = lazy(() => import("./features/jobs/JobDetailPage").then((m) => ({ default: m.JobDetailPage })));
const DataImportExportPage = lazy(() =>
  import("./features/admin/DataImportExportPage").then((m) => ({ default: m.DataImportExportPage }))
);
const BoardPage = lazy(() => import("./features/board/BoardPage").then((m) => ({ default: m.BoardPage })));
const ForecastPage = lazy(() => import("./features/forecast/ForecastPage").then((m) => ({ default: m.ForecastPage })));

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user?.role === "STOREMAN" ? "/jobs" : "/dashboard"} replace />;
}

export function App() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/board" element={<BoardPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/jobs" element={<JobListPage />} />
          <Route path="/jobs/new" element={<JobCreateForm />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/admin/data" element={<DataImportExportPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/" element={<HomeRedirect />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
