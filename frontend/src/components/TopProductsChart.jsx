import { formatCurrency } from "../utils/currency.js";
import { formatPercentRatio } from "../utils/numberFormat.js";

function TopProductsChart({ products }) {
  if (products.length === 0) {
    return <p className="analytics-empty">Satış ürünü bulunmuyor.</p>;
  }

  const maxQuantity = Math.max(...products.map((product) => product.total_quantity));
  const totalQuantity = products.reduce(
    (total, product) => total + Number(product.total_quantity),
    0
  );

  return (
    <div className="top-products-chart">
      {products.map((product, index) => {
        const quantityShare = totalQuantity
          ? Number(product.total_quantity) / totalQuantity
          : 0;

        return (
          <article key={product.product_id} className="top-product-row">
            <span className="top-product-rank">{index + 1}</span>
            <span className="analytics-product-emoji" aria-hidden="true">
              {product.emoji}
            </span>
            <div className="top-product-content">
              <div className="analytics-row-heading">
                <div className="analytics-row-main">
                  <strong>{product.product_name}</strong>
                  <span className="analytics-row-meta">
                    <span>{product.category}</span>
                    <span>{product.order_count} sipariş</span>
                  </span>
                </div>
                <div className="analytics-row-values">
                  <strong>{product.total_quantity} adet</strong>
                  <span>
                    <span>{formatCurrency(product.total_revenue)}</span>
                    <span>{formatPercentRatio(quantityShare, 1)}</span>
                  </span>
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
        );
      })}
    </div>
  );
}

export default TopProductsChart;
