import ProductCard from "./ProductCard.jsx";

function ProductGrid({ products, loading, onAddToCart }) {
  if (loading) {
    return (
      <section className="product-grid-state" aria-live="polite">
        Ürünler yükleniyor...
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="product-grid-state" aria-live="polite">
        Bu seçim için ürün bulunamadı.
      </section>
    );
  }

  return (
    <section className="product-grid" aria-label="Ürünler">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAddToCart={onAddToCart}
        />
      ))}
    </section>
  );
}

export default ProductGrid;
