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
  const middleOrderCount = Math.ceil(maxOrderCount / 2);
  const totalOrders = sales.reduce(
    (total, dailySale) => total + dailySale.order_count,
    0
  );
  const labelStep = sales.length > 16 ? Math.ceil(sales.length / 8) : 1;

  return (
    <div className="sales-trend-panel">
      <div className="daily-orders-summary">
        <strong>{totalOrders}</strong>
        <span>seçili dönemdeki sipariş</span>
      </div>

      <div className="sales-trend-chart" aria-label="Günlük sipariş sayısı grafiği">
        <div className="sales-trend-axis" aria-hidden="true">
          <span>{maxOrderCount}</span>
          <span>{middleOrderCount}</span>
          <span>0</span>
        </div>
        <div className="sales-trend-plot">
          <div className="sales-trend-grid" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div
            className="daily-orders-chart"
            style={{ gridTemplateColumns: `repeat(${sales.length}, minmax(0, 1fr))` }}
          >
            {sales.map((dailySale, index) => {
              const orderCount = Number(dailySale.order_count) || 0;
              const barHeight = orderCount === 0
                ? 0
                : Math.max(8, (orderCount / maxOrderCount) * 100);
              const dateLabel = shortDateFormatter.format(
                new Date(`${dailySale.date}T00:00:00Z`)
              );
              const showDateLabel = index % labelStep === 0 || index === sales.length - 1;

              return (
                <div
                  key={dailySale.date}
                  className="sales-trend-day"
                  tabIndex={0}
                  aria-label={`${dateLabel}: ${orderCount} sipariş`}
                >
                  <span className="sales-trend-value">
                    {orderCount}
                  </span>
                  <div className="sales-trend-column">
                    <span
                      className={orderCount === 0 ? "is-zero" : undefined}
                      style={{ height: `${barHeight}%` }}
                    />
                  </div>
                  <time dateTime={dailySale.date}>
                    {showDateLabel ? dateLabel : ""}
                  </time>
                  <span className="sales-trend-tooltip" role="tooltip">
                    {dateLabel}: {orderCount} sipariş
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalesTrendChart;
