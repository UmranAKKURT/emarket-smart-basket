import { formatCurrency } from "../utils/currency.js";
import MetricCard from "./MetricCard.jsx";

function DashboardPeriodMetrics({ metrics }) {
  return (
    <section className="analytics-section analytics-period-section">
      <div className="dashboard-section-heading compact">
        <div>
          <p className="panel-kicker">Dönem performansı</p>
          <h3>Yeni Analytics</h3>
        </div>
      </div>

      <div className="period-metrics-grid">
        <MetricCard
          icon="📆"
          title="Son 7 Gün Sipariş"
          value={metrics.last_7_day_orders}
          tone="primary"
        />
        <MetricCard
          icon="🗓️"
          title="Son 30 Gün Sipariş"
          value={metrics.last_30_day_orders}
        />
        <MetricCard
          icon="📈"
          title="Günlük Ortalama Sipariş"
          value={metrics.daily_average_orders}
        />
        <MetricCard
          icon="💸"
          title="Günlük Ortalama Ciro"
          value={formatCurrency(metrics.daily_average_revenue)}
          tone="highlight"
        />
      </div>
    </section>
  );
}

export default DashboardPeriodMetrics;
