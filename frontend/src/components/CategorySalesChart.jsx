import { formatCurrency } from "../utils/currency.js";

function CategorySalesChart({ categories }) {
  if (categories.length === 0) {
    return <p className="analytics-empty">Kategori satışı bulunmuyor.</p>;
  }

  return (
    <div className="category-sales-chart">
      {categories.map((category) => (
        <article key={category.category} className="category-sales-row">
          <div className="analytics-row-heading">
            <div>
              <strong>{category.category}</strong>
              <span>{category.total_quantity} adet satıldı</span>
            </div>
            <div>
              <strong>{formatCurrency(category.total_revenue)}</strong>
              <span>%{(category.revenue_share * 100).toFixed(1)} gelir payı</span>
            </div>
          </div>
          <div className="analytics-bar-track" aria-hidden="true">
            <span style={{ width: `${category.revenue_share * 100}%` }} />
          </div>
        </article>
      ))}
    </div>
  );
}

export default CategorySalesChart;
