import { createPortal } from "react-dom";

import { formatCurrency } from "../utils/currency.js";

function MobileCartFab({ cartItemCount, cartTotal, onClick }) {
  if (cartItemCount === 0) {
    return null;
  }

  const formattedTotal = formatCurrency(cartTotal);

  return createPortal(
    <button
      type="button"
      className="mobile-cart-fab"
      onClick={onClick}
      aria-label={`Sepete git, ${cartItemCount} ürün, toplam ${formattedTotal}`}
    >
      <span className="mobile-cart-fab-action">
        <span aria-hidden="true" className="mobile-cart-fab-icon">🛒</span>
        <span>Sepete Git</span>
      </span>
      <span className="mobile-cart-fab-summary" aria-hidden="true">
        {cartItemCount} ürün · {formattedTotal}
      </span>
    </button>,
    document.body
  );
}

export default MobileCartFab;
