import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import AdminDashboard from "../components/AdminDashboard.jsx";
import {
  ANALYTICS_PERIOD_DAYS,
  DEFAULT_ANALYTICS_DAYS,
  DEFAULT_ANALYTICS_PERIOD
} from "../config/constants.js";
import { useAdminAuth } from "../hooks/useAdminAuth.js";
import { useToast } from "../hooks/useToast.js";
import {
  getAnalyticsDashboard,
  getAnalyticsDashboardStreamUrl
} from "../services/api.js";

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getTodayDateOnly() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getCustomDateValidation(periodFilter) {
  if (periodFilter.period !== "custom") {
    return "";
  }

  if (!periodFilter.startDate || !periodFilter.endDate) {
    return "Başlangıç ve bitiş tarihini seçin.";
  }

  const startDate = parseDateOnly(periodFilter.startDate);
  const endDate = parseDateOnly(periodFilter.endDate);

  if (!startDate || !endDate) {
    return "Geçerli bir tarih aralığı seçin.";
  }

  if (startDate > endDate) {
    return "Başlangıç tarihi bitiş tarihinden sonra olamaz.";
  }

  if (startDate > getTodayDateOnly() || endDate > getTodayDateOnly()) {
    return "Gelecek tarih seçilemez.";
  }

  return "";
}

function getDashboardDays(periodFilter) {
  if (periodFilter.period !== "custom") {
    return ANALYTICS_PERIOD_DAYS[periodFilter.period] ?? DEFAULT_ANALYTICS_DAYS;
  }

  const startDate = parseDateOnly(periodFilter.startDate);
  const endDate = parseDateOnly(periodFilter.endDate);

  if (!startDate || !endDate || startDate > endDate) {
    return DEFAULT_ANALYTICS_DAYS;
  }

  return Math.max(1, Math.round((endDate - startDate) / 86_400_000) + 1);
}

function AdminDashboardPage() {
  const { adminUser, logout } = useAdminAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [periodFilter, setPeriodFilter] = useState({
    period: DEFAULT_ANALYTICS_PERIOD,
    startDate: "",
    endDate: ""
  });
  const navigate = useNavigate();
  const { showToast } = useToast();

  const periodValidationMessage = useMemo(
    () => getCustomDateValidation(periodFilter),
    [periodFilter]
  );
  const days = useMemo(() => getDashboardDays(periodFilter), [periodFilter]);

  const load = useCallback(async (selectedDays, selectedPeriodFilter) => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getAnalyticsDashboard({
        days: Math.max(selectedDays, 1),
        period: selectedPeriodFilter.period,
        startDate: selectedPeriodFilter.startDate,
        endDate: selectedPeriodFilter.endDate
      }));
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
    if (periodValidationMessage) {
      setLoading(false);
      return;
    }

    load(days, periodFilter);
  }, [days, load, periodFilter, periodValidationMessage]);

  useEffect(() => {
    if (typeof EventSource === "undefined" || periodValidationMessage) {
      return undefined;
    }

    const stream = new EventSource(
      getAnalyticsDashboardStreamUrl({
        days,
        period: periodFilter.period,
        startDate: periodFilter.startDate,
        endDate: periodFilter.endDate
      }),
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
  }, [days, periodFilter, periodValidationMessage]);

  const handleLogout = useCallback(async () => {
    await logout();
    showToast({
      type: "success",
      title: "Oturum kapatıldı",
      message: "Güvenli şekilde çıkış yaptınız."
    });
    navigate("/admin/login", { replace: true });
  }, [logout, navigate, showToast]);

  const changePeriodFilter = useCallback((nextFilter) => {
    setPeriodFilter((currentFilter) => ({
      ...currentFilter,
      ...nextFilter
    }));
  }, []);

  const retry = useCallback(() => {
    if (!periodValidationMessage) {
      load(days, periodFilter);
    }
  }, [days, load, periodFilter, periodValidationMessage]);
  const returnToMarket = useCallback(() => navigate("/"), [navigate]);

  return (
    <AdminDashboard
      dashboard={dashboard}
      loading={loading}
      error={error}
      days={days}
      periodFilter={periodFilter}
      periodValidationMessage={periodValidationMessage}
      onPeriodFilterChange={changePeriodFilter}
      onRetry={retry}
      onClose={returnToMarket}
      adminEmail={adminUser?.email}
      onLogout={handleLogout}
      onMarket={returnToMarket}
    />
  );
}

export default AdminDashboardPage;
