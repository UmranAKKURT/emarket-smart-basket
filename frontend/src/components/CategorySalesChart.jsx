import { formatCurrency } from "../utils/currency.js";

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

  return (
    <div className="category-distribution">
      <div
        className="category-donut"
        style={{ background: buildCategoryGradient(categories) }}
        aria-label={`${categories.length} kategorinin satış dağılımı`}
      >
        <div>
          <strong>{totalQuantity}</strong>
          <span>ürün</span>
        </div>
      </div>

      <div className="category-sales-chart">
        {categories.map((category, index) => (
          <article key={category.category} className="category-sales-row">
            <span
              className="category-color"
              style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
              aria-hidden="true"
            />
            <div className="analytics-row-heading">
              <div>
                <strong>{category.category}</strong>
                <span>{category.total_quantity} adet satıldı</span>
              </div>
              <div>
                <strong>%{(category.revenue_share * 100).toFixed(1)}</strong>
                <span>{formatCurrency(category.total_revenue)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default CategorySalesChart;
