import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/app-shell.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { bootstrapSession } from "./lib/api.js";
import { useAuthStore } from "./store/auth.js";
import AdminSettingsPage from "./pages/AdminSettingsPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import DeviceDetailPage from "./pages/DeviceDetailPage.jsx";
import DevicesPage from "./pages/DevicesPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import PairDevicePage from "./pages/PairDevicePage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";

export default function App() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const setHydrating = useAuthStore((state) => state.setHydrating);

  useEffect(() => {
    if (hydrated) return;

    setHydrating(true);
    bootstrapSession();
  }, [hydrated, setHydrating]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/devices/:id" element={<DeviceDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route
          path="/pair-device"
          element={
            <ProtectedRoute role="admin">
              <PairDevicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-settings"
          element={
            <ProtectedRoute role="admin">
              <AdminSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute role="admin">
              <UsersPage />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
