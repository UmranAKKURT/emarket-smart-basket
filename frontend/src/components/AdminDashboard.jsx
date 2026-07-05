import CategorySalesChart from "./CategorySalesChart.jsx";
import MetricCard from "./MetricCard.jsx";
import SalesTrendChart from "./SalesTrendChart.jsx";
import StrongRulesTable from "./StrongRulesTable.jsx";
import TopProductsChart from "./TopProductsChart.jsx";
import { formatCurrency } from "../utils/currency.js";

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
        <header className="admin-dashboard-header">
          <div>
            <p className="panel-kicker">Gerçek SQLite satış verileri</p>
            <h2 id="admin-dashboard-title">Yönetim ve Analitik Paneli</h2>
            <small>
              Demo admin ekranıdır; production ortamında yetkilendirme gerekir.
            </small>
          </div>
          <div className="admin-dashboard-actions">
            {adminEmail && <span>{adminEmail}</span>}
            {onMarket && <button className="text-button" type="button" onClick={onMarket}>Markete Dön</button>}
            {onLogout && <button className="text-button" type="button" onClick={onLogout}>Çıkış Yap</button>}
            <button className="text-button" type="button" onClick={onClose}>Kapat</button>
          </div>
        </header>

        {loading && (
          <p className="admin-dashboard-state">Analitik veriler hazırlanıyor...</p>
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
          <div className="admin-dashboard-content">
            <section className="metrics-grid" aria-label="Yönetim özeti">
              <MetricCard icon="🧾" title="Toplam Sipariş" value={dashboard.summary.total_orders} />
              <MetricCard icon="💰" title="Toplam Ciro" value={formatCurrency(dashboard.summary.total_revenue)} />
              <MetricCard icon="📦" title="Satılan Ürün Adedi" value={dashboard.summary.total_units_sold} />
              <MetricCard icon="🧺" title="Ortalama Sepet" value={formatCurrency(dashboard.summary.average_order_value)} />
              <MetricCard icon="👥" title="Benzersiz Müşteri" value={dashboard.summary.unique_customers} />
            </section>

            <div className="analytics-grid">
              <section className="analytics-section">
                <h3>En Çok Satılan Ürünler</h3>
                <TopProductsChart products={dashboard.top_products} />
              </section>

              <section className="analytics-section">
                <h3>Kategori Satış Dağılımı</h3>
                <CategorySalesChart categories={dashboard.category_sales} />
              </section>
            </div>

            <section className="analytics-section">
              <div className="analytics-section-heading">
                <h3>Günlük Satış Trendi</h3>
                <label>
                  <span>Dönem</span>
                  <select
                    aria-label="Satış trendi dönemi"
                    value={days}
                    onChange={(event) => onDaysChange(Number(event.target.value))}
                  >
                    <option value={7}>Son 7 gün</option>
                    <option value={30}>Son 30 gün</option>
                    <option value={90}>Son 90 gün</option>
                  </select>
                </label>
              </div>
              <SalesTrendChart sales={dashboard.daily_sales} />
            </section>

            <section className="analytics-section">
              <h3>En Güçlü Association Rule Sonuçları</h3>
              <StrongRulesTable rules={dashboard.strongest_rules} />
            </section>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminDashboard;
