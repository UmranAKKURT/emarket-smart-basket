import { memo, useId } from "react";

import { formatCurrency } from "../utils/currency.js";

function ProductCard({ product, onAddToCart }) {
  const titleId = useId();

  return (
    <article className="product-card" aria-labelledby={titleId}>
      <div className="product-emoji" aria-hidden="true">
        {product.emoji}
      </div>
      <div className="product-info">
        <p className="product-category">{product.category}</p>
        <h2 id={titleId}>{product.name}</h2>
      </div>
      <div className="product-actions">
        <strong>{formatCurrency(product.price)}</strong>
        <button
          type="button"
          aria-label={`${product.name} ürününü sepete ekle`}
          onClick={() => onAddToCart(product)}
        >
          Sepete Ekle
        </button>
      </div>
    </article>
  );
}

// Ürün listesinde yalnızca değişen kartın yeniden çizilmesini sağlar.
export default memo(ProductCard);
