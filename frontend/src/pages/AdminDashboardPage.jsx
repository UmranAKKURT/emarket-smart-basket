import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminDashboard from "../components/AdminDashboard.jsx";
import { DEFAULT_ANALYTICS_DAYS } from "../config/constants.js";
import { useAdminAuth } from "../hooks/useAdminAuth.js";
import { useToast } from "../hooks/useToast.js";
import {
  getAnalyticsDashboard,
  getAnalyticsDashboardStreamUrl
} from "../services/api.js";

function AdminDashboardPage() {
  const { adminUser, logout } = useAdminAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(DEFAULT_ANALYTICS_DAYS);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const load = useCallback(async (selectedDays) => {
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
      showToast({
        type: "error",
        title: "Analitik veriler yüklenemedi",
        message: exception.message || "Lütfen kısa süre sonra tekrar deneyin."
      });
    } finally {
      setLoading(false);
    }
  }, [navigate, showToast]);

  useEffect(() => {
    load(DEFAULT_ANALYTICS_DAYS);
  }, [load]);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }

    const stream = new EventSource(
      getAnalyticsDashboardStreamUrl({ days }),
      { withCredentials: true }
    );

    stream.addEventListener("dashboard", (event) => {
      setDashboard(JSON.parse(event.data));
      setLoading(false);
      setError(null);
    });

    stream.onerror = () => {
      stream.close();
    };

    return () => stream.close();
  }, [days]);

  const handleLogout = useCallback(async () => {
    await logout();
    showToast({
      type: "success",
      title: "Oturum kapatıldı",
      message: "Güvenli şekilde çıkış yaptınız."
    });
    navigate("/admin/login", { replace: true });
  }, [logout, navigate, showToast]);

  const changeDays = useCallback((value) => {
    setDays(value);
    load(value);
  }, [load]);

  const retry = useCallback(() => load(days), [days, load]);
  const returnToMarket = useCallback(() => navigate("/"), [navigate]);

  return (
    <AdminDashboard
      dashboard={dashboard}
      loading={loading}
      error={error}
      days={days}
      onDaysChange={changeDays}
      onRetry={retry}
      onClose={returnToMarket}
      adminEmail={adminUser?.email}
      onLogout={handleLogout}
      onMarket={returnToMarket}
    />
  );
}

export default AdminDashboardPage;
