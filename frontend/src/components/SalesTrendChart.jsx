const shortDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short"
});

function SalesTrendChart({ sales }) {
  if (sales.length === 0) {
    return <p className="analytics-empty">Günlük sipariş verisi bulunmuyor.</p>;
  }

  const maxOrderCount = Math.max(
    1,
    ...sales.map((dailySale) => dailySale.order_count)
  );
  const totalOrders = sales.reduce(
    (total, dailySale) => total + dailySale.order_count,
    0
  );

  return (
    <div className="sales-trend-scroll">
      <div className="daily-orders-summary">
        <strong>{totalOrders}</strong>
        <span>seçili dönemdeki sipariş</span>
      </div>
      <div
        className="sales-trend-chart daily-orders-chart"
        style={{ gridTemplateColumns: `repeat(${sales.length}, minmax(24px, 1fr))` }}
      >
        {sales.map((dailySale) => (
          <div
            key={dailySale.date}
            className="sales-trend-day"
            title={`${dailySale.date}: ${dailySale.order_count} sipariş`}
          >
            <span className="sales-trend-value">
              {dailySale.order_count > 0 ? dailySale.order_count : ""}
            </span>
            <div className="sales-trend-column">
              <span
                style={{
                  height: `${(dailySale.order_count / maxOrderCount) * 100}%`
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
