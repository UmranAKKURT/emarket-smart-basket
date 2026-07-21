import { formatCurrency } from "../utils/currency.js";
import { formatCompactNumber } from "../utils/numberFormat.js";
import MetricCard from "./MetricCard.jsx";

function DashboardPeriodMetrics({ metrics, days }) {
  const comparisonFallback = "Önceki dönem karşılaştırma verisi yok";

  return (
    <section className="analytics-section analytics-period-section">
      <div className="dashboard-section-heading compact">
        <div>
          <p className="panel-kicker">Dönem performansı</p>
          <h3>Yeni Analizler</h3>
        </div>
        <span>Grafik filtresi: son {days} gün</span>
      </div>

      <div className="period-metrics-grid">
        <MetricCard
          icon="calendar"
          title="Son 7 Gün Sipariş"
          value={metrics.last_7_day_orders}
          tone="primary"
        />
        <MetricCard
          icon="calendar"
          title="Son 30 Gün Sipariş"
          value={metrics.last_30_day_orders}
        />
        <MetricCard
          icon="chart"
          title="Günlük Ortalama Sipariş"
          value={formatCompactNumber(metrics.daily_average_orders)}
          subtitle={`Son ${days} gün üzerinden`}
          trend={comparisonFallback}
        />
        <MetricCard
          icon="banknote"
          title="Günlük Ortalama Ciro"
          value={formatCurrency(metrics.daily_average_revenue)}
          subtitle={`Son ${days} gün üzerinden`}
          trend={comparisonFallback}
          tone="highlight"
        />
      </div>
    </section>
  );
}

export default DashboardPeriodMetrics;
