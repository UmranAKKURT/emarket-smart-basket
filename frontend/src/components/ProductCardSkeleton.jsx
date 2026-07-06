function ProductCardSkeleton() {
  return (
    <article className="product-card product-card-skeleton" aria-hidden="true">
      <span className="skeleton skeleton-emoji" />
      <div className="product-info">
        <span className="skeleton skeleton-label" />
        <span className="skeleton skeleton-title" />
      </div>
      <div className="product-actions">
        <span className="skeleton skeleton-price" />
        <span className="skeleton skeleton-button" />
      </div>
    </article>
  );
}

export default ProductCardSkeleton;
