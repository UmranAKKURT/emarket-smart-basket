import { formatPercentRatio } from "../utils/numberFormat.js";

function ProductPairsCard({ pairs }) {
  if (pairs.length === 0) {
    return <p className="analytics-empty">Birlikte satılan ürün çifti bulunmuyor.</p>;
  }

  const maxOrderCount = Math.max(...pairs.map((pair) => pair.order_count));

  return (
    <div className="product-pairs-list">
      {pairs.map((pair, index) => (
        <article
          className="product-pair-row"
          key={`${pair.first_product_id}-${pair.second_product_id}`}
        >
          <span className="top-product-rank">{index + 1}</span>
          <div className="product-pair-main">
            <div className="product-pair-products">
              <span className="product-pair-product">
                <span className="analytics-product-emoji" aria-hidden="true">
                  {pair.first_product_emoji}
                </span>
                <strong>{pair.first_product_name}</strong>
              </span>
              <span className="rule-arrow" aria-label="birlikte">+</span>
              <span className="product-pair-product">
                <span className="analytics-product-emoji" aria-hidden="true">
                  {pair.second_product_emoji}
                </span>
                <strong>{pair.second_product_name}</strong>
              </span>
            </div>
            <div className="product-pair-meta">
              <span>{pair.order_count} siparişte birlikte</span>
              <span>{formatPercentRatio(pair.support, 1)} support</span>
              <span>{pair.combined_quantity} toplam adet</span>
            </div>
            <div className="analytics-bar-track" aria-hidden="true">
              <span
                style={{
                  width: `${(pair.order_count / maxOrderCount) * 100}%`
                }}
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default ProductPairsCard;
