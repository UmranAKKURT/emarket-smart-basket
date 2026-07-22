import { formatComparison } from "../utils/analyticsComparison.js";
import { formatCurrency } from "../utils/currency.js";
import { formatCompactNumber } from "../utils/numberFormat.js";
import MetricCard from "./MetricCard.jsx";

function DashboardPeriodMetrics({ metrics, periodLabel, isAllTime = false }) {
  const comparisons = metrics.comparisons ?? {};
  const comparisonFallback = isAllTime
    ? "Tüm zamanlar için dönem karşılaştırması uygulanmaz"
    : "Önceki dönem karşılaştırması yok";

  function getTrend(key) {
    return comparisons[key] ? formatComparison(comparisons[key]) : comparisonFallback;
  }

  return (
    <section className="analytics-section analytics-period-section">
      <div className="dashboard-section-heading compact">
        <div>
          <p className="panel-kicker">Dönem performansı</p>
          <h3>Yeni Analizler</h3>
        </div>
        <span>
          {periodLabel} · {metrics.period_day_count} gün · {metrics.active_day_count} aktif gün
        </span>
      </div>

      <div className="period-metrics-grid">
        <MetricCard
          icon="calendar"
          title="Seçili Dönem Sipariş"
          value={metrics.selected_period_orders}
          trend={getTrend("selected_period_orders")}
          tone="primary"
        />
        <MetricCard
          icon="banknote"
          title="Seçili Dönem Ciro"
          value={formatCurrency(metrics.selected_period_revenue)}
          trend={getTrend("selected_period_revenue")}
          tone="highlight"
        />
        <MetricCard
          icon="chart"
          title="Günlük Ortalama Sipariş"
          value={formatCompactNumber(metrics.daily_average_orders)}
          subtitle={`${periodLabel} üzerinden`}
          trend={getTrend("daily_average_orders")}
        />
        <MetricCard
          icon="banknote"
          title="Günlük Ortalama Ciro"
          value={formatCurrency(metrics.daily_average_revenue)}
          subtitle={`${periodLabel} üzerinden`}
          trend={getTrend("daily_average_revenue")}
          tone="highlight"
        />
      </div>
    </section>
  );
}

export default DashboardPeriodMetrics;
