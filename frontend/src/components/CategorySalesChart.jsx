import { formatCurrency } from "../utils/currency.js";
import { formatPercentRatio } from "../utils/numberFormat.js";

const CHART_COLORS = [
  "#4b1f85",
  "#7a45b3",
  "#ffd43b",
  "#e9a923",
  "#2c8f6a",
  "#de6f76",
  "#5f7cc9",
  "#9b6d45"
];

function buildCategoryGradient(categories) {
  let start = 0;
  const segments = categories.map((category, index) => {
    const end = start + category.revenue_share * 100;
    const segment = `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function CategorySalesChart({ categories }) {
  if (categories.length === 0) {
    return <p className="analytics-empty">Kategori satışı bulunmuyor.</p>;
  }

  const totalQuantity = categories.reduce(
    (total, category) => total + category.total_quantity,
    0
  );
  const totalRevenue = categories.reduce(
    (total, category) => total + Number(category.total_revenue),
    0
  );

  return (
    <div className="category-distribution">
      <div
        className="category-donut"
        style={{ background: buildCategoryGradient(categories) }}
        aria-label={`${categories.length} kategorinin ciro dağılımı`}
      >
        <div>
          <strong>{formatCurrency(totalRevenue)}</strong>
          <span>toplam ciro</span>
          <small>{totalQuantity} adet satıldı</small>
        </div>
      </div>

      <div className="category-sales-chart">
        <div className="category-sales-heading" aria-hidden="true">
          <span>Kategori</span>
          <span>Adet</span>
          <span>Ciro payı</span>
          <span>Ciro</span>
        </div>
        {categories.map((category, index) => (
          <article key={category.category} className="category-sales-row">
            <span
              className="category-color"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
              aria-hidden="true"
            />
            <strong className="category-sales-name">{category.category}</strong>
            <span className="category-sales-value">{category.total_quantity} adet</span>
            <span className="category-sales-value">{formatPercentRatio(category.revenue_share, 1)} ciro payı</span>
            <span className="category-sales-value">{formatCurrency(category.total_revenue)}</span>
          </article>
        ))}
        <p className="category-sales-note">
          Donut grafiği ve yüzde değerleri kategori cirosuna göre hesaplanır; adet bilgisi ayrı kolon olarak gösterilir.
        </p>
      </div>
    </div>
  );
}

export default CategorySalesChart;
