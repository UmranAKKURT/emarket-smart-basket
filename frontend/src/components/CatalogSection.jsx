import { memo } from "react";

import CategoryFilter from "./CategoryFilter.jsx";
import ProductGrid from "./ProductGrid.jsx";

function CatalogSection({
  categories,
  selectedCategory,
  onSelectCategory,
  error,
  products,
  loading,
  hasActiveFilters,
  onClearFilters,
  onRetry,
  onAddToCart
}) {
  return (
    <section className="catalog-section" aria-labelledby="catalog-title">
      <h2 className="sr-only" id="catalog-title">
        Ürün kataloğu
      </h2>

      <CategoryFilter
        categories={categories}
        selectedCategory={selectedCategory}
        onSelectCategory={onSelectCategory}
      />

      {error && (
        <div className="alert" role="alert">
          <strong>Katalog yüklenemedi.</strong>
          <span>{error}</span>
          <button className="alert-action" type="button" onClick={() => onRetry()}>
            Tekrar dene
          </button>
        </div>
      )}

      <ProductGrid
        products={products}
        loading={loading}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        onAddToCart={onAddToCart}
      />
    </section>
  );
}

export default memo(CatalogSection);
