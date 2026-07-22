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
    <ol className="top-products-chart" aria-label="En çok satılan ürünler">
      {products.map((product, index) => {
        const quantityShare = totalQuantity
          ? Number(product.total_quantity) / totalQuantity
          : 0;

        return (
          <li key={product.product_id} className="admin-top-product">
            <span className="admin-top-product__rank">{index + 1}</span>

            <div className="admin-top-product__identity">
              <span className="admin-top-product__icon" aria-hidden="true">
                {product.emoji}
              </span>

              <div className="admin-top-product__copy">
                <strong className="admin-top-product__name">
                  {product.product_name}
                </strong>

                <span className="admin-top-product__meta">
                  <span>{product.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{product.order_count} sipariş</span>
                </span>
              </div>
            </div>

            <div className="admin-top-product__metrics">
              <strong>{product.total_quantity} adet</strong>
              <span>
                <span>{formatCurrency(product.total_revenue)}</span>
                <span aria-hidden="true"> · </span>
                <span>{formatPercentRatio(quantityShare, 1)}</span>
              </span>
            </div>

            <div className="admin-top-product__progress" aria-hidden="true">
              <span
                style={{
                  width: `${(product.total_quantity / maxQuantity) * 100}%`
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default TopProductsChart;
