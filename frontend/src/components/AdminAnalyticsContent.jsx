import { ANALYTICS_DAY_OPTIONS } from "../config/constants.js";
import {
  exportAssociationRules,
  getAssociationRuleDetail,
  getAssociationRulesPage
} from "../services/api.js";
import CategorySalesChart from "./CategorySalesChart.jsx";
import DashboardOverviewCards from "./DashboardOverviewCards.jsx";
import DashboardPeriodMetrics from "./DashboardPeriodMetrics.jsx";
import ProductPairsCard from "./ProductPairsCard.jsx";
import SalesTrendChart from "./SalesTrendChart.jsx";
import StrongRulesTable from "./StrongRulesTable.jsx";
import TopProductsChart from "./TopProductsChart.jsx";

function AdminAnalyticsContent({ dashboard, days, onDaysChange }) {
  const dataRefreshLabel = dashboard.summary.last_order_at
    ? `Son sipariş: ${new Date(dashboard.summary.last_order_at).toLocaleString("tr-TR")}`
    : "Henüz sipariş verisi yok";

  return (
    <div className="admin-dashboard-content">
      <section className="admin-context-strip" aria-label="Panel veri kapsamı">
        <div>
          <strong>Veri kaynağı</strong>
          <span>SQLite üretim verileri</span>
        </div>
        <div>
          <strong>Dönem kapsamı</strong>
          <span>Üst özetler tüm zamanları, günlük grafik ve dönem ortalamaları son {days} günü gösterir.</span>
        </div>
        <div>
          <strong>Güncellik</strong>
          <span>{dataRefreshLabel}</span>
        </div>
      </section>

      <section className="dashboard-overview" aria-labelledby="overview-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="panel-kicker">Canlı mağaza özeti</p>
            <h3 id="overview-title">Genel Bakış</h3>
          </div>
          <span>Tüm zamanlar · {dataRefreshLabel}</span>
        </div>

        <DashboardOverviewCards
          summary={dashboard.summary}
          topProducts={dashboard.top_products}
        />
      </section>

      <DashboardPeriodMetrics metrics={dashboard.period_metrics} days={days} />

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
              <p className="panel-kicker">Sepet ilişkileri</p>
              <h3>En Çok Birlikte Satılan Ürünler</h3>
            </div>
          </div>
          <ProductPairsCard pairs={dashboard.top_product_pairs} />
        </section>

        <section className="analytics-section">
          <div className="dashboard-section-heading compact">
            <div>
              <p className="panel-kicker">Ürün performansı</p>
              <h3>En Çok Satılan Ürünler</h3>
            </div>
          </div>
          <TopProductsChart products={dashboard.top_products} />
        </section>
      </div>

      <section className="analytics-section">
        <div className="dashboard-section-heading compact">
          <div>
            <p className="panel-kicker">Satış payı</p>
            <h3>Kategori Bazında Ciro Dağılımı</h3>
          </div>
          <span>Yüzdeler ciro payını gösterir</span>
        </div>
        <CategorySalesChart categories={dashboard.category_sales} />
      </section>

      <section className="analytics-section">
        <h3>En Güçlü Birliktelik Kuralları</h3>
        <p className="analytics-section-note">
          Kurallar tüm geçmiş hesaplamalardan gelir; düşük örneklemli kayıtlar ayrıca işaretlenir.
        </p>
        <StrongRulesTable
          rules={dashboard.strongest_rules}
          loadRulesPage={getAssociationRulesPage}
          loadRuleDetail={getAssociationRuleDetail}
          exportRules={exportAssociationRules}
        />
      </section>

      <section className="analytics-section admin-recommendation-impact">
        <div className="dashboard-section-heading compact">
          <div>
            <p className="panel-kicker">Öneri etkisi</p>
            <h3>Performans Takibi</h3>
          </div>
        </div>
        <p className="analytics-empty">
          Öneri gösterimi, tıklama ve öneriden sepete ekleme metrikleri mevcut veri modelinde henüz izlenmiyor.
          Bu yüzden panel sahte performans verisi üretmez; mevcut özetlerde yalnızca kural sayısı ve en çok önerilen ürün gösterilir.
        </p>
      </section>
    </div>
  );
}

export default AdminAnalyticsContent;
