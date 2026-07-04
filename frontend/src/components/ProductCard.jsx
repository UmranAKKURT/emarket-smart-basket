import { formatCurrency } from "../utils/currency.js";

function ProductCard({ product, onAddToCart }) {
  return (
    <article className="product-card">
      <div className="product-emoji" aria-hidden="true">
        {product.emoji}
      </div>
      <div className="product-info">
        <p className="product-category">{product.category}</p>
        <h2>{product.name}</h2>
      </div>
      <div className="product-actions">
        <strong>{formatCurrency(product.price)}</strong>
        <button type="button" onClick={() => onAddToCart(product)}>
          Sepete Ekle
        </button>
      </div>
    </article>
  );
}

export default ProductCard;
