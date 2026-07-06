import AdminAnalyticsContent from "./AdminAnalyticsContent.jsx";
import AdminDashboardHeader from "./AdminDashboardHeader.jsx";
import LoadingSpinner from "./LoadingSpinner.jsx";

function AdminDashboard({
  dashboard,
  loading,
  error,
  days,
  onDaysChange,
  onRetry,
  onClose,
  adminEmail,
  onLogout,
  onMarket
}) {
  const hasSales = dashboard?.summary?.total_orders > 0;

  return (
    <div className="admin-dashboard-backdrop" role="presentation">
      <section
        className="admin-dashboard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-dashboard-title"
      >
        <AdminDashboardHeader
          adminEmail={adminEmail}
          onMarket={onMarket}
          onLogout={onLogout}
          onClose={onClose}
        />

        {loading && (
          <div className="admin-dashboard-state">
            <LoadingSpinner label="Analitik veriler hazırlanıyor..." />
          </div>
        )}

        {!loading && error && (
          <div className="admin-dashboard-state error" role="alert">
            <strong>Yönetim verilerine şu anda ulaşılamıyor.</strong>
            <span>{error}</span>
            <button type="button" onClick={onRetry}>Tekrar Dene</button>
          </div>
        )}

        {!loading && !error && dashboard && !hasSales && (
          <p className="admin-dashboard-state">
            Henüz analiz için yeterli satış verisi bulunmuyor.
          </p>
        )}

        {!loading && !error && dashboard && hasSales && (
          <AdminAnalyticsContent
            dashboard={dashboard}
            days={days}
            onDaysChange={onDaysChange}
          />
        )}
      </section>
    </div>
  );
}

export default AdminDashboard;
