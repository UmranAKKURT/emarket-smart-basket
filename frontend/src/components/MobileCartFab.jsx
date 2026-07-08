function MobileCartFab({ cartItemCount, onClick }) {
  return (
    <button
      type="button"
      className="mobile-cart-fab"
      onClick={onClick}
      aria-label={cartItemCount > 0
        ? `Sepete git, ${cartItemCount} ürün var`
        : "Sepete git"}
    >
      <span aria-hidden="true" className="mobile-cart-fab-icon">🛒</span>
      {cartItemCount > 0 && (
        <span className="mobile-cart-fab-badge" aria-hidden="true">
          {cartItemCount}
        </span>
      )}
    </button>
  );
}

export default MobileCartFab;
