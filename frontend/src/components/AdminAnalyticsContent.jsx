import {
  ANALYTICS_PERIOD_OPTIONS,
  DEFAULT_ANALYTICS_PERIOD
} from "../config/constants.js";
import { formatCurrency } from "../utils/currency.js";
import { formatPercentRatio } from "../utils/numberFormat.js";
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

function formatCustomPeriodLabel(periodFilter) {
  if (
    periodFilter.period !== "custom" ||
    !periodFilter.startDate ||
    !periodFilter.endDate
  ) {
    return null;
  }

  const startDate = new Date(`${periodFilter.startDate}T00:00:00`);
  const endDate = new Date(`${periodFilter.endDate}T00:00:00`);

  return `Özel aralık: ${startDate.toLocaleDateString("tr-TR")}–${endDate.toLocaleDateString("tr-TR")}`;
}

function AdminAnalyticsContent({
  dashboard,
  periodFilter = {
    period: DEFAULT_ANALYTICS_PERIOD,
    startDate: "",
    endDate: ""
  },
  periodValidationMessage = "",
  onPeriodFilterChange = () => {}
}) {
  const selectedPeriodLabel = formatCustomPeriodLabel(periodFilter) ??
    ANALYTICS_PERIOD_OPTIONS.find(
      (option) => option.value === periodFilter.period
    )?.label ??
    "Seçili dönem";
  const dataRefreshLabel = dashboard.summary.last_order_at
    ? `Son sipariş: ${new Date(dashboard.summary.last_order_at).toLocaleString("tr-TR")}`
    : "Henüz sipariş verisi yok";
  const recommendationImpact = dashboard.recommendation_impact ?? {};

  return (
    <div className="admin-dashboard-content">
      <section className="admin-context-strip" aria-label="Panel veri kapsamı">
        <div>
          <strong>Veri kaynağı</strong>
          <span>SQLite üretim verileri</span>
        </div>
        <div>
          <strong>Dönem kapsamı</strong>
          <span>{selectedPeriodLabel} filtresi özetleri, grafikleri ve ürün analizlerini birlikte etkiler.</span>
        </div>
        <div>
          <strong>Güncellik</strong>
          <span>{dataRefreshLabel}</span>
        </div>
      </section>

      <section className="analytics-section admin-period-filter" aria-label="Global analitik dönem filtresi">
        <div className="dashboard-section-heading compact">
          <div>
            <p className="panel-kicker">Global filtre</p>
            <h3>Dönem Seçimi</h3>
          </div>
          <span>Rule History kendi tarih filtrelerini kullanmaya devam eder.</span>
        </div>
        <div className="admin-filter-row">
          <label>
            <span>Dönem</span>
            <select
              value={periodFilter.period}
              onChange={(event) => onPeriodFilterChange({ period: event.target.value })}
            >
              {ANALYTICS_PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {periodFilter.period === "custom" && (
            <>
              <label>
                <span>Başlangıç</span>
                <input
                  type="date"
                  value={periodFilter.startDate}
                  onChange={(event) => onPeriodFilterChange({ startDate: event.target.value })}
                />
              </label>
              <label>
                <span>Bitiş</span>
                <input
                  type="date"
                  value={periodFilter.endDate}
                  onChange={(event) => onPeriodFilterChange({ endDate: event.target.value })}
                />
              </label>
            </>
          )}
        </div>
        {periodValidationMessage && (
          <p className="admin-filter-error" role="alert">
            {periodValidationMessage}
          </p>
        )}
      </section>

      <section className="dashboard-overview" aria-labelledby="overview-title">
        <div className="dashboard-section-heading">
          <div>
            <p className="panel-kicker">Canlı mağaza özeti</p>
            <h3 id="overview-title">Genel Bakış</h3>
          </div>
          <span>{selectedPeriodLabel} · {dataRefreshLabel}</span>
        </div>

        <DashboardOverviewCards
          summary={dashboard.summary}
          topProducts={dashboard.top_products}
        />
      </section>

      <DashboardPeriodMetrics
        metrics={dashboard.period_metrics}
        periodLabel={selectedPeriodLabel}
        isAllTime={periodFilter.period === "all_time"}
      />

      <section className="analytics-section analytics-section-wide">
        <div className="analytics-section-heading">
          <div>
            <p className="panel-kicker">Sipariş performansı</p>
            <h3>Günlük Sipariş Sayısı</h3>
          </div>
          <span>Aktif dönem: {selectedPeriodLabel}</span>
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
          <span>Impression → sepete ekleme → satın alma zinciri gerçek eventlerden gelir.</span>
        </div>
        <div className="recommendation-impact-grid">
          <div>
            <strong>{recommendationImpact.impressions ?? 0}</strong>
            <span>Gösterim</span>
          </div>
          <div>
            <strong>{recommendationImpact.add_to_cart ?? 0}</strong>
            <span>Öneriden sepete ekleme</span>
          </div>
          <div>
            <strong>{formatPercentRatio(recommendationImpact.add_to_cart_rate ?? 0, 1)}</strong>
            <span>Sepete ekleme oranı</span>
          </div>
          <div>
            <strong>{recommendationImpact.purchases ?? 0}</strong>
            <span>Satın alma</span>
          </div>
          <div>
            <strong>{formatPercentRatio(recommendationImpact.purchase_rate ?? 0, 1)}</strong>
            <span>Satın alma oranı</span>
          </div>
          <div>
            <strong>{formatCurrency(recommendationImpact.recommendation_revenue ?? 0)}</strong>
            <span>Öneri kaynaklı ciro</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminAnalyticsContent;
