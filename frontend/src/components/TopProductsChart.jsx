import { formatCurrency } from "../utils/currency.js";

function TopProductsChart({ products }) {
  if (products.length === 0) {
    return <p className="analytics-empty">Satış ürünü bulunmuyor.</p>;
  }

  const maxQuantity = Math.max(...products.map((product) => product.total_quantity));

  return (
    <div className="top-products-chart">
      {products.map((product) => (
        <article key={product.product_id} className="top-product-row">
          <span className="analytics-product-emoji" aria-hidden="true">
            {product.emoji}
          </span>
          <div className="top-product-content">
            <div className="analytics-row-heading">
              <div>
                <strong>{product.product_name}</strong>
                <span>{product.category}</span>
              </div>
              <div>
                <strong>{product.total_quantity} adet</strong>
                <span>{formatCurrency(product.total_revenue)}</span>
              </div>
            </div>
            <div className="analytics-bar-track" aria-hidden="true">
              <span
                style={{
                  width: `${(product.total_quantity / maxQuantity) * 100}%`
                }}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default TopProductsChart;
