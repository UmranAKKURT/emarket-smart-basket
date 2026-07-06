import { ANALYTICS_DAY_OPTIONS } from "../config/constants.js";
import { formatCurrency } from "../utils/currency.js";
import { formatDateTime } from "../utils/date.js";
import CategorySalesChart from "./CategorySalesChart.jsx";
import MetricCard from "./MetricCard.jsx";
import SalesTrendChart from "./SalesTrendChart.jsx";
import StrongRulesTable from "./StrongRulesTable.jsx";
import TopProductsChart from "./TopProductsChart.jsx";

function AdminAnalyticsContent({ dashboard, days, onDaysChange }) {
  const { summary } = dashboard;
  const topSellingProduct = dashboard.top_products[0];
  const mostRecommendedProduct = summary.most_recommended_product;

  return (
    <div className="admin-dashboard-content">
      <section className="dashboard-overview" aria-labelledby="overview-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="panel-kicker">Canlı mağaza özeti</p>
            <h3 id="overview-title">Genel Bakış</h3>
          </div>
          <span>SQLite verileriyle güncellendi</span>
        </div>

        <div className="metrics-grid" aria-label="Yönetim özeti">
          <MetricCard icon="🧾" title="Toplam Sipariş" value={summary.total_orders} tone="primary" />
          <MetricCard icon="📦" title="Toplam Satılan Ürün" value={summary.total_units_sold} />
          <MetricCard icon="🏷️" title="Toplam Ürün" value={summary.total_products} />
          <MetricCard icon="🗂️" title="Toplam Kategori" value={summary.total_categories} />
          <MetricCard
            icon={topSellingProduct?.emoji ?? "🏆"}
            title="En Çok Satan Ürün"
            value={topSellingProduct?.product_name ?? "Veri yok"}
            subtitle={topSellingProduct ? `${topSellingProduct.total_quantity} adet satıldı` : undefined}
            tone="highlight"
          />
          <MetricCard
            icon={mostRecommendedProduct?.emoji ?? "✨"}
            title="En Çok Önerilen Ürün"
            value={mostRecommendedProduct?.product_name ?? "Veri yok"}
            subtitle={mostRecommendedProduct ? `${mostRecommendedProduct.recommendation_count} kuralda öneriliyor` : undefined}
            tone="highlight"
          />
          <MetricCard
            icon="🧺"
            title="Ortalama Sepet Tutarı"
            value={formatCurrency(summary.average_order_value)}
          />
          <MetricCard
            icon="🕒"
            title="Son Sipariş Tarihi"
            value={formatDateTime(summary.last_order_at)}
          />
          <MetricCard icon="💰" title="Toplam Ciro" value={formatCurrency(summary.total_revenue)} />
          <MetricCard icon="👥" title="Benzersiz Müşteri" value={summary.unique_customers} />
        </div>
      </section>

      <section className="analytics-section analytics-section-wide">
        <div className="analytics-section-heading">
          <div>
            <p className="panel-kicker">Sipariş performansı</p>
            <h3>Günlük Sipariş Sayısı</h3>
          </div>
          <label>
            <span>Dönem</span>
            <select
              aria-label="Sipariş grafiği dönemi"
              value={days}
              onChange={(event) => onDaysChange(Number(event.target.value))}
            >
              {ANALYTICS_DAY_OPTIONS.map((dayCount) => (
                <option key={dayCount} value={dayCount}>Son {dayCount} gün</option>
              ))}
            </select>
          </label>
        </div>
        <SalesTrendChart sales={dashboard.daily_sales} />
      </section>

      <div className="analytics-grid dashboard-chart-grid">
        <section className="analytics-section">
          <div className="dashboard-section-heading compact">
            <div>
              <p className="panel-kicker">Satış payı</p>
              <h3>Kategori Dağılımı</h3>
            </div>
          </div>
          <CategorySalesChart categories={dashboard.category_sales} />
        </section>

        <section className="analytics-section">
          <div className="dashboard-section-heading compact">
            <div>
              <p className="panel-kicker">Ürün performansı</p>
              <h3>En Çok Satılan İlk 10 Ürün</h3>
            </div>
          </div>
          <TopProductsChart products={dashboard.top_products} />
        </section>
      </div>

      <section className="analytics-section">
        <h3>En Güçlü Association Rule Sonuçları</h3>
        <StrongRulesTable rules={dashboard.strongest_rules} />
      </section>
    </div>
  );
}

export default AdminAnalyticsContent;
