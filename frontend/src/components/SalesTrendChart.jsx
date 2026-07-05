import { formatCurrency } from "../utils/currency.js";

const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short"
});

function SalesTrendChart({ sales }) {
  if (sales.length === 0) {
    return <p className="analytics-empty">Günlük satış verisi bulunmuyor.</p>;
  }

  const maxRevenue = Math.max(
    1,
    ...sales.map((dailySale) => dailySale.total_revenue)
  );

  return (
    <div className="sales-trend-scroll">
      <div
        className="sales-trend-chart"
        style={{ gridTemplateColumns: `repeat(${sales.length}, minmax(24px, 1fr))` }}
      >
        {sales.map((dailySale) => (
          <div
            key={dailySale.date}
            className="sales-trend-day"
            title={`${dailySale.date}: ${formatCurrency(dailySale.total_revenue)}, ${dailySale.order_count} sipariş`}
          >
            <span className="sales-trend-value">
              {dailySale.total_revenue > 0
                ? formatCurrency(dailySale.total_revenue)
                : ""}
            </span>
            <div className="sales-trend-column">
              <span
                style={{
                  height: `${(dailySale.total_revenue / maxRevenue) * 100}%`
                }}
              />
            </div>
            <time dateTime={dailySale.date}>
              {shortDateFormatter.format(new Date(`${dailySale.date}T00:00:00Z`))}
            </time>
          </div>
        ))}
      </div>
    </div>
  );
}

export default SalesTrendChart;
