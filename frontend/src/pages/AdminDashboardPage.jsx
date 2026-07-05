import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminDashboard from "../components/AdminDashboard.jsx";
import { useAdminAuth } from "../hooks/useAdminAuth.js";
import { getAnalyticsDashboard } from "../services/api.js";

function AdminDashboardPage() {
  const { adminUser, logout } = useAdminAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(30);
  const navigate = useNavigate();

  async function load(selectedDays = days) {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getAnalyticsDashboard({ days: selectedDays }));
    } catch (exception) {
      if (exception.status === 401) {
        navigate("/admin/login", { replace: true });
        return;
      }
      setError(exception.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(30); }, []);

  async function handleLogout() {
    await logout();
    navigate("/admin/login", { replace: true });
  }

  function changeDays(value) {
    setDays(value);
    load(value);
  }

  return (
    <AdminDashboard
      dashboard={dashboard}
      loading={loading}
      error={error}
      days={days}
      onDaysChange={changeDays}
      onRetry={() => load(days)}
      onClose={() => navigate("/")}
      adminEmail={adminUser?.email}
      onLogout={handleLogout}
      onMarket={() => navigate("/")}
    />
  );
}

export default AdminDashboardPage;
