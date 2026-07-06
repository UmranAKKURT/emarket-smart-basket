import EmptyState from "./EmptyState.jsx";
import ProductCard from "./ProductCard.jsx";
import ProductCardSkeleton from "./ProductCardSkeleton.jsx";

const SKELETON_CARD_COUNT = 8;

function ProductGrid({
  products,
  loading,
  hasActiveFilters = false,
  onClearFilters,
  onAddToCart
}) {
  if (loading) {
    return (
      <section
        className="product-grid product-grid-loading"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Ürünler yükleniyor...</span>
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="product-grid-state" aria-live="polite">
        <EmptyState
          icon="🔎"
          title="Ürün bulunamadı"
          description={
            hasActiveFilters
              ? "Aramanız veya kategori seçiminizle eşleşen ürün yok. Filtreleri temizleyerek tüm ürünleri görebilirsiniz."
              : "Katalog şu anda boş görünüyor. Birazdan tekrar deneyin."
          }
          action={
            hasActiveFilters && onClearFilters ? (
              <button
                className="empty-state-action"
                type="button"
                onClick={onClearFilters}
              >
                Filtreleri temizle
              </button>
            ) : null
          }
        />
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
